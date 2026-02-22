import Phaser from 'phaser';
import { CURSOR_HITBOX, GAME_WIDTH, GAME_HEIGHT } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import entitiesJson from '../../../../data/entities.json';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { HealthSystem } from '../../../systems/HealthSystem';
import type { FeedbackSystem } from '../services/FeedbackSystem';
import type { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import type { SpaceshipFireProjectilePayload } from './SpaceshipAISystem';
import {
  ABILITY_IDS,
  CURSOR_SIZE_EFFECT_KEYS,
} from '../services/upgrades/AbilityEffectCatalog';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spawnTime: number;
}

const projConfig = entitiesJson.types.spaceship.projectile;
const parsedProjectileColor = Phaser.Display.Color.HexStringToColor(projConfig.color).color;
const parsedCoreColor = Phaser.Display.Color.HexStringToColor(projConfig.coreColor).color;
const OFFSCREEN_MARGIN = 50;

export class SpaceshipProjectileSystem implements EntitySystem {
  readonly id = 'core:spaceship_projectile';
  enabled = true;

  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly healthSystem: HealthSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly projectiles: Projectile[] = [];
  private lastHitTime = 0;

  private readonly handleFireRequest = (payload: unknown): void => {
    const p = payload as SpaceshipFireProjectilePayload;
    this.fireProjectile(p.fromX, p.fromY, p.targetX, p.targetY, p.gameTime);
  };

  constructor(
    scene: Phaser.Scene,
    world: World,
    healthSystem: HealthSystem,
    feedbackSystem: FeedbackSystem,
    abilityRuntimeQuery: AbilityRuntimeQueryService,
  ) {
    this.scene = scene;
    this.world = world;
    this.healthSystem = healthSystem;
    this.feedbackSystem = feedbackSystem;
    this.abilityRuntimeQuery = abilityRuntimeQuery;

    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(Data.gameConfig.depths.laser);

    EventBus.getInstance().on(GameEvents.SPACESHIP_FIRE_PROJECTILE, this.handleFireRequest);
  }

  tick(delta: number): void {
    const gameTime = this.world.context.gameTime;
    const dtSec = delta / 1000;

    // Move projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      const age = gameTime - p.spawnTime;
      if (
        age > projConfig.lifetime ||
        p.x < -OFFSCREEN_MARGIN || p.x > GAME_WIDTH + OFFSCREEN_MARGIN ||
        p.y < -OFFSCREEN_MARGIN || p.y > GAME_HEIGHT + OFFSCREEN_MARGIN
      ) {
        this.projectiles.splice(i, 1);
      }
    }

    // Cursor collision check
    const playerT = this.world.transform.get(this.world.context.playerId);
    if (playerT) {
      const cursorSizeBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.CURSOR_SIZE,
        CURSOR_SIZE_EFFECT_KEYS.SIZE_BONUS,
      );
      const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
      this.checkCollisions(playerT.x, playerT.y, cursorRadius, gameTime);
    }

    // Render
    this.render();
  }

  private fireProjectile(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    gameTime: number,
  ): void {
    const angle = Math.atan2(targetY - fromY, targetX - fromX);
    const varianceRad = (projConfig.aimVarianceDeg * Math.PI) / 180;
    const finalAngle = angle + (Math.random() - 0.5) * 2 * varianceRad;

    this.projectiles.push({
      x: fromX,
      y: fromY,
      vx: Math.cos(finalAngle) * projConfig.speed,
      vy: Math.sin(finalAngle) * projConfig.speed,
      spawnTime: gameTime,
    });
  }

  private checkCollisions(
    cursorX: number,
    cursorY: number,
    cursorRadius: number,
    gameTime: number,
  ): void {
    if (gameTime - this.lastHitTime < projConfig.invincibilityDuration) return;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, p.x, p.y);
      if (dist < cursorRadius + projConfig.hitboxRadius) {
        this.projectiles.splice(i, 1);
        this.lastHitTime = gameTime;
        this.healthSystem.takeDamage(projConfig.damage);
        this.feedbackSystem.onHpLost();
        this.scene.cameras.main.shake(200, 0.008);
        return;
      }
    }
  }

  private render(): void {
    this.graphics.clear();

    for (const p of this.projectiles) {
      // Outer glow
      this.graphics.fillStyle(parsedProjectileColor, 0.3);
      this.graphics.fillCircle(p.x, p.y, projConfig.size * 3);

      // Mid glow
      this.graphics.fillStyle(parsedProjectileColor, 0.6);
      this.graphics.fillCircle(p.x, p.y, projConfig.size * 2);

      // Body
      this.graphics.fillStyle(parsedProjectileColor, 1);
      this.graphics.fillCircle(p.x, p.y, projConfig.size);

      // Core
      this.graphics.fillStyle(parsedCoreColor, 1);
      this.graphics.fillCircle(p.x, p.y, projConfig.size * 0.5);
    }
  }

  clear(): void {
    this.projectiles.length = 0;
    this.lastHitTime = 0;
    this.graphics.clear();
  }

  destroy(): void {
    EventBus.getInstance().off(GameEvents.SPACESHIP_FIRE_PROJECTILE, this.handleFireRequest);
    this.clear();
    this.graphics.destroy();
  }
}
