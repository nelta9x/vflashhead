import { Data } from '../data/DataManager';
import { COLORS } from '../data/constants';
import { EventBus, GameEvents } from '../utils/EventBus';
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { resolveBossHpSegmentState } from './bossHpSegments';
import { BossRenderer } from '../effects/BossRenderer';

interface MonsterHpChangedEventData {
  bossId: string;
  current?: number;
  max?: number;
  ratio: number;
  sourceX?: number;
  sourceY?: number;
}

interface MonsterDiedEventData {
  bossId: string;
}

export class Boss extends Phaser.GameObjects.Container {
  private readonly bossId: string;
  private feedbackSystem: FeedbackSystem | null = null;
  private readonly renderer: BossRenderer;
  private readonly movementPhaseX: number;
  private readonly movementPhaseY: number;
  private hpRatio: number = 1;
  private timeElapsed: number = 0;
  private movementTime: number = 0;
  private isDead: boolean = false;
  private frozen: boolean = false;
  private isHitStunned: boolean = false;

  // 아머 설정 (HP바 역할)
  private readonly defaultArmorPieces: number;
  private armorPieceCount: number;
  private currentArmorCount: number;
  private maxHp: number = 0;
  private currentHp: number = 0;
  private hpSlotCount: number = 0;
  private filledHpSlotCount: number = 0;

  // 움직임 관련
  private homeX: number;
  private homeY: number;
  private baseX: number;
  private baseY: number;
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;
  private pushOffsetX: number = 0;
  private pushOffsetY: number = 0;
  private spawnTween: Phaser.Tweens.Tween | null = null;
  private deathTween: Phaser.Tweens.Tween | null = null;
  private reactionTweens: Phaser.Tweens.Tween[] = [];

  // EventBus 리스너 (destroy 시 해제용)
  private readonly onMonsterHpChanged: (...args: unknown[]) => void;
  private readonly onMonsterDied: (...args: unknown[]) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bossId: string,
    feedbackSystem?: FeedbackSystem
  ) {
    super(scene, x, y);
    this.bossId = bossId;
    this.feedbackSystem = feedbackSystem || null;
    this.movementPhaseX = Boss.resolveMovementPhase(`${bossId}:x`);
    this.movementPhaseY = Boss.resolveMovementPhase(`${bossId}:y`);

    this.onMonsterHpChanged = (...args: unknown[]) => {
      const data = args[0] as MonsterHpChangedEventData;
      if (data.bossId !== this.bossId) return;
      const oldFilledSlotCount = this.filledHpSlotCount;

      if (typeof data.max === 'number' && data.max > 0) {
        this.maxHp = Math.floor(data.max);
      }

      if (typeof data.current === 'number') {
        this.currentHp = Math.max(0, Math.floor(data.current));
      } else if (this.maxHp > 0) {
        this.currentHp = Math.round(this.maxHp * data.ratio);
      }

      if (this.maxHp > 0) {
        this.currentHp = Phaser.Math.Clamp(this.currentHp, 0, this.maxHp);
      }

      this.hpRatio = Phaser.Math.Clamp(data.ratio, 0, 1);
      this.refreshArmorSegments();

      if (this.filledHpSlotCount < oldFilledSlotCount) {
        this.onArmorBreak();
      }

      this.onDamage(data.sourceX, data.sourceY);
    };

    this.onMonsterDied = (...args: unknown[]) => {
      const data = args[0] as MonsterDiedEventData | undefined;
      if (!data || data.bossId !== this.bossId) return;
      this.die();
    };

    const config = Data.boss.visual;
    this.defaultArmorPieces = Math.max(1, Math.floor(config.armor.maxPieces));
    this.armorPieceCount = this.defaultArmorPieces;
    this.currentArmorCount = this.defaultArmorPieces;

    // 초기 위치 저장
    this.homeX = x;
    this.homeY = y;
    this.baseX = x;
    this.baseY = y;

    this.renderer = new BossRenderer(scene, this);

    this.setVisible(false);
    this.setAlpha(0);

    scene.add.existing(this);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    EventBus.getInstance().on(GameEvents.MONSTER_HP_CHANGED, this.onMonsterHpChanged);
    EventBus.getInstance().on(GameEvents.MONSTER_DIED, this.onMonsterDied);
  }

  public spawnAt(x: number, y: number): void {
    const config = Data.boss.spawn;
    this.stopAllManagedTweens();
    this.isDead = false;
    this.frozen = false;
    this.isHitStunned = false;
    this.setAlpha(0);
    this.setScale(config.initialScale);
    this.rotation = 0;
    this.hpRatio = 1;
    this.timeElapsed = 0;
    this.movementTime = 0;
    if (this.maxHp <= 0) {
      this.maxHp = this.defaultArmorPieces;
    }
    this.currentHp = this.maxHp;
    this.refreshArmorSegments();

    // 움직임 초기화
    this.homeX = x;
    this.homeY = y;
    this.baseX = x;
    this.baseY = y;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.pushOffsetX = 0;
    this.pushOffsetY = 0;
    this.x = x;
    this.y = y;

    this.setVisible(true);
    this.spawnTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: { from: config.initialScale, to: 1 },
      duration: config.duration,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.scene) return;
        this.spawnTween = null;
      },
    });
  }

  public deactivate(): void {
    this.stopAllManagedTweens();
    this.frozen = false;
    this.isHitStunned = false;
    this.isDead = true;
    this.setVisible(false);
    this.setAlpha(0);
  }

  public getBossId(): string {
    return this.bossId;
  }

  private onDamage(sourceX?: number, sourceY?: number): void {
    if (this.isDead) return;
    const reaction = Data.boss.feedback.hitReaction;
    if (!reaction) return;

    this.renderer.playHitFlash(reaction.flashDuration);

    if (sourceX !== undefined && sourceY !== undefined) {
      // 피격 방향 계산 (소스에서 보스 방향)
      const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
      const pushX = Math.cos(angle) * reaction.pushDistance;
      const pushY = Math.sin(angle) * reaction.pushDistance;

      // 기존 리액션 트윈 제거
      this.stopReactionTweens();

      // 스턴 상태 활성화 (이동 멈춤)
      this.isHitStunned = true;

      // 1. 밀려남 (Push) 및 회전 (Tilt)
      const hitRotation = (sourceX < this.x ? 1 : -1) * reaction.hitRotation;

      this.registerReactionTween(
        this.scene.tweens.add({
          targets: this,
          pushOffsetX: pushX,
          pushOffsetY: pushY,
          rotation: hitRotation,
          duration: reaction.pushDuration,
          ease: reaction.pushEase,
        })
      );

      // 2. 흔들림 (Shake) - 스턴 유지
      this.registerReactionTween(
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
            this.registerReactionTween(
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
              })
            );
          },
        })
      );
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
      BossRenderer.resolveColor(config.bodyColor, COLORS.RED)
    );
  }

  public setFeedbackSystem(feedbackSystem: FeedbackSystem): void {
    this.feedbackSystem = feedbackSystem;
  }

  private die(): void {
    this.stopAllManagedTweens();
    this.isDead = true;
    const deathAnim = Data.boss.feedback.deathAnimation;
    this.deathTween = this.scene.tweens.add({
      targets: this,
      scale: deathAnim.scale,
      alpha: 0,
      duration: deathAnim.duration,
      ease: deathAnim.ease,
      onComplete: () => {
        if (!this.scene) return;
        this.setVisible(false);
        this.deathTween = null;
      },
    });
  }

  private updateMovement(_delta: number): void {
    const mov = Data.boss.movement;

    // movementTime 기반으로 드리프트 적용
    this.baseX =
      this.homeX +
      Math.sin(this.movementTime * mov.drift.xFrequency + this.movementPhaseX) *
        mov.drift.xAmplitude;
    this.baseY =
      this.homeY +
      Math.sin(this.movementTime * mov.drift.yFrequency + this.movementPhaseY) *
        mov.drift.yAmplitude;

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

    this.renderer.render({
      hpRatio: this.hpRatio,
      timeElapsed: this.timeElapsed,
      armorPieceCount: this.armorPieceCount,
      filledArmorPieceCount: this.currentArmorCount,
    });

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

  public override destroy(fromScene?: boolean): void {
    this.stopAllManagedTweens();
    const bus = EventBus.getInstance();
    bus.off(GameEvents.MONSTER_HP_CHANGED, this.onMonsterHpChanged);
    bus.off(GameEvents.MONSTER_DIED, this.onMonsterDied);
    super.destroy(fromScene);
  }

  private refreshArmorSegments(): void {
    const segmentState = resolveBossHpSegmentState(this.currentHp, this.maxHp, {
      defaultPieces: this.defaultArmorPieces,
      hpScale: Data.boss.visual.armor.hpSegments,
    });

    this.hpSlotCount = segmentState.pieceCount;
    this.filledHpSlotCount = segmentState.filledPieces;
    this.armorPieceCount = Math.max(1, this.hpSlotCount);
    this.currentArmorCount = Phaser.Math.Clamp(this.filledHpSlotCount, 0, this.armorPieceCount);
  }

  private static resolveMovementPhase(seed: string): number {
    // bossId 기반 결정적 위상 오프셋: 멀티 보스가 동일 궤적 위상으로 겹치지 않게 함
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const normalized = (hash >>> 0) / 0xffffffff;
    return normalized * Math.PI * 2;
  }

  private registerReactionTween(tween: Phaser.Tweens.Tween): void {
    this.reactionTweens.push(tween);
  }

  private stopReactionTweens(): void {
    this.reactionTweens.forEach((tween) => {
      tween.stop();
      tween.remove();
    });
    this.reactionTweens = [];
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.pushOffsetX = 0;
    this.pushOffsetY = 0;
    this.isHitStunned = false;
  }

  private stopSpawnTween(): void {
    if (!this.spawnTween) return;
    this.spawnTween.stop();
    this.spawnTween.remove();
    this.spawnTween = null;
  }

  private stopDeathTween(): void {
    if (!this.deathTween) return;
    this.deathTween.stop();
    this.deathTween.remove();
    this.deathTween = null;
  }

  private stopAllManagedTweens(): void {
    this.stopSpawnTween();
    this.stopDeathTween();
    this.stopReactionTweens();
  }
}
