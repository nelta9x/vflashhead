import Phaser from 'phaser';
import { GAME_WIDTH, CURSOR_HITBOX, HEAL_PACK } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import type { HealthPackLevelData } from '../../../data/types';
import type { Entity } from '../../../entities/Entity';
import { HealthPackRenderer } from '../abilities/HealthPackRenderer';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import { C_HealthPack, C_Transform } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { World } from '../../../world';
import type { UpgradeSystem } from '../services/UpgradeSystem';
import type { EntityPoolManager } from '../../../systems/EntityPoolManager';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';

const OFFSCREEN_MARGIN = 40;

export class HealthPackSystem implements EntitySystem {
  readonly id = 'core:health_pack';
  enabled = true;

  private readonly world: World;
  private readonly scene: Phaser.Scene;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly entityPoolManager: EntityPoolManager;
  private lastSpawnTime: number = -HEAL_PACK.COOLDOWN;
  private timeSinceLastCheck: number = 0;

  constructor(scene: Phaser.Scene, upgradeSystem: UpgradeSystem, world: World, entityPoolManager: EntityPoolManager) {
    this.scene = scene;
    this.upgradeSystem = upgradeSystem;
    this.world = world;
    this.entityPoolManager = entityPoolManager;
  }

  tick(delta: number): void {
    // Update all active health packs
    for (const [entityId, hp, t] of this.world.query(C_HealthPack, C_Transform)) {
      // Move upward
      t.y -= (hp.moveSpeed * delta) / 1000;

      // Pulse animation
      hp.pulsePhase += delta * 0.005;

      // Pre-miss warning
      this.emitPreMissWarningIfNeeded(entityId, hp, t);

      // Off-screen check (above screen)
      if (t.y < -OFFSCREEN_MARGIN) {
        this.onMissed(entityId);
        continue;
      }

      // Render
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        node.container.x = t.x;
        node.container.y = t.y;
        HealthPackRenderer.render(node.graphics, {
          size: Data.healthPack.visualSize,
          pulsePhase: hp.pulsePhase,
        });
      }
    }

    // Spawn logic
    this.checkSpawning(delta, this.world.context.gameTime);

    // Cursor collection check (post-movement)
    const playerT = this.world.transform.get(this.world.context.playerId);
    if (playerT) {
      const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
      const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
      this.checkCollection(playerT.x, playerT.y, cursorRadius);
    }
  }

  checkCollection(cursorX: number, cursorY: number, cursorRadius: number): void {
    for (const [entityId, , t] of this.world.query(C_HealthPack, C_Transform)) {
      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, t.x, t.y);
      const hitDistance = cursorRadius + Data.healthPack.hitboxSize;

      if (dist <= hitDistance) {
        this.collect(entityId);
      }
    }
  }

  getActiveCount(): number {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of this.world.query(C_HealthPack)) {
      count++;
    }
    return count;
  }

  getSpawnChance(): number {
    const upgradeBonus = this.upgradeSystem.getLevelData<HealthPackLevelData>('health_pack')?.dropChanceBonus ?? 0;
    return HEAL_PACK.BASE_SPAWN_CHANCE + upgradeBonus;
  }

  clear(): void {
    const toRemove: EntityId[] = [];
    for (const [entityId] of this.world.query(C_HealthPack)) {
      toRemove.push(entityId);
    }
    for (const entityId of toRemove) {
      this.destroyHealthPackEntity(entityId);
    }
    this.lastSpawnTime = -HEAL_PACK.COOLDOWN;
    this.timeSinceLastCheck = 0;
  }

  destroy(): void {
    // No event listeners to clean up (system is pipeline-managed)
  }

  private collect(entityId: EntityId): void {
    if (!this.world.isActive(entityId)) return;

    const t = this.world.transform.get(entityId);
    const node = this.world.phaserNode.get(entityId);

    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_COLLECTED, {
      x: t?.x ?? 0,
      y: t?.y ?? 0,
    });

    // Collection animation
    if (node) {
      const entity = node.container as Entity;
      entity.disableInteractive();
      entity.removeAllListeners();
      // Mark as inactive in world immediately to prevent double-collect
      this.world.destroyEntity(entityId);
      this.scene.tweens.add({
        targets: entity,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 150,
        ease: 'Power2',
        onComplete: () => {
          entity.setVisible(false);
          entity.setActive(false);
          this.entityPoolManager.release('healthPack', entity);
        },
      });
    } else {
      this.destroyHealthPackEntity(entityId);
    }
  }

  private onMissed(entityId: EntityId): void {
    if (!this.world.isActive(entityId)) return;

    const node = this.world.phaserNode.get(entityId);
    if (node) {
      node.container.disableInteractive();
      node.container.removeAllListeners();
    }

    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_MISSED);
    this.destroyHealthPackEntity(entityId);
  }

  private emitPreMissWarningIfNeeded(
    entityId: EntityId,
    hp: { hasPreMissWarningEmitted: boolean },
    t: { x: number; y: number },
  ): void {
    if (hp.hasPreMissWarningEmitted) return;

    const warningDistance = Data.healthPack.preMissWarningDistance;
    if (warningDistance <= 0) return;

    const warningThresholdY = -OFFSCREEN_MARGIN + warningDistance;
    if (t.y > warningThresholdY) return;

    hp.hasPreMissWarningEmitted = true;
    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_PASSING, {
      x: t.x,
      y: t.y,
    });
    // Suppress unused entityId lint (available for future use)
    void entityId;
  }

  private destroyHealthPackEntity(entityId: EntityId): void {
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      if (node.spawnTween) {
        node.spawnTween.stop();
        node.spawnTween = null;
      }
      const entity = node.container as Entity;
      entity.setVisible(false);
      entity.setActive(false);
      entity.disableInteractive();
      entity.removeAllListeners();
      this.entityPoolManager.release('healthPack', entity);
    }
    this.world.destroyEntity(entityId);
  }

  private checkSpawning(delta: number, gameTime: number): void {
    if (gameTime < this.lastSpawnTime + HEAL_PACK.COOLDOWN) {
      return;
    }

    if (this.getActiveCount() >= HEAL_PACK.MAX_ACTIVE) {
      return;
    }

    this.timeSinceLastCheck += delta;
    if (this.timeSinceLastCheck < HEAL_PACK.CHECK_INTERVAL) {
      return;
    }
    this.timeSinceLastCheck = 0;

    const spawnChance = this.getSpawnChance();
    if (spawnChance <= 0) {
      return;
    }

    if (Math.random() < spawnChance) {
      this.spawnHealthPack(gameTime);
    }
  }

  private spawnHealthPack(gameTime: number): void {
    const margin = Data.healthPack.spawnMargin;
    const x = Phaser.Math.Between(margin, GAME_WIDTH - margin);
    const gameHeight = Data.gameConfig.screen.height;

    // Acquire Entity from pool
    const entity = this.entityPoolManager.acquire('healthPack');
    if (!entity) return;

    entity.setPosition(x, gameHeight + OFFSCREEN_MARGIN);
    entity.reset();

    const container = entity;
    const graphics = entity.getGraphics();

    // Spawn into ECS world
    const archetype = this.world.archetypeRegistry.getRequired('healthPack');
    const entityId = this.world.spawnFromArchetype(archetype, {
      healthPack: {
        moveSpeed: Data.healthPack.moveSpeed,
        pulsePhase: 0,
        hasPreMissWarningEmitted: false,
      },
      transform: {
        x, y: gameHeight + OFFSCREEN_MARGIN,
        baseX: x, baseY: gameHeight + OFFSCREEN_MARGIN,
        alpha: 1, scaleX: 1, scaleY: 1,
      },
      phaserNode: {
        container,
        graphics,
        body: null,
        spawnTween: null,
        bossRenderer: null,
        typePlugin: null,
      },
    });

    entity.setEntityId(entityId);

    // Click/hover collection
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, Data.healthPack.hitboxSize),
      Phaser.Geom.Circle.Contains
    );
    container.on('pointerover', () => {
      this.collect(entityId);
    });

    // Spawn animation
    container.setScale(0);
    container.setAlpha(0);
    const spawnTween = this.scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Store spawn tween for cleanup
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      node.spawnTween = spawnTween;
    }

    // Initial draw
    HealthPackRenderer.render(graphics, {
      size: Data.healthPack.visualSize,
      pulsePhase: 0,
    });

    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_SPAWNED, { x, y: gameHeight + OFFSCREEN_MARGIN });
    this.lastSpawnTime = gameTime;
  }
}
