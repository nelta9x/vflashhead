import Phaser from 'phaser';
import { Data } from '../data/DataManager';
import { Poolable } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';
import { HealthPackRenderer } from '../effects/HealthPackRenderer';

const OFFSCREEN_MARGIN = 40;

export class HealthPack extends Phaser.GameObjects.Container implements Poolable {
  active: boolean = false;
  private graphics: Phaser.GameObjects.Graphics;
  private moveSpeed: number = Data.healthPack.moveSpeed;
  private pulsePhase: number = 0;
  private hasPreMissWarningEmitted: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    this.setVisible(false);
    this.setActive(false);
  }

  reset(): void {
    this.pulsePhase = 0;
    this.hasPreMissWarningEmitted = false;
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
  }

  spawn(x: number): void {
    const gameHeight = Data.gameConfig.screen.height;
    this.setPosition(x, gameHeight + OFFSCREEN_MARGIN);
    this.active = true;
    this.pulsePhase = 0;
    this.hasPreMissWarningEmitted = false;

    // 클릭 가능하게 설정 (관대한 히트박스)
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, Data.healthPack.hitboxSize),
      Phaser.Geom.Circle.Contains
    );
    this.setupClickHandlers();

    // 스폰 애니메이션
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.drawHealthPack();
    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_SPAWNED, this);
  }

  private setupClickHandlers(): void {
    this.removeAllListeners();

    // 호버 시 수집 (마우스를 대면 바로 수집)
    this.on('pointerover', () => {
      this.collect();
    });
  }

  public collect(): void {
    if (!this.active) return;

    this.active = false;
    this.disableInteractive();
    this.removeAllListeners();

    // 수집 이벤트 발생
    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_COLLECTED, {
      pack: this,
      x: this.x,
      y: this.y,
    });

    // 수집 애니메이션
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        if (!this.active && !this.visible) return;
        this.deactivate();
      },
    });
  }

  public getRadius(): number {
    return Data.healthPack.hitboxSize;
  }

  private drawHealthPack(): void {
    HealthPackRenderer.render(this.graphics, {
      size: Data.healthPack.visualSize,
      pulsePhase: this.pulsePhase,
    });
  }

  update(delta: number): void {
    if (!this.active) return;

    // 프레임 레이트와 무관하게 일정한 이동 속도(px/sec)를 유지
    this.y -= (this.moveSpeed * delta) / 1000;

    // 펄스 애니메이션
    this.pulsePhase += delta * 0.005;

    this.emitPreMissWarningIfNeeded();

    // 화면 위로 벗어남 체크
    if (this.y < -OFFSCREEN_MARGIN) {
      this.onMissed();
      return;
    }

    this.drawHealthPack();
  }

  private onMissed(): void {
    if (!this.active) return;

    this.active = false;
    this.hasPreMissWarningEmitted = false;
    this.disableInteractive();
    this.removeAllListeners();

    // 놓침 이벤트 발생 (피드백 없이 조용히 사라짐)
    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_MISSED, {
      pack: this,
    });

    this.deactivate();
  }

  private emitPreMissWarningIfNeeded(): void {
    if (this.hasPreMissWarningEmitted) {
      return;
    }

    const warningDistance = Data.healthPack.preMissWarningDistance;
    if (warningDistance <= 0) {
      return;
    }

    const warningThresholdY = -OFFSCREEN_MARGIN + warningDistance;
    if (this.y > warningThresholdY) {
      return;
    }

    this.hasPreMissWarningEmitted = true;
    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_PASSING, {
      x: this.x,
      y: this.y,
    });
  }

  deactivate(): void {
    this.active = false;
    this.hasPreMissWarningEmitted = false;
    this.setVisible(false);
    this.setActive(false);
    this.disableInteractive();
    this.removeAllListeners();
  }
}
