import Phaser from 'phaser';
import { GAME_WIDTH, CURSOR_HITBOX, FALLING_BOMB } from '../data/constants';
import { Data } from '../data/DataManager';
import type { Entity } from '../entities/Entity';
import { DishRenderer } from '../plugins/builtin/entities/DishRenderer';
import { EventBus, GameEvents } from '../utils/EventBus';
import { C_FallingBomb, C_Transform } from '../world';
import type { EntityId } from '../world/EntityId';
import type { World } from '../world';
import type { EntityPoolManager } from './EntityPoolManager';
import type { UpgradeSystem } from './UpgradeSystem';
import type { EntitySystem } from './entity-systems/EntitySystem';

const OFFSCREEN_MARGIN = 40;

export class FallingBombSystem implements EntitySystem {
  readonly id = 'core:falling_bomb';
  enabled = true;

  private readonly world: World;
  private readonly scene: Phaser.Scene;
  private readonly entityPoolManager: EntityPoolManager;
  private readonly upgradeSystem: UpgradeSystem;
  private lastSpawnTime: number = -FALLING_BOMB.COOLDOWN;
  private timeSinceLastCheck: number = 0;

  constructor(scene: Phaser.Scene, world: World, entityPoolManager: EntityPoolManager, upgradeSystem: UpgradeSystem) {
    this.scene = scene;
    this.world = world;
    this.entityPoolManager = entityPoolManager;
    this.upgradeSystem = upgradeSystem;
  }

  tick(delta: number): void {
    // Update all active falling bombs
    for (const [entityId, fb, t] of this.world.query(C_FallingBomb, C_Transform)) {
      // Move downward
      t.y += (fb.moveSpeed * delta) / 1000;

      // Blink phase
      fb.blinkPhase += delta * 0.005;

      // Off-screen check
      const gameHeight = Data.gameConfig.screen.height;
      if (t.y > gameHeight + OFFSCREEN_MARGIN) {
        this.onMissed(entityId);
        continue;
      }

      // Render
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        node.container.x = t.x;
        node.container.y = t.y;
        DishRenderer.renderDangerDish(node.graphics, {
          size: Data.fallingBomb.visualSize,
          blinkPhase: fb.blinkPhase,
        });
      }
    }

    // Spawn logic
    if (this.world.context.currentWave >= FALLING_BOMB.MIN_WAVE) {
      this.checkSpawning(delta, this.world.context.gameTime);
    }

    // Cursor collision check (post-movement)
    const playerT = this.world.transform.get(this.world.context.playerId);
    if (playerT) {
      const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
      const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
      this.checkCursorCollision(playerT.x, playerT.y, cursorRadius);
    }
  }

  checkCursorCollision(cursorX: number, cursorY: number, cursorRadius: number): void {
    for (const [entityId, fb, t] of this.world.query(C_FallingBomb, C_Transform)) {
      if (!fb.fullySpawned) continue;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, t.x, t.y);
      const hitDistance = cursorRadius + Data.fallingBomb.hitboxSize;

      if (dist <= hitDistance) {
        this.forceDestroy(entityId, false);
      }
    }
  }

  forceDestroy(entityId: EntityId, byAbility: boolean): void {
    if (!this.world.isActive(entityId)) return;

    const t = this.world.transform.get(entityId);

    EventBus.getInstance().emit(GameEvents.BOMB_DESTROYED, {
      entityId,
      x: t?.x ?? 0,
      y: t?.y ?? 0,
      byAbility,
      playerDamage: Data.fallingBomb.playerDamage,
      resetCombo: Data.fallingBomb.resetCombo,
    });

    this.destroyBombEntity(entityId);
  }

  getActiveCount(): number {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of this.world.query(C_FallingBomb)) {
      count++;
    }
    return count;
  }

  clear(): void {
    const toRemove: EntityId[] = [];
    for (const [entityId] of this.world.query(C_FallingBomb)) {
      toRemove.push(entityId);
    }
    for (const entityId of toRemove) {
      this.destroyBombEntity(entityId);
    }
    this.lastSpawnTime = -FALLING_BOMB.COOLDOWN;
    this.timeSinceLastCheck = 0;
  }

  destroy(): void {
    // No event listeners to clean up (system is pipeline-managed)
  }

  private onMissed(entityId: EntityId): void {
    if (!this.world.isActive(entityId)) return;

    const t = this.world.transform.get(entityId);
    EventBus.getInstance().emit(GameEvents.BOMB_MISSED, {
      entityId,
      x: t?.x ?? 0,
      y: t?.y ?? 0,
    });
    this.destroyBombEntity(entityId);
  }

  private destroyBombEntity(entityId: EntityId): void {
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      if (node.spawnTween) {
        node.spawnTween.stop();
        node.spawnTween = null;
      }
      const entity = node.container;
      entity.setVisible(false);
      entity.setActive(false);
      this.entityPoolManager.release('fallingBomb', entity as Entity);
    }
    this.world.destroyEntity(entityId);
  }

  private getWaveMaxActive(): number {
    const s = Data.fallingBomb.scaling;
    const wave = this.world.context.currentWave;
    return Math.min(Math.floor(s.maxActiveBase + wave * s.maxActivePerWave), s.maxActiveCap);
  }

  private getWaveSpawnChance(): number {
    const s = Data.fallingBomb.scaling;
    const wave = this.world.context.currentWave;
    return s.spawnChanceBase + (wave - 1) * s.spawnChancePerWave;
  }

  private checkSpawning(delta: number, gameTime: number): void {
    if (gameTime < this.lastSpawnTime + FALLING_BOMB.COOLDOWN) {
      return;
    }

    if (this.getActiveCount() >= this.getWaveMaxActive()) {
      return;
    }

    this.timeSinceLastCheck += delta;
    if (this.timeSinceLastCheck < FALLING_BOMB.CHECK_INTERVAL) {
      return;
    }
    this.timeSinceLastCheck = 0;

    if (Math.random() < this.getWaveSpawnChance()) {
      this.spawnBomb(gameTime);
    }
  }

  private spawnBomb(gameTime: number): void {
    const margin = Data.fallingBomb.spawnMargin;
    const x = Phaser.Math.Between(margin, GAME_WIDTH - margin);

    // Acquire Entity from pool
    const entity = this.entityPoolManager.acquire('fallingBomb');
    if (!entity) return;

    entity.setPosition(x, -OFFSCREEN_MARGIN);
    entity.reset();

    const container = entity;
    const graphics = entity.getGraphics();

    // Spawn into ECS world
    const archetype = this.world.archetypeRegistry.getRequired('fallingBomb');
    const entityId = this.world.spawnFromArchetype(archetype, {
      fallingBomb: {
        moveSpeed: Data.fallingBomb.moveSpeed,
        blinkPhase: 0,
        fullySpawned: false,
      },
      bombProps: {
        color: Phaser.Display.Color.HexStringToColor(Data.fallingBomb.color).color,
        size: Data.fallingBomb.visualSize,
        playerDamage: Data.fallingBomb.playerDamage,
        resetCombo: Data.fallingBomb.resetCombo,
        destroyedByAbility: false,
      },
      transform: {
        x, y: -OFFSCREEN_MARGIN,
        baseX: x, baseY: -OFFSCREEN_MARGIN,
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
      onComplete: () => {
        const fb = this.world.fallingBomb.get(entityId);
        if (fb) {
          fb.fullySpawned = true;
        }
      },
    });

    // Store spawn tween for cleanup
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      node.spawnTween = spawnTween;
    }

    // Initial draw
    DishRenderer.renderDangerDish(graphics, {
      size: Data.fallingBomb.visualSize,
      blinkPhase: 0,
    });

    EventBus.getInstance().emit(GameEvents.FALLING_BOMB_SPAWNED, {
      x,
      y: -OFFSCREEN_MARGIN,
      moveSpeed: Data.fallingBomb.moveSpeed,
    });

    this.lastSpawnTime = gameTime;
  }
}
