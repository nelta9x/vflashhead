import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  CURSOR_HITBOX,
  SPAWN_AREA,
  MAGNET,
} from '../data/constants';
import { Data } from '../data/DataManager';
import { Dish } from '../entities/Dish';
import { Boss } from '../entities/Boss';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { ComboSystem } from '../systems/ComboSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { HealthPackSystem } from '../systems/HealthPackSystem';
import { HUD } from '../ui/HUD';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { SlowMotion } from '../effects/SlowMotion';
import { DamageText } from '../ui/DamageText';
import { CursorTrail } from '../effects/CursorTrail';
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { MonsterSystem } from '../systems/MonsterSystem';
import { GaugeSystem } from '../systems/GaugeSystem';
import { InGameUpgradeUI } from '../ui/InGameUpgradeUI';
import { WaveCountdownUI } from '../ui/WaveCountdownUI';
import { AbilityPanel } from '../ui/AbilityPanel';

export class GameScene extends Phaser.Scene {
  private dishPool!: ObjectPool<Dish>;
  private dishes!: Phaser.GameObjects.Group;

  // 시스템
  private comboSystem!: ComboSystem;
  private waveSystem!: WaveSystem;
  private upgradeSystem!: UpgradeSystem;
  private healthSystem!: HealthSystem;
  private healthPackSystem!: HealthPackSystem;
  private feedbackSystem!: FeedbackSystem;
  private soundSystem!: SoundSystem;
  private monsterSystem!: MonsterSystem;
  private gaugeSystem!: GaugeSystem;

  // UI & 이펙트
  private hud!: HUD;
  private boss!: Boss;
  private inGameUpgradeUI!: InGameUpgradeUI;
  private waveCountdownUI!: WaveCountdownUI;
  private abilityPanel!: AbilityPanel;
  private particleManager!: ParticleManager;
  private screenShake!: ScreenShake;
  private slowMotion!: SlowMotion;
  private damageText!: DamageText;
  private cursorTrail!: CursorTrail;

  // 게임 상태
  private gameTime: number = 0;
  private isGameOver: boolean = false;
  private isPaused: boolean = false;
  private gaugeRatio: number = 0;

  // 웨이브 전환 상태
  private pendingWaveNumber: number = 1;

  // 공격 범위 표시
  private attackRangeIndicator!: Phaser.GameObjects.Graphics;

  // 그리드 배경
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private gridOffset: number = 0;

  // 보스 레이저 공격 관련
  private laserNextTime: number = 0;
  private laserGraphics!: Phaser.GameObjects.Graphics;
  private activeLasers: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isFiring: boolean;
    isWarning: boolean;
    startTime: number;
  }> = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isGameOver = false;
    this.isPaused = false;
    this.gameTime = 0;
    this.activeLasers = [];

    // 배경 생성
    this.createBackground();

    // Phaser 그룹 생성
    this.dishes = this.add.group();

    // 시스템 초기화
    this.initializeSystems();

    // 엔티티 초기화
    this.initializeEntities();

    // 이벤트 리스너 설정
    this.setupEventListeners();

    // 입력 설정
    this.setupInput();

    // 첫 레이저 시간 설정
    this.setNextLaserTime();

    // 게임 시작: 첫 웨이브 바로 시작 (카운트다운 없음)
    this.waveSystem.startWave(1);

    // 카메라 페이드 인
    this.cameras.main.fadeIn(500);

    // 게임 커서 설정 (숨김 - 커스텀 인디케이터 사용)
    this.input.setDefaultCursor('none');

    // 공격 범위 인디케이터 생성
    this.attackRangeIndicator = this.add.graphics();
    this.attackRangeIndicator.setDepth(1000); // 최상위에 표시
  }

  private createBackground(): void {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(-1); // 배경이므로 가장 뒤에 배치
  }

  private updateGrid(delta: number): void {
    const config = Data.gameConfig.gameGrid;
    this.gridGraphics.clear();

    const color = Phaser.Display.Color.HexStringToColor(config.color).color;
    this.gridGraphics.lineStyle(1, color, config.alpha);

    // 수직선
    for (let x = 0; x <= GAME_WIDTH; x += config.size) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, GAME_HEIGHT);
    }

    // 수평선 (상하로 흐름)
    this.gridOffset += delta * config.speed;
    if (this.gridOffset >= config.size) {
      this.gridOffset -= config.size;
    }

    for (let y = this.gridOffset - config.size; y <= GAME_HEIGHT; y += config.size) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(GAME_WIDTH, y);
    }

    this.gridGraphics.strokePath();
  }

  private initializeSystems(): void {
    // 이전 게임의 이벤트 리스너 정리 (재시작 시 중복 방지)
    EventBus.getInstance().clear();

    this.comboSystem = new ComboSystem();
    this.upgradeSystem = new UpgradeSystem();

    // 인게임 업그레이드 UI (WaveSystem보다 먼저 생성)
    this.inGameUpgradeUI = new InGameUpgradeUI(this, this.upgradeSystem);

    this.waveSystem = new WaveSystem(
      this,
      () => this.dishPool,
      () =>
        this.inGameUpgradeUI.isVisible() ? this.inGameUpgradeUI.getBlockedYArea() : SPAWN_AREA.maxY,
      () => this.boss
    );
    this.healthSystem = new HealthSystem();
    this.healthPackSystem = new HealthPackSystem(this);
    this.monsterSystem = new MonsterSystem();
    this.gaugeSystem = new GaugeSystem(this.comboSystem);

    // 이펙트 시스템
    this.particleManager = new ParticleManager(this);
    this.screenShake = new ScreenShake(this);
    this.slowMotion = new SlowMotion(this);
    this.damageText = new DamageText(this);
    this.cursorTrail = new CursorTrail(this);
    this.soundSystem = SoundSystem.getInstance();
    this.feedbackSystem = new FeedbackSystem(
      this,
      this.particleManager,
      this.screenShake,
      this.slowMotion,
      this.damageText,
      this.soundSystem
    );

    // HUD
    this.hud = new HUD(this, this.waveSystem, this.healthSystem);

    // 웨이브 카운트다운 UI
    this.waveCountdownUI = new WaveCountdownUI(this);

    // 어빌리티 패널 (DOM 기반)
    this.abilityPanel = new AbilityPanel();
    this.abilityPanel.setUpgradeSystem(this.upgradeSystem);
  }

  private initializeEntities(): void {
    // 오브젝트 풀 생성
    this.dishPool = new ObjectPool<Dish>(() => new Dish(this, 0, 0, 'basic'), 10, 50);

    // 보스 생성 (화면 상단 중앙)
    this.boss = new Boss(this, GAME_WIDTH / 2, 100);
    this.boss.setDepth(100);

    // 레이저 그래픽 초기화
    this.laserGraphics = this.add.graphics();
    this.laserGraphics.setDepth(1500);
  }

  private setupEventListeners(): void {
    // 접시 파괴 이벤트
    EventBus.getInstance().on(GameEvents.DISH_DESTROYED, (...args: unknown[]) => {
      const data = args[0] as { dish: Dish; x: number; y: number; chainReaction: boolean };
      this.onDishDestroyed(data);
    });

    // 접시 데미지 이벤트
    EventBus.getInstance().on(GameEvents.DISH_DAMAGED, (...args: unknown[]) => {
      const data = args[0] as {
        dish: Dish;
        x: number;
        y: number;
        type: string;
        damage: number;
        currentHp: number;
        maxHp: number;
        hpRatio: number;
        isFirstHit: boolean;
      };
      this.onDishDamaged(data);
    });

    // 콤보 마일스톤
    EventBus.getInstance().on(GameEvents.COMBO_MILESTONE, (...args: unknown[]) => {
      const milestone = args[0] as number;
      this.feedbackSystem.onComboMilestone(milestone);
    });

    // 웨이브 완료
    EventBus.getInstance().on(GameEvents.WAVE_COMPLETED, (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.hud.showWaveComplete(waveNumber);

      // 다음 웨이브 번호 저장 후 카운트다운과 업그레이드 UI 동시 표시
      this.pendingWaveNumber = waveNumber + 1;
      this.time.delayedCall(500, () => {
        if (this.isGameOver) return;
        // 카운트다운과 업그레이드 UI 동시 시작
        this.waveSystem.startCountdown(this.pendingWaveNumber);
        this.waveCountdownUI.show(this.pendingWaveNumber);
        this.inGameUpgradeUI.show();
      });
    });

    // 업그레이드 선택 완료
    EventBus.getInstance().on(GameEvents.UPGRADE_SELECTED, () => {
      // 어빌리티 패널 업데이트
      EventBus.getInstance().emit(
        GameEvents.UPGRADES_CHANGED,
        this.upgradeSystem.getAllUpgradeStacks()
      );
    });

    // 카운트다운 틱
    EventBus.getInstance().on(GameEvents.WAVE_COUNTDOWN_TICK, (...args: unknown[]) => {
      const seconds = args[0] as number;
      this.waveCountdownUI.updateCountdown(seconds);
    });

    // 웨이브 준비 완료 (카운트다운 끝)
    EventBus.getInstance().on(GameEvents.WAVE_READY, () => {
      this.waveCountdownUI.hide();
    });

    // 게임 오버
    EventBus.getInstance().on(GameEvents.GAME_OVER, () => {
      this.gameOver();
    });

    // 접시 타임아웃 (놓침) 이벤트
    EventBus.getInstance().on(GameEvents.DISH_MISSED, (...args: unknown[]) => {
      const data = args[0] as {
        dish: Dish;
        x: number;
        y: number;
        type: string;
        isDangerous: boolean;
      };
      this.onDishMissed(data);
    });

    // HP 변경 이벤트
    EventBus.getInstance().on(GameEvents.HP_CHANGED, (...args: unknown[]) => {
      const data = args[0] as { hp: number; maxHp: number; delta: number; isFullHeal?: boolean };

      if (data.isFullHeal) {
        this.healthSystem.reset();
        this.feedbackSystem.onHealthPackCollected(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        return;
      }

      if (data.delta < 0) {
        this.hud.showHpLoss();
        this.feedbackSystem.onHpLost();
      }
    });

    // 힐팩 수집 이벤트
    EventBus.getInstance().on(GameEvents.HEALTH_PACK_COLLECTED, (...args: unknown[]) => {
      const data = args[0] as { pack: unknown; x: number; y: number };
      this.onHealthPackCollected(data.x, data.y);
    });

    // 몬스터 HP 변경
    EventBus.getInstance().on(GameEvents.MONSTER_HP_CHANGED, () => {
      // 보스 엔티티가 내부적으로 이 이벤트를 구독하여 원형 게이지를 업데이트함
    });

    // 플레이어 게이지 업데이트
    EventBus.getInstance().on(GameEvents.GAUGE_UPDATED, (...args: unknown[]) => {
      const data = args[0] as { current: number; max: number; ratio: number };
      this.gaugeRatio = data.ratio;
    });

    // 플레이어 공격 트리거
    EventBus.getInstance().on(GameEvents.PLAYER_ATTACK, () => {
      this.performPlayerAttack();
    });

    // 몬스터 사망 -> 웨이브 클리어
    EventBus.getInstance().on(GameEvents.MONSTER_DIED, () => {
      this.waveSystem.forceCompleteWave();
    });
  }

  private onHealthPackCollected(x: number, y: number): void {
    // HP 회복
    this.healthSystem.heal(1);
    // 피드백 효과
    this.feedbackSystem.onHealthPackCollected(x, y);
  }

  private performPlayerAttack(): void {
    const pointer = this.input.activePointer;
    const endX = GAME_WIDTH / 2;
    const endY = 80; // Approximate boss pos
    const config = Data.feedback.bossAttack;

    // 색상 변환
    const mainColor = Phaser.Display.Color.HexStringToColor(config.mainColor).color;
    const accentColor = Phaser.Display.Color.HexStringToColor(config.accentColor).color;

    // 1. Charge Phase (에네르기파 스타일 기 모으기)
    const chargeDuration = config.charge.duration;

    // 사운드 재생: 기 모으기
    this.soundSystem.playBossChargeSound();

    // 발사체 생성 (빛나는 구체 느낌)
    const projectile = this.add.circle(
      pointer.worldX,
      pointer.worldY,
      config.charge.initialRadius,
      mainColor
    );
    projectile.setDepth(2000);
    this.physics.add.existing(projectile);

    // 글로우 효과 (외부 광원)
    const glow = this.add.graphics();
    glow.setDepth(1999);

    // 기 모으는 파티클 이미터 (주변에서 중심으로 모여듦)
    const chargeParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: -100, max: -300 }, // 음수 속도로 중심으로 모이게 함
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      blendMode: 'ADD',
      tint: accentColor,
      emitting: true,
      frequency: config.charge.particleFrequency,
    });
    chargeParticles.setDepth(1998);

    // 찌지직거리는 전기 스파크용 그래픽
    const lightning = this.add.graphics();
    lightning.setDepth(2001);

    // 기 모으기 애니메이션
    this.tweens.add({
      targets: { progress: 0 },
      progress: 1,
      duration: chargeDuration,
      ease: 'Linear',
      onUpdate: (_tween, target) => {
        const p = target.progress;
        const curX = pointer.worldX;
        const curY = pointer.worldY;

        // 위치 동기화
        projectile.setPosition(curX, curY);
        projectile.setScale(1 + p * (config.charge.maxScale - 1)); // 점점 커짐
        chargeParticles.setPosition(curX, curY);

        // 글로우 연출
        glow.clear();
        glow.fillStyle(mainColor, config.charge.glowInitialAlpha * p);
        glow.fillCircle(
          curX,
          curY,
          config.charge.glowInitialRadius +
            p * (config.charge.glowMaxRadius - config.charge.glowInitialRadius)
        );
        glow.fillStyle(COLORS.WHITE, 0.5 * p);
        glow.fillCircle(curX, curY, 10 + p * 20);

        // 찌지직! 전기 스파크 연출 (p가 높을수록 빈번)
        lightning.clear();
        if (
          Math.random() <
          config.charge.lightningChanceBase + p * config.charge.lightningChanceP
        ) {
          lightning.lineStyle(2, accentColor, 0.8);
          const segments = config.charge.lightningSegments;
          let lastX = curX + (Math.random() - 0.5) * 100 * (1 - p / 2);
          let lastY = curY + (Math.random() - 0.5) * 100 * (1 - p / 2);

          lightning.beginPath();
          lightning.moveTo(lastX, lastY);
          for (let i = 1; i <= segments; i++) {
            const tx = curX + (Math.random() - 0.5) * 10 * p;
            const ty = curY + (Math.random() - 0.5) * 10 * p;
            const nextX = lastX + (tx - lastX) * (i / segments) + (Math.random() - 0.5) * 20;
            const nextY = lastY + (ty - lastY) * (i / segments) + (Math.random() - 0.5) * 20;
            lightning.lineTo(nextX, nextY);
            lastX = nextX;
            lastY = nextY;
          }
          lightning.strokePath();
        }
      },
      onComplete: () => {
        glow.destroy();
        lightning.destroy();
        chargeParticles.destroy();
        projectile.destroy(); // 기존 충전용 구체 제거

        // 2. Fire Phase (순차적 발사!)
        const missileCount = 1 + this.upgradeSystem.getMissileLevel();
        const fireX = pointer.worldX;
        const fireY = pointer.worldY;

        for (let i = 0; i < missileCount; i++) {
          this.time.delayedCall(i * config.fire.missileInterval, () => {
            this.fireSequentialMissile(fireX, fireY, endX, endY, i, missileCount);
          });
        }
      },
    });
  }

  // 순차적 미사일 발사 로직
  private fireSequentialMissile(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    index: number,
    total: number
  ): void {
    const config = Data.feedback.bossAttack;
    const mainColor = Phaser.Display.Color.HexStringToColor(config.mainColor).color;
    const innerTrailColor = Phaser.Display.Color.HexStringToColor(config.innerTrailColor).color;

    // 회차가 거듭될수록 더 빠르고 강렬해짐
    const intensity = (index + 1) / total;
    const speed = config.fire.duration * (1 - intensity * 0.3); // 최대 30% 더 빨라짐

    // 궤적 변화: 시작점과 타겟점에 약간의 랜덤 오프셋 부여
    const offsetRange = 30 * intensity;
    const curStartX = startX + Phaser.Math.Between(-offsetRange, offsetRange);
    const curStartY = startY + Phaser.Math.Between(-offsetRange, offsetRange);
    const curTargetX = targetX + Phaser.Math.Between(-20, 20);
    const curTargetY = targetY + Phaser.Math.Between(-10, 10);

    // 미사일 객체 생성
    const missile = this.add.circle(curStartX, curStartY, 8 + 4 * intensity, mainColor);
    missile.setDepth(2000);

    // 사운드: 점점 피치가 높아지는 발사음
    this.soundSystem.playBossFireSound(); // Note: SoundSystem에 피치 조절 기능이 없으므로 기본음 사용

    // 발사 이펙트
    this.particleManager.createSparkBurst(curStartX, curStartY, mainColor);

    let lastTrailX = curStartX;
    let lastTrailY = curStartY;

    this.tweens.add({
      targets: missile,
      x: curTargetX,
      y: curTargetY,
      duration: speed,
      ease: 'Expo.In',
      onUpdate: () => {
        const curX = missile.x;
        const curY = missile.y;

        const trail = this.add.graphics();
        trail.setDepth(1997);

        // 강렬함에 따라 트레일 두께 조절
        const baseWidth = missile.displayWidth * config.fire.trailWidthMultiplier;
        const trailWidth = baseWidth * (0.8 + 0.5 * intensity);

        trail.lineStyle(trailWidth, mainColor, config.fire.trailAlpha);
        trail.lineBetween(lastTrailX, lastTrailY, curX, curY);

        trail.lineStyle(trailWidth * 0.4, innerTrailColor, config.fire.trailAlpha * 1.5);
        trail.lineBetween(lastTrailX, lastTrailY, curX, curY);

        lastTrailX = curX;
        lastTrailY = curY;

        this.tweens.add({
          targets: trail,
          alpha: 0,
          duration: config.fire.trailLifespan,
          onComplete: () => trail.destroy(),
        });
      },
      onComplete: () => {
        missile.destroy();

        // 데미지 1 + 업그레이드 보너스 적용
        const totalDamage = 1 + this.upgradeSystem.getCursorDamageBonus();
        this.monsterSystem.takeDamage(totalDamage);

        // 타격 피드백 (마지막 발사일수록 더 강하게)
        if (index === total - 1) {
          this.feedbackSystem.onBossDamaged(curTargetX, curTargetY, total);
          // 마지막 발사 시 카메라 효과 강화
          this.cameras.main.shake(config.impact.shakeDuration, config.impact.shakeIntensity * 1.5);
        } else {
          // 중간 발사체 타격 효과
          this.particleManager.createHitEffect(curTargetX, curTargetY, COLORS.WHITE);
          this.particleManager.createExplosion(curTargetX, curTargetY, mainColor, 'basic', 0.5);
          this.soundSystem.playHitSound();
        }
      },
    });
  }

  private onDishDamaged(data: {
    dish: Dish;
    x: number;
    y: number;
    type: string;
    damage: number;
    currentHp: number;
    maxHp: number;
    hpRatio: number;
    isFirstHit: boolean;
  }): void {
    const { x, y, damage, hpRatio } = data;
    const combo = this.comboSystem.getCombo();
    this.feedbackSystem.onDishDamaged(x, y, damage, hpRatio, data.dish.getColor(), combo);
  }

  private onDishMissed(data: {
    dish: Dish;
    x: number;
    y: number;
    type: string;
    isDangerous: boolean;
  }): void {
    const { dish, x, y, isDangerous } = data;

    // 지뢰 타임아웃: 조용히 사라짐 (피드백/패널티 없음)
    if (isDangerous) {
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // 일반 접시 놓침: 피드백 + HP 감소 + 콤보 리셋
    this.feedbackSystem.onDishMissed(x, y, dish.getColor(), dish.getDishType());
    this.healthSystem.takeDamage(1);
    this.comboSystem.reset();

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  private setupInput(): void {
    // ESC로 일시정지
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isGameOver) return;
      if (this.isPaused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
    });
  }

  private onDishDestroyed(data: { dish: Dish; x: number; y: number }): void {
    const { dish, x, y } = data;

    // 지뢰(Bomb) 터짐
    if (dish.isDangerous()) {
      // HP 1 감소
      this.healthSystem.takeDamage(1);
      // 콤보 리셋
      this.comboSystem.reset();
      // 피드백 효과 (폭발)
      this.feedbackSystem.onBombExploded(x, y);

      // 풀에서 제거
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // ===== 레이저 보너스 체크 =====
    const laserConfig = Data.gameConfig.monsterAttack.laser;
    const isLaserFiring = this.activeLasers.some((l) => l.isFiring);
    const comboBonus = isLaserFiring ? laserConfig.bonus.comboAmount : 0; // 레이저 발사 중 보너스

    // 콤보 증가
    this.comboSystem.increment(comboBonus);

    // 보너스 피드백
    if (isLaserFiring) {
      this.damageText.showText(x, y - 40, 'LASER BONUS!', COLORS.YELLOW);
      this.soundSystem.playBossImpactSound(); // 보너스 느낌의 소리
    }

    // 현재 커서 반경 계산
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 피드백 효과
    this.feedbackSystem.onDishDestroyed(
      x,
      y,
      dish.getColor(),
      dish.getDishType(),
      this.comboSystem.getCombo(),
      cursorRadius
    );

    // ===== 업그레이드 효과 적용 =====
    // 정전기 방출 (파괴 시 확률적으로 번개 발사)
    const staticDischargeLevel = this.upgradeSystem.getStaticDischargeLevel();
    if (staticDischargeLevel > 0) {
      const chance = this.upgradeSystem.getStaticDischargeChance();
      if (Math.random() < chance) {
        this.triggerStaticDischarge(x, y, dish);
      }
    }

    // 전기 충격 (주변 접시에 데미지)
    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    if (electricLevel > 0) {
      const electricRadius = this.upgradeSystem.getElectricShockRadius();
      this.applyElectricShock(x, y, electricLevel, dish, electricRadius);
    }

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  // 정전기 방출: 파괴된 위치에서 다른 접시로 번개 발사
  private triggerStaticDischarge(startX: number, startY: number, excludeDish: Dish): void {
    const damage = this.upgradeSystem.getStaticDischargeDamage();
    const range = this.upgradeSystem.getStaticDischargeRange();

    // 유효한 타겟 찾기 (화면에 있는 활성 접시, 자신 제외, 폭탄 제외, 사거리 내)
    const targets: Dish[] = [];
    this.dishPool.forEach((d) => {
      if (d !== excludeDish && d.active && !d.isDangerous()) {
        const dist = Phaser.Math.Distance.Between(startX, startY, d.x, d.y);
        if (dist <= range) {
          targets.push(d);
        }
      }
    });

    if (targets.length > 0) {
      // 랜덤 타겟 선정
      const target = Phaser.Utils.Array.GetRandom(targets);

      // 데미지 적용
      target.applyDamage(damage);

      // 시각적 피드백 (번개)
      this.feedbackSystem.onStaticDischarge(startX, startY, target.x, target.y);

      // 사운드 (히트 사운드 재사용)
      this.soundSystem.playHitSound();
    }
  }

  // 전기 충격: 주변 접시에 데미지
  private applyElectricShock(
    x: number,
    y: number,
    _level: number,
    excludeDish: Dish,
    radius: number
  ): void {
    const targets: { x: number; y: number }[] = [];
    const damage = this.upgradeSystem.getElectricShockDamage();

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active && !dish.isDangerous()) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) {
          targets.push({ x: dish.x, y: dish.y });
          dish.applyDamage(damage, true);
        }
      }
    });

    if (targets.length > 0) {
      this.feedbackSystem.onElectricShock(x, y, targets);
    }
  }

  spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    // 폭탄일 경우 경고 표시 후 딜레이하여 스폰
    if (type === 'bomb') {
      this.showBombWarningAndSpawn(x, y, speedMultiplier);
      return;
    }

    this.spawnDishImmediate(type, x, y, speedMultiplier);
  }

  private spawnDishImmediate(
    type: string,
    x: number,
    y: number,
    speedMultiplier: number = 1
  ): void {
    const dish = this.dishPool.acquire();
    if (dish) {
      // 업그레이드 옵션 적용
      const options = {
        cursorSizeBonus: this.upgradeSystem.getCursorSizeBonus(),
        damageBonus: this.upgradeSystem.getCursorDamageBonus(),
      };
      dish.spawn(x, y, type, speedMultiplier, options);
      this.dishes.add(dish);
    }
  }

  private showBombWarningAndSpawn(x: number, y: number, speedMultiplier: number): void {
    const warningDuration = 500; // 0.5초 경고
    const warningRadius = 50;

    // 경고 그래픽 생성
    const warningGraphics = this.add.graphics();
    warningGraphics.setDepth(500);

    // 경고 애니메이션
    let elapsed = 0;
    const blinkInterval = 100; // 깜빡임 간격

    const updateWarning = () => {
      warningGraphics.clear();

      // 깜빡임 효과
      const blinkPhase = Math.floor(elapsed / blinkInterval) % 2;
      const alpha = blinkPhase === 0 ? 0.6 : 0.3;

      // 크기가 커지는 효과
      const progress = elapsed / warningDuration;
      const currentRadius = warningRadius * (0.5 + progress * 0.5);

      // 빨간 경고 원
      warningGraphics.fillStyle(COLORS.RED, alpha * 0.3);
      warningGraphics.fillCircle(x, y, currentRadius);

      // 빨간 테두리
      warningGraphics.lineStyle(3, COLORS.RED, alpha);
      warningGraphics.strokeCircle(x, y, currentRadius);

      // 경고 X 표시
      const crossSize = currentRadius * 0.5;
      warningGraphics.lineStyle(4, COLORS.RED, alpha);
      warningGraphics.beginPath();
      warningGraphics.moveTo(x - crossSize, y - crossSize);
      warningGraphics.lineTo(x + crossSize, y + crossSize);
      warningGraphics.moveTo(x + crossSize, y - crossSize);
      warningGraphics.lineTo(x - crossSize, y + crossSize);
      warningGraphics.strokePath();
    };

    // 초기 그리기
    updateWarning();

    // 애니메이션 타이머
    const warningTimer = this.time.addEvent({
      delay: 16, // ~60fps
      callback: () => {
        elapsed += 16;
        if (elapsed < warningDuration) {
          updateWarning();
        }
      },
      loop: true,
    });

    // 경고 후 폭탄 스폰
    this.time.delayedCall(warningDuration, () => {
      warningTimer.destroy();
      warningGraphics.destroy();

      // 게임 오버가 아닐 때만 스폰
      if (!this.isGameOver) {
        this.spawnDishImmediate('bomb', x, y, speedMultiplier);
      }
    });
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
    EventBus.getInstance().emit(GameEvents.GAME_PAUSED);
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.physics.resume();
    EventBus.getInstance().emit(GameEvents.GAME_RESUMED);
  }

  private gameOver(): void {
    this.isGameOver = true;
    this.physics.pause();

    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.cleanup();
      this.scene.start('GameOverScene', {
        maxCombo: this.comboSystem.getMaxCombo(),
        wave: this.waveSystem.getCurrentWave(),
        time: this.gameTime,
      });
    });
  }

  private cleanup(): void {
    EventBus.getInstance().clear();
    this.dishPool.clear();
    this.healthPackSystem.clear();
    this.inGameUpgradeUI.destroy();
    this.waveCountdownUI.destroy();
    this.abilityPanel.destroy();
    if (this.cursorTrail) this.cursorTrail.destroy();
    if (this.gaugeSystem) this.gaugeSystem.destroy();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 슬로우 모션 적용된 델타 타임 계산
    const scaledDelta = delta * this.time.timeScale;

    // 시간 업데이트
    this.gameTime += scaledDelta;

    // 시스템 업데이트
    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.update(scaledDelta);
    this.waveSystem.update(scaledDelta);
    this.upgradeSystem.update(scaledDelta, this.gameTime);
    this.healthPackSystem.update(scaledDelta, this.gameTime);
    this.slowMotion.update(delta); // SlowMotion 시스템 자체는 실제 시간(delta)으로 업데이트해야 함

    // 접시 업데이트
    this.dishPool.forEach((dish) => {
      dish.update(scaledDelta);
    });

    // HUD 업데이트
    this.hud.update(this.gameTime);

    // 보스 업데이트
    this.boss.update(scaledDelta);

    // 커서 범위 계산
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 커서 트레일 업데이트
    this.cursorTrail.update(scaledDelta, cursorRadius);

    // 인게임 업그레이드 UI 업데이트
    this.inGameUpgradeUI.update(scaledDelta);

    // 그리드 배경 업데이트
    this.updateGrid(scaledDelta);

    // 자기장 효과 업데이트
    this.updateMagnetEffect(scaledDelta);

    // 커서 범위 기반 공격 처리
    this.updateCursorAttack();

    // 공격 범위 인디케이터 업데이트
    this.updateAttackRangeIndicator();

    // 보스 레이저 업데이트
    this.updateLaser(scaledDelta);
  }

  private updateMagnetEffect(delta: number): void {
    const magnetLevel = this.upgradeSystem.getMagnetLevel();

    // 자기장 레벨이 0이면 모든 접시의 상태만 초기화하고 리턴
    if (magnetLevel <= 0) {
      this.dishPool.forEach((dish) => {
        if (dish.active) dish.setBeingPulled(false);
      });
      return;
    }

    const pointer = this.input.activePointer;
    const cursorX = pointer.worldX;
    const cursorY = pointer.worldY;

    // 자기장 범위/힘 계산
    const magnetRadius = this.upgradeSystem.getMagnetRadius();
    const magnetForce = MAGNET.BASE_FORCE + magnetLevel * MAGNET.FORCE_PER_LEVEL;

    // delta를 초 단위로 변환
    const deltaSeconds = delta / 1000;

    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      // 상태 초기화
      dish.setBeingPulled(false);

      // 폭탄(dangerous)은 당기지 않음
      if (dish.isDangerous()) return;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, dish.x, dish.y);
      if (dist > magnetRadius || dist < MAGNET.MIN_PULL_DISTANCE) return;

      // 당겨지는 상태 설정
      dish.setBeingPulled(true);

      // 거리 기반 선형 감쇠 (가까울수록 강함)
      const pullStrength = 1 - dist / magnetRadius;
      const pullAmount = magnetForce * pullStrength * deltaSeconds;

      // 커서 방향으로 이동
      const angle = Phaser.Math.Angle.Between(dish.x, dish.y, cursorX, cursorY);
      dish.x += Math.cos(angle) * pullAmount;
      dish.y += Math.sin(angle) * pullAmount;

      // 자기장 연출 추가: 낮은 확률로 파티클 생성 또는 거리 기반으로 생성
      if (Math.random() < 0.15) {
        this.particleManager.createMagnetPullEffect(dish.x, dish.y, cursorX, cursorY);
      }
    });
  }

  private updateCursorAttack(): void {
    const pointer = this.input.activePointer;
    const cursorX = pointer.worldX;
    const cursorY = pointer.worldY;

    // 커서 히트박스 크기
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 모든 접시와 거리 계산
    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, dish.x, dish.y);
      const dishRadius = dish.getSize(); // 접시 크기
      const hitDistance = cursorRadius + dishRadius;

      dish.setInCursorRange(dist <= hitDistance);
    });
  }

  private updateAttackRangeIndicator(): void {
    const pointer = this.input.activePointer;
    const x = pointer.worldX;
    const y = pointer.worldY;

    // 커서 히트박스 크기 계산
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    this.attackRangeIndicator.clear();

    // 자기장 범위 원 (자기장 레벨 > 0일 때만)
    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    if (magnetLevel > 0) {
      const magnetRadius = this.upgradeSystem.getMagnetRadius();

      // 자기장 범위 (마젠타, 더 투명하게)
      this.attackRangeIndicator.lineStyle(1, COLORS.MAGENTA, 0.15);
      this.attackRangeIndicator.strokeCircle(x, y, magnetRadius);

      // 내부 채우기 (매우 투명)
      this.attackRangeIndicator.fillStyle(COLORS.MAGENTA, 0.02);
      this.attackRangeIndicator.fillCircle(x, y, magnetRadius);
    }

    // 공격 범위 테두리
    const isReady = this.gaugeRatio >= 1;
    const readyColor = Phaser.Display.Color.HexStringToColor(
      Data.feedback.bossAttack.mainColor
    ).color;
    const baseColor = isReady ? readyColor : COLORS.CYAN;

    this.attackRangeIndicator.lineStyle(2, baseColor, 0.5);
    this.attackRangeIndicator.strokeCircle(x, y, cursorRadius);

    // 내부 게이지 채우기
    if (this.gaugeRatio > 0) {
      // 에너지가 어느정도 차있냐에 따라서 커서 내부가 채워지도록 함
      // ratio에 따라 반지름을 조절하여 채워지는 연출
      const fillRadius = cursorRadius * this.gaugeRatio;
      this.attackRangeIndicator.fillStyle(baseColor, isReady ? 0.3 : 0.2);
      this.attackRangeIndicator.fillCircle(x, y, fillRadius);

      if (isReady) {
        // 준비 완료 시 글로우 효과
        this.attackRangeIndicator.lineStyle(4, readyColor, 0.3);
        this.attackRangeIndicator.strokeCircle(x, y, cursorRadius + 2);
      }
    }

    // 기본 내부 채우기 (매우 반투명)
    this.attackRangeIndicator.fillStyle(baseColor, 0.05);
    this.attackRangeIndicator.fillCircle(x, y, cursorRadius);

    // 중앙 점
    this.attackRangeIndicator.fillStyle(COLORS.WHITE, 1);
    this.attackRangeIndicator.fillCircle(x, y, 2);
  }

  getDishPool(): ObjectPool<Dish> {
    return this.dishPool;
  }

  // ===== 보스 레이저 공격 시스템 =====
  private setNextLaserTime(): void {
    const laserConfig = this.waveSystem.getCurrentWaveLaserConfig();

    if (!laserConfig || laserConfig.maxCount === 0) {
      this.laserNextTime = this.gameTime + 5000; // 아직 발사하지 않는 웨이브면 5초 후 재체크
      return;
    }

    const interval = Phaser.Math.Between(laserConfig.minInterval, laserConfig.maxInterval);
    this.laserNextTime = this.gameTime + interval;
  }

  private updateLaser(delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 레이저 타이머 체크
    if (this.gameTime >= this.laserNextTime) {
      const laserConfig = this.waveSystem.getCurrentWaveLaserConfig();

      if (laserConfig && laserConfig.maxCount > 0) {
        // 한 번에 발사할 레이저 수 결정 (1 ~ maxCount)
        const count = Phaser.Math.Between(1, laserConfig.maxCount);
        for (let i = 0; i < count; i++) {
          this.triggerLaserAttack();
        }
      }
      this.setNextLaserTime();
    }

    if (this.activeLasers.length > 0) {
      this.drawLasers();
      this.checkLaserCollisions(delta);
    }
  }

  private triggerLaserAttack(): void {
    const config = Data.gameConfig.monsterAttack.laser;

    // 화면 외곽에서 임의의 시작점과 끝점 선정 (대각선 지원)
    // "이상한 곳"에 나오지 않도록 최소 거리를 보장하고 중심부를 관통하도록 개선
    let p1 = { x: 0, y: 0 };
    let p2 = { x: 0, y: 0 };
    let distance = 0;
    const minDistance = Math.min(GAME_WIDTH, GAME_HEIGHT) * config.trajectory.minDistanceRatio;

    let attempts = 0;
    while (distance < minDistance && attempts < 10) {
      const side1 = Phaser.Math.Between(0, 3); // 0:상, 1:하, 2:좌, 3:우
      let side2 = Phaser.Math.Between(0, 3);
      while (side1 === side2) side2 = Phaser.Math.Between(0, 3);

      const getPointOnSide = (side: number) => {
        const padding = config.trajectory.spawnPadding;
        switch (side) {
          case 0:
            return { x: Phaser.Math.Between(0, GAME_WIDTH), y: padding };
          case 1:
            return { x: Phaser.Math.Between(0, GAME_WIDTH), y: GAME_HEIGHT - padding };
          case 2:
            return { x: padding, y: Phaser.Math.Between(0, GAME_HEIGHT) };
          case 3:
            return { x: GAME_WIDTH - padding, y: Phaser.Math.Between(0, GAME_HEIGHT) };
          default:
            return { x: 0, y: 0 };
        }
      };

      p1 = getPointOnSide(side1);
      p2 = getPointOnSide(side2);
      distance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      attempts++;
    }

    const laser = {
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      isWarning: true,
      isFiring: false,
      startTime: this.gameTime,
    };
    this.activeLasers.push(laser);

    // 사운드: 기 모으는 소리 활용
    this.soundSystem.playBossChargeSound();

    // 경고 시간 후 발사
    this.time.delayedCall(config.warningDuration, () => {
      if (this.isGameOver) return;
      laser.isWarning = false;
      laser.isFiring = true;

      // 사운드: 보스 발사 소리 활용
      this.soundSystem.playBossFireSound();

      // 화면 흔들림
      this.cameras.main.shake(200, 0.005);

      // 발사 시간 후 중지
      this.time.delayedCall(config.fireDuration, () => {
        const index = this.activeLasers.indexOf(laser);
        if (index > -1) {
          this.activeLasers.splice(index, 1);
          if (this.activeLasers.length === 0) {
            this.laserGraphics.clear();
          }
        }
      });
    });
  }

  private drawLasers(): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const color = Phaser.Display.Color.HexStringToColor(config.color).color;

    this.laserGraphics.clear();

    for (const laser of this.activeLasers) {
      if (laser.isWarning) {
        // 경고선 (반짝임 효과)
        const alpha = config.warningAlpha * (0.5 + Math.sin(this.gameTime / 50) * 0.5);
        this.laserGraphics.lineStyle(config.width, color, alpha);
        this.laserGraphics.lineBetween(laser.x1, laser.y1, laser.x2, laser.y2);

        // 외곽선
        this.laserGraphics.lineStyle(2, color, alpha * 2);
        this.laserGraphics.lineBetween(laser.x1, laser.y1, laser.x2, laser.y2);
      } else if (laser.isFiring) {
        // 실제 레이저
        // 주변부
        this.laserGraphics.lineStyle(config.width, color, config.fireAlpha * 0.6);
        this.laserGraphics.lineBetween(laser.x1, laser.y1, laser.x2, laser.y2);

        // 중심부 (흰색 느낌)
        this.laserGraphics.lineStyle(config.width / 2, 0xffffff, config.fireAlpha);
        this.laserGraphics.lineBetween(laser.x1, laser.y1, laser.x2, laser.y2);

        // ===== 전기 스파크 연출 추가 =====
        this.drawElectricSparks(laser.x1, laser.y1, laser.x2, laser.y2, config.width, color);

        // 파티클 효과 (레이저 경로를 따라 스파크)
        if (Math.random() < 0.3) {
          const t = Math.random();
          const px = laser.x1 + (laser.x2 - laser.x1) * t;
          const py = laser.y1 + (laser.y2 - laser.y1) * t;
          this.particleManager.createSparkBurst(px, py, color);
        }
      }
    }
  }

  private drawElectricSparks(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    laserWidth: number,
    color: number
  ): void {
    const laserConfig = Data.gameConfig.monsterAttack.laser;
    const segments = laserConfig.visual.sparkSegments;
    const sparkCount = laserConfig.visual.sparkCount;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const perpAngle = angle + Math.PI / 2;

    for (let i = 0; i < sparkCount; i++) {
      this.laserGraphics.lineStyle(2, 0xffffff, 0.8);
      this.laserGraphics.beginPath();

      const startOffset = (Math.random() - 0.5) * laserWidth;
      this.laserGraphics.moveTo(
        x1 + Math.cos(perpAngle) * startOffset,
        y1 + Math.sin(perpAngle) * startOffset
      );

      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const midX = x1 + dx * t;
        const midY = y1 + dy * t;
        const offset = (Math.random() - 0.5) * (laserWidth * 1.5);

        this.laserGraphics.lineTo(
          midX + Math.cos(perpAngle) * offset,
          midY + Math.sin(perpAngle) * offset
        );
      }
      this.laserGraphics.strokePath();

      // 바깥쪽 후광 효과
      this.laserGraphics.lineStyle(4, color, 0.3);
      this.laserGraphics.strokePath();
    }
  }

  private checkLaserCollisions(_delta: number): void {
    const pointer = this.input.activePointer;
    const px = pointer.worldX;
    const py = pointer.worldY;
    const config = Data.gameConfig.monsterAttack.laser;

    // 커서 히트박스 크기
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    for (const laser of this.activeLasers) {
      if (!laser.isFiring) continue;

      // 점(px, py)과 직선(laser.x1, y1 -> x2, y2) 사이의 거리 계산
      const lineLenSq = Math.pow(laser.x2 - laser.x1, 2) + Math.pow(laser.y2 - laser.y1, 2);
      if (lineLenSq === 0) continue;

      // 선분 위의 가장 가까운 점 찾기 (t: 0 to 1)
      let t =
        ((px - laser.x1) * (laser.x2 - laser.x1) + (py - laser.y1) * (laser.y2 - laser.y1)) /
        lineLenSq;
      t = Math.max(0, Math.min(1, t));

      const nearestX = laser.x1 + t * (laser.x2 - laser.x1);
      const nearestY = laser.y1 + t * (laser.y2 - laser.y1);

      const dist = Phaser.Math.Distance.Between(px, py, nearestX, nearestY);

      if (dist < config.width / 2 + cursorRadius) {
        this.handleLaserHit();
        break;
      }
    }
  }

  private lastLaserHitTime: number = 0;
  private handleLaserHit(): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const now = this.gameTime;
    if (now - this.lastLaserHitTime < config.bonus.invincibilityDuration) return;

    this.lastLaserHitTime = now;
    this.healthSystem.takeDamage(1);
    this.feedbackSystem.onHpLost();
    this.soundSystem.playBossImpactSound();

    // 카메라 흔들림 강화
    this.cameras.main.shake(300, 0.01);
  }
}
