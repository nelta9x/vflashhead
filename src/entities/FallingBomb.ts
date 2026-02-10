import Phaser from 'phaser';
import { Data } from '../data/DataManager';
import { Poolable } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';
import { DishRenderer } from '../effects/DishRenderer';

const OFFSCREEN_MARGIN = 40;

export class FallingBomb extends Phaser.GameObjects.Container implements Poolable {
  active: boolean = false;
  private graphics: Phaser.GameObjects.Graphics;
  private moveSpeed: number = Data.fallingBomb.moveSpeed;
  private blinkPhase: number = 0;
  private fullySpawned: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    this.setVisible(false);
    this.setActive(false);
  }

  reset(): void {
    this.blinkPhase = 0;
    this.fullySpawned = false;
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
  }

  spawn(x: number): void {
    this.setPosition(x, -OFFSCREEN_MARGIN);
    this.active = true;
    this.blinkPhase = 0;
    this.fullySpawned = false;

    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.active) return;
        this.fullySpawned = true;
      },
    });

    this.drawBomb();
    EventBus.getInstance().emit(GameEvents.FALLING_BOMB_SPAWNED, {
      x: this.x,
      y: this.y,
      moveSpeed: this.moveSpeed,
    });
  }

  update(delta: number): void {
    if (!this.active) return;

    this.y += (this.moveSpeed * delta) / 1000;

    this.blinkPhase += delta * 0.005;

    const gameHeight = Data.gameConfig.screen.height;
    if (this.y > gameHeight + OFFSCREEN_MARGIN) {
      this.onMissed();
      return;
    }

    this.drawBomb();
  }

  private onMissed(): void {
    if (!this.active) return;

    this.active = false;

    EventBus.getInstance().emit(GameEvents.FALLING_BOMB_MISSED, {
      bomb: this,
    });

    this.deactivate();
  }

  public forceDestroy(byAbility: boolean): void {
    if (!this.active) return;

    this.active = false;

    EventBus.getInstance().emit(GameEvents.FALLING_BOMB_DESTROYED, {
      bomb: this,
      x: this.x,
      y: this.y,
      byAbility,
    });

    this.deactivate();
  }

  public isDangerous(): boolean {
    return true;
  }

  public isFullySpawned(): boolean {
    return this.fullySpawned;
  }

  public getSize(): number {
    return Data.fallingBomb.hitboxSize;
  }

  public getRadius(): number {
    return Data.fallingBomb.hitboxSize;
  }

  private drawBomb(): void {
    DishRenderer.renderDangerDish(this.graphics, {
      size: Data.fallingBomb.visualSize,
      blinkPhase: this.blinkPhase,
    });
  }

  deactivate(): void {
    this.active = false;
    this.fullySpawned = false;
    this.setVisible(false);
    this.setActive(false);
  }
}
