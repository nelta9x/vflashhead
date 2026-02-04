import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/constants';
import { Dish } from '../entities/Dish';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { ScoreSystem } from '../systems/ScoreSystem';
import { ComboSystem } from '../systems/ComboSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { HUD } from '../ui/HUD';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { SlowMotion } from '../effects/SlowMotion';
import { DamageText } from '../ui/DamageText';
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { SoundSystem } from '../systems/SoundSystem';

export class GameScene extends Phaser.Scene {
  private dishPool!: ObjectPool<Dish>;
  private dishes!: Phaser.GameObjects.Group;

  // 시스템
  private scoreSystem!: ScoreSystem;
  private comboSystem!: ComboSystem;
  private waveSystem!: WaveSystem;
  private upgradeSystem!: UpgradeSystem;
  private healthSystem!: HealthSystem;
  private feedbackSystem!: FeedbackSystem;
  private soundSystem!: SoundSystem;

  // UI & 이펙트
  private hud!: HUD;
  private particleManager!: ParticleManager;
  private screenShake!: ScreenShake;
  private slowMotion!: SlowMotion;
  private damageText!: DamageText;

  // 게임 상태
  private gameTime: number = 0;
  private isGameOver: boolean = false;
  private isPaused: boolean = false;
  private scoreBlockedUntil: number = 0; // Bomb 패널티: 점수 획득 불가 시간

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isGameOver = false;
    this.isPaused = false;
    this.gameTime = 0;
    this.scoreBlockedUntil = 0;

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

    // 게임 시작
    this.waveSystem.startWave(1);

    // 카메라 페이드 인
    this.cameras.main.fadeIn(500);
  }

  private createBackground(): void {
    const graphics = this.add.graphics();

    // 그리드 배경
    graphics.lineStyle(1, COLORS.CYAN, 0.05);
    const gridSize = 50;
    for (let x = 0; x < GAME_WIDTH; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_WIDTH, y);
    }
    graphics.strokePath();
  }

  private initializeSystems(): void {
    this.scoreSystem = new ScoreSystem();
    this.comboSystem = new ComboSystem();
    this.waveSystem = new WaveSystem(this);
    this.upgradeSystem = new UpgradeSystem();
    this.healthSystem = new HealthSystem();

    // 이펙트 시스템
    this.particleManager = new ParticleManager(this);
    this.screenShake = new ScreenShake(this);
    this.slowMotion = new SlowMotion(this);
    this.damageText = new DamageText(this);
    this.soundSystem = new SoundSystem();
    this.feedbackSystem = new FeedbackSystem(
      this,
      this.particleManager,
      this.screenShake,
      this.slowMotion,
      this.damageText,
      this.soundSystem
    );

    // HUD
    this.hud = new HUD(this, this.scoreSystem, this.comboSystem, this.waveSystem, this.healthSystem);
  }

  private initializeEntities(): void {
    // 오브젝트 풀 생성
    this.dishPool = new ObjectPool<Dish>(() => new Dish(this, 0, 0, 'basic'), 10, 50);
  }

  private setupEventListeners(): void {
    // 접시 파괴 이벤트
    EventBus.getInstance().on(GameEvents.DISH_DESTROYED, (...args: unknown[]) => {
      const data = args[0] as { dish: Dish; x: number; y: number; chainReaction: boolean };
      this.onDishDestroyed(data);
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
    });

    // 업그레이드 선택
    EventBus.getInstance().on(GameEvents.UPGRADE_AVAILABLE, () => {
      this.pauseGame();
      this.scene.launch('UpgradeScene', {
        upgradeSystem: this.upgradeSystem,
        gameScene: this,
      });
    });

    // 업그레이드 선택 완료
    EventBus.getInstance().on(GameEvents.UPGRADE_SELECTED, () => {
      this.resumeGame();
    });

    // 게임 오버
    EventBus.getInstance().on(GameEvents.GAME_OVER, () => {
      this.gameOver();
    });

    // 접시 타임아웃 (놓침) 이벤트
    EventBus.getInstance().on(GameEvents.DISH_MISSED, (...args: unknown[]) => {
      const data = args[0] as { dish: Dish; x: number; y: number; type: string; isDangerous: boolean };
      this.onDishMissed(data);
    });

    // HP 변경 이벤트
    EventBus.getInstance().on(GameEvents.HP_CHANGED, (...args: unknown[]) => {
      const data = args[0] as { hp: number; maxHp: number; delta: number };
      if (data.delta < 0) {
        this.hud.showHpLoss();
        this.feedbackSystem.onHpLost();
      }
    });
  }

  private onDishMissed(data: { dish: Dish; x: number; y: number; type: string; isDangerous: boolean }): void {
    const { dish, x, y, isDangerous } = data;

    // 피드백 효과
    this.feedbackSystem.onDishMissed(x, y, dish.getColor(), dish.getDishType(), isDangerous);

    if (isDangerous) {
      // Bomb 타임아웃: 패널티 없음 (피하면 좋음)
      // 아무 것도 하지 않음
    } else {
      // 일반 접시 놓침: HP 감소 + 콤보 리셋
      this.healthSystem.takeDamage(1);
      this.comboSystem.reset();
    }

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

  private onDishDestroyed(data: { dish: Dish; x: number; y: number; chainReaction: boolean }): void {
    const { dish, x, y, chainReaction } = data;

    // Bomb 패널티 처리
    if (dish.isDangerous()) {
      // 콤보 리셋
      this.comboSystem.reset();
      // 2초간 점수 획득 불가
      this.scoreBlockedUntil = this.gameTime + 2000;
      // 피드백 효과만 (점수 없음)
      this.feedbackSystem.onDishDestroyed(x, y, dish.getColor(), dish.getDishType());
      // 풀에서 제거
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // 점수 추가 (점수 차단 상태가 아닐 때만)
    const isScoreBlocked = this.gameTime < this.scoreBlockedUntil;
    const basePoints = dish.getPoints();
    const multiplier = this.comboSystem.getMultiplier();
    const scoreBonus = this.upgradeSystem.getScoreBonus();
    const goldenTimeMultiplier = this.upgradeSystem.isGoldenTimeActive() ? 2 : 1; // 3x → 2x로 변경
    const goldenDishBonus = dish.getDishType() === 'golden' ? (1 + this.upgradeSystem.getGoldenDishBonus()) : 1;
    // 행운의 파괴: 확률적으로 점수 2배
    const luckyChance = this.upgradeSystem.getLuckyDestroyChance();
    const luckyMultiplier = (luckyChance > 0 && Math.random() * 100 < luckyChance) ? 2 : 1;

    if (!isScoreBlocked) {
      const finalPoints = Math.floor(basePoints * multiplier * scoreBonus * goldenTimeMultiplier * goldenDishBonus * luckyMultiplier);
      this.scoreSystem.addScore(finalPoints);
    }

    // 콤보 증가
    this.comboSystem.increment();

    // 피드백 효과
    this.feedbackSystem.onDishDestroyed(x, y, dish.getColor(), dish.getDishType());

    // 범위 파괴 효과 적용
    const aoeCount = this.upgradeSystem.getAoeDestroyCount();
    if (aoeCount > 0 || chainReaction) {
      this.destroyNearbyDishes(x, y, aoeCount + (chainReaction ? 1 : 0), dish);
    }

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  private destroyNearbyDishes(x: number, y: number, count: number, excludeDish: Dish): void {
    const nearbyDishes: { dish: Dish; distance: number }[] = [];

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < 150) { // 범위 내 접시만
          nearbyDishes.push({ dish, distance });
        }
      }
    });

    // 거리순 정렬 후 count만큼 파괴
    nearbyDishes.sort((a, b) => a.distance - b.distance);
    for (let i = 0; i < Math.min(count, nearbyDishes.length); i++) {
      const { dish } = nearbyDishes[i];
      // 약간의 딜레이로 연쇄 파괴 효과
      this.time.delayedCall(i * 50, () => {
        if (dish.active) {
          EventBus.getInstance().emit(GameEvents.DISH_DESTROYED, {
            dish,
            x: dish.x,
            y: dish.y,
            type: dish.getDishType(),
            chainReaction: false, // 연쇄 파괴의 연쇄 방지
          });
          dish.deactivate();
        }
      });
    }
  }

  spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    const dish = this.dishPool.acquire();
    if (dish) {
      dish.spawn(x, y, type, speedMultiplier);
      this.dishes.add(dish);
    }
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
        score: this.scoreSystem.getScore(),
        maxCombo: this.comboSystem.getMaxCombo(),
        wave: this.waveSystem.getCurrentWave(),
        time: this.gameTime,
      });
    });
  }

  private cleanup(): void {
    EventBus.getInstance().clear();
    this.dishPool.clear();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 시간 업데이트
    this.gameTime += delta;

    // 시스템 업데이트
    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.setComboDurationBonus(this.upgradeSystem.getComboDurationBonus());
    this.comboSystem.setInfiniteTimeout(this.upgradeSystem.isGoldenTimeActive());
    this.comboSystem.update(delta);
    this.waveSystem.update(delta);
    this.upgradeSystem.update(delta, this.gameTime);
    this.slowMotion.update(delta);

    // 접시 업데이트 (타임아웃 기반으로 변경됨)
    this.dishPool.forEach((dish) => {
      dish.update(delta);
    });

    // HUD 업데이트
    this.hud.update(this.gameTime);
  }

  getDishPool(): ObjectPool<Dish> {
    return this.dishPool;
  }
}
