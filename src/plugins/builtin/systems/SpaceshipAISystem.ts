import Phaser from 'phaser';
import { C_DishTag, C_Identity, C_Transform } from '../../../world';
import entitiesJson from '../../../../data/entities.json';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { EntityDamageService } from '../services/EntityDamageService';

interface SpaceshipState {
  targetDishId: EntityId | null;
  lastEatHitTime: number;
}

export interface SpaceshipFireProjectilePayload {
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  gameTime: number;
}

const dishAttackConfig = entitiesJson.types.spaceship.dishAttack;

export class SpaceshipAISystem implements EntitySystem {
  readonly id = 'core:spaceship_ai';
  enabled = true;

  private readonly world: World;
  private readonly entityDamageService: EntityDamageService;
  private readonly spaceshipStates = new Map<EntityId, SpaceshipState>();

  constructor(world: World, entityDamageService: EntityDamageService) {
    this.world = world;
    this.entityDamageService = entityDamageService;
  }

  tick(delta: number): void {
    const gameTime = this.world.context.gameTime;
    const dtSec = delta / 1000;

    // Collect active spaceship entity IDs and clean stale states
    const activeSpaceshipIds = new Set<EntityId>();
    for (const [entityId, identity] of this.world.query(C_Identity, C_Transform)) {
      if (identity.entityType !== 'spaceship') continue;
      activeSpaceshipIds.add(entityId);
    }

    for (const id of this.spaceshipStates.keys()) {
      if (!activeSpaceshipIds.has(id)) {
        this.spaceshipStates.delete(id);
      }
    }

    // Dish-chase + eat-to-fire logic
    const playerT = this.world.transform.get(this.world.context.playerId);
    for (const entityId of activeSpaceshipIds) {
      const t = this.world.transform.get(entityId);
      const mov = this.world.movement.get(entityId);
      if (!t || !mov) continue;

      let state = this.spaceshipStates.get(entityId);
      if (!state) {
        state = { targetDishId: null, lastEatHitTime: 0 };
        this.spaceshipStates.set(entityId, state);
      }

      // Find nearest dish (non-spaceship entity with DishTag)
      let nearestId: EntityId | null = null;
      let nearestDist = Infinity;
      for (const [dishId, , dishIdentity, dishTransform] of this.world.query(C_DishTag, C_Identity, C_Transform)) {
        if (dishIdentity.entityType === 'spaceship') continue;
        const dx = dishTransform.x - t.x;
        const dy = dishTransform.y - t.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = dishId;
        }
      }

      state.targetDishId = nearestId;

      if (nearestId !== null) {
        const dishT = this.world.transform.get(nearestId);
        if (dishT && mov.drift) {
          // Chase + eat use anchor-to-dish distance
          // (transform includes drift oscillation that dwarfs collision radii)
          const dx = dishT.x - mov.homeX;
          const dy = dishT.y - mov.homeY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const move = Math.min(dishAttackConfig.chaseSpeed * dtSec, dist);
            const bounds = mov.drift.bounds;
            mov.homeX = Phaser.Math.Clamp(mov.homeX + (dx / dist) * move, bounds.minX, bounds.maxX);
            mov.homeY = Phaser.Math.Clamp(mov.homeY + (dy / dist) * move, bounds.minY, bounds.maxY);
          }

          // Eat: circle-circle collision using actual entity sizes
          const shipSize = this.world.dishProps.get(entityId)?.size ?? 0;
          const dishSize = this.world.dishProps.get(nearestId)?.size ?? 0;
          if (dist <= shipSize + dishSize && gameTime - state.lastEatHitTime >= dishAttackConfig.hitInterval) {
            state.lastEatHitTime = gameTime;
            this.entityDamageService.applyDamage(nearestId, dishAttackConfig.hitDamage);

            // If dish was destroyed, fire projectile toward player via EventBus
            if (!this.world.isActive(nearestId) && playerT) {
              const payload: SpaceshipFireProjectilePayload = {
                fromX: t.x,
                fromY: t.y,
                targetX: playerT.x,
                targetY: playerT.y,
                gameTime,
              };
              EventBus.getInstance().emit(GameEvents.SPACESHIP_FIRE_PROJECTILE, payload);
            }
          }
        }
      }
    }
  }

  clear(): void {
    this.spaceshipStates.clear();
  }

  destroy(): void {
    this.clear();
  }
}
