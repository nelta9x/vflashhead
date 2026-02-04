import Phaser from 'phaser';
import { COLORS, DISH_LIFETIME } from '../config/constants';
import { Poolable } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';

interface DishConfig {
  points: number;
  lifetime: number;
  color: number;
  chainReaction?: boolean;
  dangerous?: boolean;
}

const DISH_CONFIGS: Record<string, DishConfig> = {
  basic: { points: 100, lifetime: DISH_LIFETIME.basic, color: COLORS.CYAN },
  golden: { points: 400, lifetime: DISH_LIFETIME.golden, color: COLORS.YELLOW },
  crystal: { points: 250, lifetime: DISH_LIFETIME.crystal, color: COLORS.MAGENTA, chainReaction: true },
  bomb: { points: 0, lifetime: DISH_LIFETIME.bomb, color: COLORS.RED, dangerous: true },
};

export class Dish extends Phaser.GameObjects.Container implements Poolable {
  active: boolean = false;
  private graphics: Phaser.GameObjects.Graphics;
  private dishType: string = 'basic';
  private points: number = 100;
  private lifetime: number = 2000;
  private elapsedTime: number = 0;
  private color: number = COLORS.CYAN;
  private chainReaction: boolean = false;
  private dangerous: boolean = false;
  private wobblePhase: number = 0;
  private size: number = 30;
  private isHovered: boolean = false;
  private blinkPhase: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, _type: string = 'basic') {
    super(scene, x, y);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // 물리 바디 설정
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(30);
    body.setOffset(-30, -30);

    this.setVisible(false);
    this.setActive(false);
  }

  reset(): void {
    this.wobblePhase = 0;
    this.blinkPhase = 0;
    this.elapsedTime = 0;
    this.isHovered = false;
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
  }

  spawn(x: number, y: number, type: string, _speedMultiplier: number = 1): void {
    this.dishType = type;
    const config = DISH_CONFIGS[type] || DISH_CONFIGS.basic;

    this.points = config.points;
    this.lifetime = config.lifetime;
    this.elapsedTime = 0;
    this.blinkPhase = 0;
    this.color = config.color;
    this.chainReaction = config.chainReaction || false;
    this.dangerous = config.dangerous || false;
    this.active = true;
    this.isHovered = false;

    this.size = type === 'bomb' ? 40 : type === 'golden' ? 35 : type === 'crystal' ? 25 : 30;

    this.setPosition(x, y);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(this.size);
    body.setOffset(-this.size, -this.size);

    // 정지 상태 (이동 없음)
    body.setVelocity(0, 0);

    // 클릭 가능하게 설정
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, this.size + 10),
      Phaser.Geom.Circle.Contains
    );
    this.setupClickHandlers();

    // 스폰 애니메이션 (팝업 효과)
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    this.drawDish();
    EventBus.getInstance().emit(GameEvents.DISH_SPAWNED, this);
  }

  private setupClickHandlers(): void {
    // 이전 리스너 제거
    this.removeAllListeners();

    // 호버 시 파괴 (마우스를 대면 바로 파괴)
    this.on('pointerover', () => {
      this.isHovered = true;
      this.destroy_dish();
    });
  }

  private drawDish(): void {
    this.graphics.clear();

    const sides = 8;
    const wobble = Math.sin(this.wobblePhase) * 2;

    // 글로우 효과 (호버 시 더 밝게)
    const glowAlpha = this.isHovered ? 0.4 : 0.2;
    this.graphics.fillStyle(this.color, glowAlpha);
    this.graphics.fillCircle(0, 0, this.size + 10 + wobble);

    // 외곽 팔각형
    this.graphics.fillStyle(this.color, 0.7);
    this.drawPolygon(0, 0, this.size + wobble, sides);
    this.graphics.fillPath();

    // 외곽선 (호버 시 더 굵게)
    const lineWidth = this.isHovered ? 4 : 3;
    this.graphics.lineStyle(lineWidth, this.color, 1);
    this.drawPolygon(0, 0, this.size + wobble, sides);
    this.graphics.strokePath();

    // 내부 원
    this.graphics.lineStyle(2, COLORS.WHITE, 0.4);
    this.graphics.strokeCircle(0, 0, this.size * 0.5);

    // 위험한 접시 표시
    if (this.dangerous) {
      this.graphics.lineStyle(2, COLORS.WHITE, 0.8);
      this.graphics.strokeCircle(0, 0, this.size * 0.3);
      this.graphics.fillStyle(COLORS.WHITE, 0.8);
      this.graphics.fillCircle(0, 5, 3);
      this.graphics.fillRect(-2, -8, 4, 8);
    }
  }

  private drawPolygon(cx: number, cy: number, radius: number, sides: number): void {
    this.graphics.beginPath();

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) {
        this.graphics.moveTo(x, y);
      } else {
        this.graphics.lineTo(x, y);
      }
    }

    this.graphics.closePath();
  }

  update(delta: number = 16.67): void {
    if (!this.active) return;

    // 시간 경과
    this.elapsedTime += delta;

    // 타임아웃 체크
    if (this.elapsedTime >= this.lifetime) {
      this.onTimeout();
      return;
    }

    // 좌우 흔들림
    this.wobblePhase += 0.1;

    // 30% 미만일 때 깜빡임 효과
    const timeRatio = this.getTimeRatio();
    if (timeRatio < 0.3) {
      this.blinkPhase += 0.3;
      const blinkAlpha = 0.5 + Math.sin(this.blinkPhase) * 0.5;
      this.setAlpha(blinkAlpha);
    }

    this.drawDish();
  }

  private onTimeout(): void {
    if (!this.active) return;

    this.active = false;

    // DISH_MISSED 이벤트 발생
    EventBus.getInstance().emit(GameEvents.DISH_MISSED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      isDangerous: this.dangerous,
    });

    // 사라지는 애니메이션
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        this.deactivate();
      },
    });
  }

  getTimeRatio(): number {
    return Math.max(0, 1 - this.elapsedTime / this.lifetime);
  }

  getLifetime(): number {
    return this.lifetime;
  }

  private destroy_dish(): void {
    this.active = false;

    // 인터랙티브 제거
    this.disableInteractive();
    this.removeAllListeners();

    EventBus.getInstance().emit(GameEvents.DISH_DESTROYED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      chainReaction: this.chainReaction,
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

  getPoints(): number {
    return this.points;
  }

  getColor(): number {
    return this.color;
  }

  getDishType(): string {
    return this.dishType;
  }

  isChainReaction(): boolean {
    return this.chainReaction;
  }

  isDangerous(): boolean {
    return this.dangerous;
  }

  getSize(): number {
    return this.size;
  }
}
