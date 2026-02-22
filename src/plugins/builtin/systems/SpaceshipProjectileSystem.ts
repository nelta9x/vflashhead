import Phaser from 'phaser';
import { CURSOR_HITBOX, GAME_WIDTH, GAME_HEIGHT } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import entitiesJson from '../../../../data/entities.json';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { HealthSystem } from '../../../systems/HealthSystem';
import type { FeedbackSystem } from '../services/FeedbackSystem';
import type { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import type { SoundSystem } from '../services/SoundSystem';
import type { SpaceshipFireProjectilePayload } from './SpaceshipAISystem';
import type { IPlayerAttackRenderer, ChargeVisualHandle } from '../../types/renderers';
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

interface PendingCharge {
  entityId: EntityId;
  targetX: number;
  targetY: number;
  startTime: number;
  handle: ChargeVisualHandle;
}

const projConfig = entitiesJson.types.spaceship.projectile;
const chargeConfig = projConfig.charge;
const visual = projConfig.visual;
const parsedVisualColor = Phaser.Display.Color.HexStringToColor(visual.color).color;
const parsedLightColor = Phaser.Display.Color.HexStringToColor(visual.lightColor).color;
const parsedChargeMainColor = Phaser.Display.Color.HexStringToColor(chargeConfig.mainColor).color;
const parsedChargeAccentColor = Phaser.Display.Color.HexStringToColor(chargeConfig.accentColor).color;
const OFFSCREEN_MARGIN = 50;

export class SpaceshipProjectileSystem implements EntitySystem {
  readonly id = 'core:spaceship_projectile';
  enabled = true;

  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly healthSystem: HealthSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
  private readonly soundSystem: SoundSystem;
  private readonly playerAttackRenderer: IPlayerAttackRenderer;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly projectiles: Projectile[] = [];
  private readonly pendingCharges: PendingCharge[] = [];
  private lastHitTime = 0;

  private readonly handleFireRequest = (payload: unknown): void => {
    const p = payload as SpaceshipFireProjectilePayload;
    this.startCharge(p.entityId, p.targetX, p.targetY, p.gameTime);
  };

  constructor(
    scene: Phaser.Scene,
    world: World,
    healthSystem: HealthSystem,
    feedbackSystem: FeedbackSystem,
    abilityRuntimeQuery: AbilityRuntimeQueryService,
    soundSystem: SoundSystem,
    playerAttackRenderer: IPlayerAttackRenderer,
  ) {
    this.scene = scene;
    this.world = world;
    this.healthSystem = healthSystem;
    this.feedbackSystem = feedbackSystem;
    this.abilityRuntimeQuery = abilityRuntimeQuery;
    this.soundSystem = soundSystem;
    this.playerAttackRenderer = playerAttackRenderer;

    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(Data.gameConfig.depths.laser);

    EventBus.getInstance().on(GameEvents.SPACESHIP_FIRE_PROJECTILE, this.handleFireRequest);
  }

  tick(delta: number): void {
    const gameTime = this.world.context.gameTime;
    const dtSec = delta / 1000;

    // 1. Update pending charges
    this.updateCharges(gameTime);

    // 2. Move projectiles
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

    // 3. Cursor collision check
    const playerT = this.world.transform.get(this.world.context.playerId);
    if (playerT) {
      const cursorSizeBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.CURSOR_SIZE,
        CURSOR_SIZE_EFFECT_KEYS.SIZE_BONUS,
      );
      const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
      this.checkCollisions(playerT.x, playerT.y, cursorRadius, gameTime);
    }

    // 4. Render
    this.render();
  }

  private startCharge(
    entityId: EntityId,
    targetX: number,
    targetY: number,
    gameTime: number,
  ): void {
    this.soundSystem.playSpaceshipChargeSound();
    const handle = this.playerAttackRenderer.createChargeVisual(
      parsedChargeMainColor,
      parsedChargeAccentColor,
      chargeConfig,
    );
    this.pendingCharges.push({ entityId, targetX, targetY, startTime: gameTime, handle });
  }

  private updateCharges(gameTime: number): void {
    for (let i = this.pendingCharges.length - 1; i >= 0; i--) {
      const charge = this.pendingCharges[i];

      // Cancel if spaceship died
      if (!this.world.isActive(charge.entityId)) {
        charge.handle.destroy();
        this.pendingCharges.splice(i, 1);
        continue;
      }

      const t = this.world.transform.get(charge.entityId);
      if (!t) {
        charge.handle.destroy();
        this.pendingCharges.splice(i, 1);
        continue;
      }

      const elapsed = gameTime - charge.startTime;
      const progress = Math.min(elapsed / chargeConfig.duration, 1);
      const spaceshipSize = this.world.dishProps.get(charge.entityId)?.size ?? 35;

      charge.handle.update(progress, t.x, t.y, spaceshipSize);

      if (progress >= 1) {
        charge.handle.destroy();
        this.fireProjectile(t.x, t.y, charge.targetX, charge.targetY, gameTime);
        this.pendingCharges.splice(i, 1);
      }
    }
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
      // Glow levels (same structure as spaceship core)
      for (const level of visual.glowLevels) {
        this.graphics.fillStyle(parsedVisualColor, level.alpha);
        this.graphics.fillCircle(p.x, p.y, projConfig.size * level.radiusMultiplier);
      }

      // Body
      this.graphics.fillStyle(parsedVisualColor, visual.bodyAlpha);
      this.graphics.fillCircle(p.x, p.y, projConfig.size);

      // Center light
      this.graphics.fillStyle(parsedLightColor, 0.8);
      this.graphics.fillCircle(p.x, p.y, projConfig.size * visual.lightRadiusRatio);
    }
  }

  clear(): void {
    for (const charge of this.pendingCharges) {
      charge.handle.destroy();
    }
    this.pendingCharges.length = 0;
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
