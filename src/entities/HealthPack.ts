import Phaser from 'phaser';
import { COLORS } from '../data/constants';
import { Data } from '../data/DataManager';
import { Poolable } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';

export class HealthPack extends Phaser.GameObjects.Container implements Poolable {
  active: boolean = false;
  private graphics: Phaser.GameObjects.Graphics;
  private velocityY: number = Data.healthPack.fallSpeed;
  private pulsePhase: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // 물리 바디 설정
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(Data.healthPack.hitboxSize);
    body.setOffset(-Data.healthPack.hitboxSize, -Data.healthPack.hitboxSize);

    this.setVisible(false);
    this.setActive(false);
  }

  reset(): void {
    this.pulsePhase = 0;
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
  }

  spawn(x: number): void {
    this.setPosition(x, -40);
    this.active = true;
    this.pulsePhase = 0;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, this.velocityY);

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

  private collect(): void {
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
        this.deactivate();
      },
    });
  }

  private drawHealthPack(): void {
    this.graphics.clear();

    const size = Data.healthPack.visualSize;
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.1; // 펄스 효과
    const crossWidth = size * 0.35;
    const crossLength = size * 0.8;

    // 글로우 효과
    this.graphics.fillStyle(COLORS.GREEN, 0.3);
    this.graphics.fillCircle(0, 0, size * pulse + 8);

    // 외부 원
    this.graphics.fillStyle(COLORS.GREEN, 0.5);
    this.graphics.fillCircle(0, 0, size * pulse);

    // 십자가 (+) 아이콘
    this.graphics.fillStyle(COLORS.WHITE, 1);
    // 가로 막대
    this.graphics.fillRect(
      -crossLength * pulse / 2,
      -crossWidth * pulse / 2,
      crossLength * pulse,
      crossWidth * pulse
    );
    // 세로 막대
    this.graphics.fillRect(
      -crossWidth * pulse / 2,
      -crossLength * pulse / 2,
      crossWidth * pulse,
      crossLength * pulse
    );

    // 테두리
    this.graphics.lineStyle(2, COLORS.GREEN, 1);
    this.graphics.strokeCircle(0, 0, size * pulse);
  }

  update(delta: number): void {
    if (!this.active) return;

    // 펄스 애니메이션
    this.pulsePhase += delta * 0.005;

    // 화면 아래로 벗어남 체크
    const gameHeight = Data.gameConfig.screen.height;
    if (this.y > gameHeight + 40) {
      this.onMissed();
      return;
    }

    this.drawHealthPack();
  }

  private onMissed(): void {
    if (!this.active) return;

    this.active = false;
    this.disableInteractive();
    this.removeAllListeners();

    // 놓침 이벤트 발생 (피드백 없이 조용히 사라짐)
    EventBus.getInstance().emit(GameEvents.HEALTH_PACK_MISSED, {
      pack: this,
    });

    this.deactivate();
  }

  deactivate(): void {
    this.active = false;
    this.setVisible(false);
    this.setActive(false);
    this.disableInteractive();
    this.removeAllListeners();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }
}
