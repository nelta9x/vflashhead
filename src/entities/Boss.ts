import { Data } from '../data/DataManager';
import { COLORS } from '../data/constants';
import { EventBus, GameEvents } from '../utils/EventBus';
import { FeedbackSystem } from '../systems/FeedbackSystem';

export class Boss extends Phaser.GameObjects.Container {
  private feedbackSystem: FeedbackSystem | null = null;
  private core: Phaser.GameObjects.Arc;
  private coreLight: Phaser.GameObjects.Arc;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private armorGraphics: Phaser.GameObjects.Graphics;
  private hpRatio: number = 1;
  private timeElapsed: number = 0;
  private movementTime: number = 0;
  private isDead: boolean = false;
  private frozen: boolean = false;
  private isHitStunned: boolean = false;

  // 아머 설정 (HP바 역할)
  private readonly maxArmorPieces: number;
  private currentArmorCount: number;

  // 움직임 관련
  private homeX: number;
  private homeY: number;
  private baseX: number;
  private baseY: number;
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;
  private pushOffsetX: number = 0;
  private pushOffsetY: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, feedbackSystem?: FeedbackSystem) {
    super(scene, x, y);
    this.feedbackSystem = feedbackSystem || null;

    const config = Data.boss.visual;
    this.maxArmorPieces = config.armor.maxPieces;
    this.currentArmorCount = this.maxArmorPieces;

    // 초기 위치 저장
    this.homeX = x;
    this.homeY = y;
    this.baseX = x;
    this.baseY = y;

    // 네온 글로우를 그릴 그래픽스 (가산 혼합)
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.glowGraphics);

    // 중앙 코어 생성
    this.core = scene.add.arc(
      0,
      0,
      config.core.radius,
      0,
      360,
      false,
      COLORS.RED,
      config.core.initialAlpha
    );
    this.add(this.core);

    // 코어 내부 강한 광원
    this.coreLight = scene.add.arc(0, 0, config.core.radius * 0.4, 0, 360, false, 0xffffff, 0.8);
    this.add(this.coreLight);

    // 아머를 그릴 그래픽스
    this.armorGraphics = scene.add.graphics();
    this.add(this.armorGraphics);

    this.setVisible(false);
    this.setAlpha(0);

    scene.add.existing(this);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    EventBus.getInstance().on(GameEvents.MONSTER_HP_CHANGED, (...args: unknown[]) => {
      const data = args[0] as { ratio: number; sourceX?: number; sourceY?: number };
      const oldArmorCount = this.currentArmorCount;
      this.hpRatio = data.ratio;

      // HP 비율에 따른 아머 개수 계산
      this.currentArmorCount = Math.ceil(this.hpRatio * this.maxArmorPieces);

      // 아머가 부서질 때 효과
      if (this.currentArmorCount < oldArmorCount) {
        this.onArmorBreak();
      }

      this.onDamage(data.sourceX, data.sourceY);
    });

    EventBus.getInstance().on(GameEvents.MONSTER_DIED, () => {
      this.die();
    });

    EventBus.getInstance().on(GameEvents.WAVE_STARTED, () => {
      this.spawn();
    });
  }

  private spawn(): void {
    const config = Data.boss.spawn;
    this.isDead = false;
    this.hpRatio = 1;
    this.currentArmorCount = this.maxArmorPieces;

    // 움직임 초기화
    this.baseX = this.homeX;
    this.baseY = this.homeY;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.x = this.homeX;
    this.y = this.homeY;

    this.setVisible(true);

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: { from: config.initialScale, to: 1 },
      duration: config.duration,
      ease: 'Back.easeOut',
    });
  }

  private onDamage(sourceX?: number, sourceY?: number): void {
    if (this.isDead) return;
    const reaction = Data.boss.feedback.hitReaction;
    if (!reaction) return;

    this.scene.tweens.add({
      targets: [this.core, this.coreLight],
      fillAlpha: 1,
      duration: reaction.flashDuration,
      yoyo: true,
      onStart: () => {
        this.core.setFillStyle(0xffffff);
        this.coreLight.setFillStyle(0xffffff);
      },
      onComplete: () => {
        this.core.setFillStyle(COLORS.RED, Data.boss.visual.core.initialAlpha);
        this.coreLight.setFillStyle(0xffffff, 0.8);
      },
    });

    if (sourceX !== undefined && sourceY !== undefined) {
      // 피격 방향 계산 (소스에서 보스 방향)
      const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
      const pushX = Math.cos(angle) * reaction.pushDistance;
      const pushY = Math.sin(angle) * reaction.pushDistance;

      // 기존 리액션 트윈 제거
      this.scene.tweens.killTweensOf(this, false, 'pushOffsetX');
      this.scene.tweens.killTweensOf(this, false, 'pushOffsetY');
      this.scene.tweens.killTweensOf(this, false, 'shakeOffsetX');
      this.scene.tweens.killTweensOf(this, false, 'shakeOffsetY');
      this.scene.tweens.killTweensOf(this, false, 'rotation');

      // 스턴 상태 활성화 (이동 멈춤)
      this.isHitStunned = true;

      // 1. 밀려남 (Push) 및 회전 (Tilt)
      const hitRotation = (sourceX < this.x ? 1 : -1) * reaction.hitRotation;

      this.scene.tweens.add({
        targets: this,
        pushOffsetX: pushX,
        pushOffsetY: pushY,
        rotation: hitRotation,
        duration: reaction.pushDuration,
        ease: reaction.pushEase,
      });

      // 2. 흔들림 (Shake) - 스턴 유지
      this.scene.tweens.add({
        targets: this,
        shakeOffsetX: { from: -reaction.shakeIntensity, to: reaction.shakeIntensity },
        shakeOffsetY: { from: reaction.shakeIntensity, to: -reaction.shakeIntensity },
        duration: reaction.shakeFrequency,
        yoyo: true,
        repeat: Math.floor(reaction.shakeDuration / reaction.shakeFrequency),
        onComplete: () => {
          this.shakeOffsetX = 0;
          this.shakeOffsetY = 0;

          // 3. 흔들림(스턴)이 끝난 후 원래 위치로 복귀
          this.scene.tweens.add({
            targets: this,
            pushOffsetX: 0,
            pushOffsetY: 0,
            rotation: 0,
            duration: reaction.returnDuration,
            ease: reaction.returnEase,
            onComplete: () => {
              this.isHitStunned = false; // 복귀까지 완료되어야 이동 재개
            },
          });
        },
      });
    }
  }

  private onArmorBreak(): void {
    if (!this.feedbackSystem) return;

    const config = Data.boss.visual.armor;
    this.feedbackSystem.onBossArmorBreak(
      this.x,
      this.y,
      config.innerRadius,
      config.radius,
      parseInt(config.bodyColor)
    );
  }

  public setFeedbackSystem(feedbackSystem: FeedbackSystem): void {
    this.feedbackSystem = feedbackSystem;
  }

  private die(): void {
    this.isDead = true;
    this.scene.tweens.add({
      targets: this,
      scale: 1.5,
      alpha: 0,
      duration: 800,
      ease: 'Power2.In',
      onComplete: () => {
        this.setVisible(false);
      },
    });
  }

  private updateMovement(_delta: number): void {
    const mov = Data.boss.movement;

    // movementTime 기반으로 드리프트 적용
    this.baseX =
      this.homeX + Math.sin(this.movementTime * mov.drift.xFrequency) * mov.drift.xAmplitude;
    this.baseY =
      this.homeY + Math.sin(this.movementTime * mov.drift.yFrequency) * mov.drift.yAmplitude;

    // bounds 클램프
    this.baseX = Phaser.Math.Clamp(this.baseX, mov.bounds.minX, mov.bounds.maxX);
    this.baseY = Phaser.Math.Clamp(this.baseY, mov.bounds.minY, mov.bounds.maxY);
  }

  update(delta: number): void {
    if (!this.visible || this.isDead) return;

    const config = Data.boss;
    const dangerLevel = 1 - this.hpRatio;

    // 시각 효과용 시간은 항상 흐름 (펄스, 회전 등)
    this.timeElapsed += delta;

    // frozen이나 hitStunned 상태에서는 이동 관련 시간과 로직을 멈춤
    if (!this.frozen && !this.isHitStunned) {
      this.movementTime += delta;
      this.updateMovement(delta);
    }

    // 코어 연출
    const corePulse =
      config.visual.core.initialAlpha +
      Math.sin(this.timeElapsed * config.visual.core.pulseSpeed * (1 + dangerLevel)) *
        config.visual.core.pulseIntensity;
    this.core.setAlpha(corePulse);
    this.core.setScale(1 + dangerLevel * 0.1);

    // 코어 내부 광원 펄스 (더 빠르게)
    const lightPulse = 0.8 + Math.sin(this.timeElapsed * config.visual.core.pulseSpeed * 2) * 0.2;
    this.coreLight.setAlpha(lightPulse);

    // 그래픽스 갱신
    this.glowGraphics.clear();
    this.armorGraphics.clear();

    this.drawGlow();
    this.drawArmor();

    // 최종 위치 = 기본 위치 + 피격 흔들림 오프셋 + 밀려남 오프셋
    this.x = this.baseX + this.shakeOffsetX + this.pushOffsetX;
    this.y = this.baseY + this.shakeOffsetY + this.pushOffsetY;

    // 위기 시 제자리 진동 (상시)
    if (dangerLevel > config.feedback.vibrationThreshold) {
      const intensity = config.feedback.vibrationIntensity * dangerLevel;
      this.x += (Math.random() - 0.5) * intensity;
      this.y += (Math.random() - 0.5) * intensity;
    }
  }

  freeze(): void {
    this.frozen = true;
  }

  unfreeze(): void {
    this.frozen = false;
  }

  private drawGlow(): void {
    const config = Data.boss.visual;
    const dangerLevel = 1 - this.hpRatio;
    const pulseFactor = 1 + Math.sin(this.timeElapsed * config.core.pulseSpeed) * 0.1;

    // 1. 코어 글로우 (여러 겹)
    if (config.core.glowLevels) {
      config.core.glowLevels.forEach((level) => {
        this.glowGraphics.fillStyle(COLORS.RED, level.alpha * pulseFactor);
        this.glowGraphics.fillCircle(
          0,
          0,
          config.core.radius * level.radius * (1 + dangerLevel * 0.2)
        );
      });
    }

    // 2. 아머 테두리 글로우
    const armor = config.armor;
    const rotation = this.timeElapsed * armor.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / this.maxArmorPieces;
    const glowAlpha = (armor.glowAlpha ?? 0.4) * pulseFactor;
    const glowWidth = armor.glowWidth ?? 4;

    for (let i = 0; i < this.currentArmorCount; i++) {
      const startAngle = rotation + i * pieceAngle + armor.gap;
      const endAngle = rotation + (i + 1) * pieceAngle - armor.gap;

      const p1x = Math.cos(startAngle) * armor.innerRadius;
      const p1y = Math.sin(startAngle) * armor.innerRadius;
      const p2x = Math.cos(endAngle) * armor.innerRadius;
      const p2y = Math.sin(endAngle) * armor.innerRadius;
      const p3x = Math.cos(endAngle) * armor.radius;
      const p3y = Math.sin(endAngle) * armor.radius;
      const p4x = Math.cos(startAngle) * armor.radius;
      const p4y = Math.sin(startAngle) * armor.radius;

      // 테두리 글로우 (두꺼운 선)
      this.glowGraphics.lineStyle(glowWidth, COLORS.RED, glowAlpha);
      this.glowGraphics.strokePoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );
    }
  }

  private drawArmor(): void {
    const config = Data.boss.visual.armor;
    const rotation = this.timeElapsed * config.rotationSpeed;

    const pieceAngle = (Math.PI * 2) / this.maxArmorPieces;

    for (let i = 0; i < this.currentArmorCount; i++) {
      const startAngle = rotation + i * pieceAngle + config.gap;
      const endAngle = rotation + (i + 1) * pieceAngle - config.gap;

      const p1x = Math.cos(startAngle) * config.innerRadius;
      const p1y = Math.sin(startAngle) * config.innerRadius;
      const p2x = Math.cos(endAngle) * config.innerRadius;
      const p2y = Math.sin(endAngle) * config.innerRadius;
      const p3x = Math.cos(endAngle) * config.radius;
      const p3y = Math.sin(endAngle) * config.radius;
      const p4x = Math.cos(startAngle) * config.radius;
      const p4y = Math.sin(startAngle) * config.radius;

      // 아머 본체 (어두운 색)
      this.armorGraphics.fillStyle(parseInt(config.bodyColor), config.bodyAlpha);
      this.armorGraphics.fillPoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );

      // 아머 테두리 (핵심 선)
      this.armorGraphics.lineStyle(2, COLORS.RED, 1);
      this.armorGraphics.strokePoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );

      // 아머 내부 디테일 라인
      this.armorGraphics.lineStyle(1, COLORS.RED, 0.4);
      const midRadius = (config.radius + config.innerRadius) / 2;
      this.armorGraphics.beginPath();
      this.armorGraphics.arc(
        0,
        0,
        midRadius,
        Phaser.Math.RadToDeg(startAngle),
        Phaser.Math.RadToDeg(endAngle)
      );
      this.armorGraphics.strokePath();
    }
  }
}
