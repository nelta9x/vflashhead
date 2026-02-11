import Phaser from 'phaser';
import { GAME_WIDTH, FALLING_BOMB } from '../data/constants';
import { Data } from '../data/DataManager';
import { DishRenderer } from '../effects/DishRenderer';
import { EventBus, GameEvents } from '../utils/EventBus';
import { C_FallingBomb, C_Transform } from '../world';
import type { World } from '../world';
import type { EntitySystem } from './entity-systems/EntitySystem';

const OFFSCREEN_MARGIN = 40;

export class FallingBombSystem implements EntitySystem {
  readonly id = 'core:falling_bomb';
  enabled = true;

  private readonly world: World;
  private readonly scene: Phaser.Scene;
  private lastSpawnTime: number = -FALLING_BOMB.COOLDOWN;
  private timeSinceLastCheck: number = 0;
  private spawnCounter: number = 0;

  // Context set before tick
  private _gameTime = 0;
  private _currentWave = 0;

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  setContext(gameTime: number, currentWave: number): void {
    this._gameTime = gameTime;
    this._currentWave = currentWave;
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
    if (this._currentWave >= FALLING_BOMB.MIN_WAVE) {
      this.checkSpawning(delta, this._gameTime);
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

  forceDestroy(entityId: string, byAbility: boolean): void {
    if (!this.world.isActive(entityId)) return;

    const t = this.world.transform.get(entityId);

    EventBus.getInstance().emit(GameEvents.FALLING_BOMB_DESTROYED, {
      x: t?.x ?? 0,
      y: t?.y ?? 0,
      byAbility,
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
    const toRemove: string[] = [];
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

  private onMissed(entityId: string): void {
    if (!this.world.isActive(entityId)) return;

    EventBus.getInstance().emit(GameEvents.FALLING_BOMB_MISSED);
    this.destroyBombEntity(entityId);
  }

  private destroyBombEntity(entityId: string): void {
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      node.container.setVisible(false);
      node.container.setActive(false);
    }
    this.world.destroyEntity(entityId);
  }

  private checkSpawning(delta: number, gameTime: number): void {
    if (gameTime < this.lastSpawnTime + FALLING_BOMB.COOLDOWN) {
      return;
    }

    if (this.getActiveCount() >= FALLING_BOMB.MAX_ACTIVE) {
      return;
    }

    this.timeSinceLastCheck += delta;
    if (this.timeSinceLastCheck < FALLING_BOMB.CHECK_INTERVAL) {
      return;
    }
    this.timeSinceLastCheck = 0;

    if (Math.random() < FALLING_BOMB.BASE_SPAWN_CHANCE) {
      this.spawnBomb(gameTime);
    }
  }

  private spawnBomb(gameTime: number): void {
    const margin = Data.fallingBomb.spawnMargin;
    const x = Phaser.Math.Between(margin, GAME_WIDTH - margin);
    const entityId = `falling_bomb_${++this.spawnCounter}`;

    // Create Phaser container + graphics
    const container = this.scene.add.container(x, -OFFSCREEN_MARGIN);
    const graphics = this.scene.add.graphics();
    container.add(graphics);

    // Spawn into ECS world
    const archetype = this.world.archetypeRegistry.getRequired('fallingBomb');
    this.world.spawnFromArchetype(archetype, entityId, {
      fallingBomb: {
        moveSpeed: Data.fallingBomb.moveSpeed,
        blinkPhase: 0,
        fullySpawned: false,
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
      },
    });

    // Spawn animation
    container.setScale(0);
    container.setAlpha(0);
    this.scene.tweens.add({
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
