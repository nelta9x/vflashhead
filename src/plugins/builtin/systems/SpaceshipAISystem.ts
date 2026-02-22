import { C_DishTag, C_Identity, C_Transform } from '../../../world';
import entitiesJson from '../../../../data/entities.json';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { EntityDamageService } from '../services/EntityDamageService';

interface SpaceshipState {
  targetDishId: EntityId | null;
  isEating: boolean;
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

/**
 * Spaceship AI state machine: CHASING ↔ EATING.
 *
 * - Target selection: homeX/homeY (anchor) — stable, not oscillating.
 * - Entry/range check: transform — visual position.
 * - Chase: moves homeX/homeY toward dish.
 * - Drift amplitude is 0 (entities.json), so transform ≈ homeX/homeY.
 */
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

    // 1. Collect active spaceship IDs and clean stale states
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

    // 2. Per-spaceship state machine
    const playerT = this.world.transform.get(this.world.context.playerId);
    for (const entityId of activeSpaceshipIds) {
      const t = this.world.transform.get(entityId);
      const mov = this.world.movement.get(entityId);
      if (!t || !mov || !mov.drift) continue;

      // entry 애니메이션 중에는 AI 비활성 (entry가 homeY를 제어하므로 chase와 충돌)
      const pn = this.world.phaserNode.get(entityId);
      if (pn?.typePlugin?.isInEntry?.(entityId)) continue;

      let state = this.spaceshipStates.get(entityId);
      if (!state) {
        state = { targetDishId: null, isEating: false, lastEatHitTime: 0 };
        this.spaceshipStates.set(entityId, state);
      }

      const shipSize = this.world.dishProps.get(entityId)?.size ?? 0;

      // 2a. EATING → CHASING transition: target destroyed or inactive
      if (state.isEating) {
        if (state.targetDishId === null || !this.world.isActive(state.targetDishId)) {
          this.stopEating(state);
        }
      }

      // 2b. CHASING: target selection + chase + entry check
      if (!state.isEating) {
        state.targetDishId = this.findNearestDish(mov.homeX, mov.homeY);

        if (state.targetDishId !== null) {
          const dishT = this.world.transform.get(state.targetDishId);
          if (dishT) {
            this.chaseAnchorToward(mov, dishT.x, dishT.y, dtSec);

            const dishSize = this.world.dishProps.get(state.targetDishId)?.size ?? 0;
            if (this.distanceBetween(t.x, t.y, dishT.x, dishT.y) <= shipSize + dishSize) {
              state.isEating = true;
              state.lastEatHitTime = 0;
            }
          }
        }
      }

      // 2c. EATING: range check + chase + timer damage
      if (state.isEating && state.targetDishId !== null) {
        const dishT = this.world.transform.get(state.targetDishId);
        if (dishT) {
          const dishSize = this.world.dishProps.get(state.targetDishId)?.size ?? 0;

          if (this.distanceBetween(t.x, t.y, dishT.x, dishT.y) > shipSize + dishSize) {
            this.stopEating(state);
            continue;
          }

          this.chaseAnchorToward(mov, dishT.x, dishT.y, dtSec);

          if (gameTime - state.lastEatHitTime >= dishAttackConfig.hitInterval) {
            state.lastEatHitTime = gameTime;
            this.entityDamageService.applyDamage(state.targetDishId, dishAttackConfig.hitDamage);

            if (!this.world.isActive(state.targetDishId) && playerT) {
              const payload: SpaceshipFireProjectilePayload = {
                fromX: t.x,
                fromY: t.y,
                targetX: playerT.x,
                targetY: playerT.y,
                gameTime,
              };
              EventBus.getInstance().emit(GameEvents.SPACESHIP_FIRE_PROJECTILE, payload);
              this.stopEating(state);
            }
          }
        }
      }
    }
  }

  private stopEating(state: SpaceshipState): void {
    state.isEating = false;
    state.targetDishId = null;
  }

  private findNearestDish(fromX: number, fromY: number): EntityId | null {
    let nearestId: EntityId | null = null;
    let nearestDist = Infinity;
    for (const [dishId, , dishIdentity, dishTransform] of this.world.query(C_DishTag, C_Identity, C_Transform)) {
      if (dishIdentity.entityType === 'spaceship') continue;
      const dist = this.distanceBetween(fromX, fromY, dishTransform.x, dishTransform.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = dishId;
      }
    }
    return nearestId;
  }

  private chaseAnchorToward(
    mov: { homeX: number; homeY: number },
    targetX: number, targetY: number, dtSec: number,
  ): void {
    const dx = targetX - mov.homeX;
    const dy = targetY - mov.homeY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      const move = Math.min(dishAttackConfig.chaseSpeed * dtSec, dist);
      mov.homeX += (dx / dist) * move;
      mov.homeY += (dy / dist) * move;
    }
  }

  private distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  clear(): void {
    this.spaceshipStates.clear();
  }

  destroy(): void {
    this.clear();
  }
}
