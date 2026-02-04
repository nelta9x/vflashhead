import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CURSOR_HITBOX, SPAWN_AREA } from '../config/constants';
import { Dish } from '../entities/Dish';
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
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { InGameUpgradeUI } from '../ui/InGameUpgradeUI';
import { WaveCountdownUI } from '../ui/WaveCountdownUI';

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

  // UI & 이펙트
  private hud!: HUD;
  private inGameUpgradeUI!: InGameUpgradeUI;
  private waveCountdownUI!: WaveCountdownUI;
  private particleManager!: ParticleManager;
  private screenShake!: ScreenShake;
  private slowMotion!: SlowMotion;
  private damageText!: DamageText;

  // 게임 상태
  private gameTime: number = 0;
  private isGameOver: boolean = false;
  private isPaused: boolean = false;

  // 업그레이드 효과 타이머
  private timeStopTimer: number = 0;
  private autoDestroyTimer: number = 0;
  private lastComboHealCombo: number = 0;

  // 웨이브 전환 상태
  private pendingWaveNumber: number = 1;

  // 공격 범위 표시
  private attackRangeIndicator!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isGameOver = false;
    this.isPaused = false;
    this.gameTime = 0;

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

    // 게임 시작: 카운트다운과 업그레이드 UI 동시 표시
    this.pendingWaveNumber = 1;
    this.waveSystem.startCountdown(this.pendingWaveNumber);
    this.waveCountdownUI.show(this.pendingWaveNumber);
    this.inGameUpgradeUI.show();

    // 카메라 페이드 인
    this.cameras.main.fadeIn(500);

    // 게임 커서 설정 (숨김 - 커스텀 인디케이터 사용)
    this.input.setDefaultCursor('none');

    // 공격 범위 인디케이터 생성
    this.attackRangeIndicator = this.add.graphics();
    this.attackRangeIndicator.setDepth(1000); // 최상위에 표시
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
    this.comboSystem = new ComboSystem();
    this.upgradeSystem = new UpgradeSystem();

    // 인게임 업그레이드 UI (WaveSystem보다 먼저 생성)
    this.inGameUpgradeUI = new InGameUpgradeUI(this, this.upgradeSystem);

    this.waveSystem = new WaveSystem(
      this,
      () => this.dishPool,
      () => this.inGameUpgradeUI.isVisible()
        ? this.inGameUpgradeUI.getBlockedYArea()
        : SPAWN_AREA.maxY
    );
    this.healthSystem = new HealthSystem();
    this.healthPackSystem = new HealthPackSystem(this);

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
      this.soundSystem,
      this.upgradeSystem
    );

    // HUD
    this.hud = new HUD(this, this.comboSystem, this.waveSystem, this.healthSystem);

    // 웨이브 카운트다운 UI
    this.waveCountdownUI = new WaveCountdownUI(this);
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
      this.onComboMilestone(milestone);
    });

    // 웨이브 완료
    EventBus.getInstance().on(GameEvents.WAVE_COMPLETED, (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.hud.showWaveComplete(waveNumber);
      this.onWaveCompleted();

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

    // 업그레이드 선택 완료 → 효과만 적용 (카운트다운은 WAVE_COMPLETED에서 이미 시작됨)
    EventBus.getInstance().on(GameEvents.UPGRADE_SELECTED, () => {
      this.applyMaxHpBonus();
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
      // 부활 업그레이드 체크
      if (this.upgradeSystem.useRevive()) {
        this.healthSystem.revive(3);
        this.feedbackSystem.onRevive();
        return;
      }
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

    // 힐팩 수집 이벤트
    EventBus.getInstance().on(GameEvents.HEALTH_PACK_COLLECTED, (...args: unknown[]) => {
      const data = args[0] as { pack: unknown; x: number; y: number };
      this.onHealthPackCollected(data.x, data.y);
    });
  }

  private onHealthPackCollected(x: number, y: number): void {
    // HP 회복
    this.healthSystem.heal(1);
    // 피드백 효과
    this.feedbackSystem.onHealthPackCollected(x, y);
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
    this.feedbackSystem.onDishDamaged(x, y, damage, hpRatio, data.dish.getColor());
  }

  private onDishMissed(data: { dish: Dish; x: number; y: number; type: string; isDangerous: boolean }): void {
    const { dish, x, y, type, isDangerous } = data;

    // 지뢰 타임아웃: 조용히 사라짐 (피드백/패널티 없음)
    if (isDangerous) {
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // 두 번째 기회: 확률적으로 접시 재스폰
    const secondChance = this.upgradeSystem.getSecondChancePercent();
    if (secondChance > 0 && Math.random() < secondChance) {
      // 같은 타입으로 새 위치에 재스폰
      this.time.delayedCall(100, () => {
        this.spawnDish(type, x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100, 1);
      });
      // 피드백 효과
      this.feedbackSystem.onSecondChance(x, y);
      // 풀에서 제거만 (패널티 없음)
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

  private onDishDestroyed(data: { dish: Dish; x: number; y: number; chainReaction: boolean }): void {
    const { dish, x, y, chainReaction } = data;

    // 지뢰(Bomb) 터짐
    if (dish.isDangerous()) {
      // 폭탄 방어막 체크
      if (this.upgradeSystem.useBombShield()) {
        this.feedbackSystem.onBombShieldUsed(x, y);
      } else {
        // HP 1 감소
        this.healthSystem.takeDamage(1);
        // 피드백 효과 (폭발)
        this.feedbackSystem.onBombExploded(x, y);
      }

      // 폭탄 전환 (폭탄 파괴 시 HP 회복)
      if (this.upgradeSystem.isBombConvertHealEnabled()) {
        this.healthSystem.heal(1);
        this.feedbackSystem.onBombConvertHeal(x, y);
      }

      // 풀에서 제거
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // 콤보 증가
    this.comboSystem.increment();

    // 피드백 효과
    this.feedbackSystem.onDishDestroyed(x, y, dish.getColor(), dish.getDishType());

    // 생명력 흡수 (lifesteal)
    const lifestealChance = this.upgradeSystem.getLifestealChance();
    if (lifestealChance > 0 && Math.random() < lifestealChance) {
      this.healthSystem.heal(1);
      this.feedbackSystem.onLifesteal(x, y);
    }

    // ===== 업그레이드 효과 적용 =====
    const aoeRadius = 150 * this.upgradeSystem.getAoeRadiusMultiplier();

    // 블랙홀 효과 (10% 확률로 주변 모든 접시 흡수)
    const blackHoleChance = this.upgradeSystem.getBlackHoleChance();
    if (blackHoleChance > 0 && Math.random() < blackHoleChance) {
      this.triggerBlackHole(x, y, dish);
    } else {
      // 범위 파괴 효과 적용
      const aoeCount = this.upgradeSystem.getAoeDestroyCount();
      if (aoeCount > 0 || chainReaction) {
        this.destroyNearbyDishes(x, y, aoeCount + (chainReaction ? 1 : 0), dish, aoeRadius);
      }
    }

    // 전기 충격 (주변 접시에 데미지)
    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    if (electricLevel > 0) {
      this.applyElectricShock(x, y, electricLevel, dish, aoeRadius);
    }

    // 냉동 오라 (주변 접시 느려짐)
    const freezeDuration = this.upgradeSystem.getFreezeAuraDuration();
    if (freezeDuration > 0) {
      this.applyFreezeAura(x, y, freezeDuration, dish, aoeRadius);
    }

    // 자석 효과 (주변 접시 끌어당김)
    const magnetLevel = this.upgradeSystem.getMagnetPullLevel();
    if (magnetLevel > 0) {
      this.applyMagnetPull(x, y, magnetLevel, dish, aoeRadius);
    }

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  // 블랙홀: 주변 모든 접시 흡수
  private triggerBlackHole(x: number, y: number, excludeDish: Dish): void {
    const nearbyDishes: Dish[] = [];

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < 200) {
          nearbyDishes.push(dish);
        }
      }
    });

    if (nearbyDishes.length === 0) return;

    // 블랙홀 피드백
    this.feedbackSystem.onBlackHole(x, y, () => {
      // 모든 주변 접시 파괴
      nearbyDishes.forEach((dish) => {
        if (dish.active) {
          dish.forceDestroy();
        }
      });
    });
  }

  // 전기 충격: 주변 접시에 데미지
  private applyElectricShock(x: number, y: number, level: number, excludeDish: Dish, radius: number): void {
    const targets: { x: number; y: number }[] = [];
    const damage = 5 + level * 5; // 레벨당 5 데미지

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active && !dish.isDangerous()) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) {
          targets.push({ x: dish.x, y: dish.y });
          dish.applyDamage(damage);
        }
      }
    });

    if (targets.length > 0) {
      this.feedbackSystem.onElectricShock(x, y, targets);
    }
  }

  // 냉동 오라: 주변 접시 느려짐
  private applyFreezeAura(x: number, y: number, duration: number, excludeDish: Dish, radius: number): void {
    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) {
          dish.applySlow(duration, 0.3);
        }
      }
    });

    this.feedbackSystem.onFreezeAura(x, y, radius);
  }

  // 자석 효과: 주변 접시 끌어당김
  private applyMagnetPull(x: number, y: number, level: number, excludeDish: Dish, radius: number): void {
    const targets: { x: number; y: number }[] = [];
    const strength = 20 + level * 15; // 레벨당 끌어당기는 힘

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) {
          targets.push({ x: dish.x, y: dish.y });
          dish.pullTowards(x, y, strength);
        }
      }
    });

    if (targets.length > 0) {
      this.feedbackSystem.onMagnetPull(x, y, targets);
    }
  }

  private destroyNearbyDishes(x: number, y: number, count: number, excludeDish: Dish, radius: number = 150): void {
    const nearbyDishes: { dish: Dish; distance: number }[] = [];

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) { // 범위 내 접시만
          nearbyDishes.push({ dish, distance });
        }
      }
    });

    // 거리순 정렬 후 count만큼 파괴
    nearbyDishes.sort((a, b) => a.distance - b.distance);

    // 현재 웨이브 저장 (웨이브 전환 시 지연된 파괴 방지)
    const currentWave = this.waveSystem.getCurrentWave();

    for (let i = 0; i < Math.min(count, nearbyDishes.length); i++) {
      const { dish } = nearbyDishes[i];
      // 약간의 딜레이로 연쇄 파괴 효과
      this.time.delayedCall(i * 50, () => {
        if (!dish.active) return;

        // 웨이브가 바뀌었으면 이벤트 없이 정리만 (카운트 꼬임 방지)
        if (this.waveSystem.getCurrentWave() !== currentWave) {
          dish.deactivate();
          this.dishes.remove(dish);
          this.dishPool.release(dish);
          return;
        }

        EventBus.getInstance().emit(GameEvents.DISH_DESTROYED, {
          dish,
          x: dish.x,
          y: dish.y,
          type: dish.getDishType(),
          chainReaction: false, // 연쇄 파괴의 연쇄 방지
        });
        dish.deactivate();
      });
    }
  }

  spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    const dish = this.dishPool.acquire();
    if (dish) {
      // 업그레이드 옵션 적용
      const options = {
        damageBonus: this.upgradeSystem.getDamageBonus(),
        attackSpeedMultiplier: this.upgradeSystem.getAttackSpeedMultiplier(),
        criticalChance: this.upgradeSystem.getCriticalChance(),
        globalSlowPercent: this.upgradeSystem.getGlobalSlowPercent(),
        cursorSizeBonus: this.upgradeSystem.getCursorSizeBonus(),
      };
      dish.spawn(x, y, type, speedMultiplier, options);
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
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 시간 업데이트
    this.gameTime += delta;

    // 시스템 업데이트
    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.setComboDurationBonus(this.upgradeSystem.getComboDurationBonus());
    this.comboSystem.update(delta);
    this.waveSystem.update(delta);
    this.upgradeSystem.update(delta, this.gameTime);
    this.healthPackSystem.update(delta, this.gameTime);
    this.slowMotion.update(delta);

    // 업그레이드 타이머 업데이트 (시간 정지, 자동 파괴)
    this.updateUpgradeTimers(delta);

    // 접시 업데이트
    this.dishPool.forEach((dish) => {
      dish.update(delta);
    });

    // HUD 업데이트
    this.hud.update(this.gameTime);

    // 인게임 업그레이드 UI 업데이트
    this.inGameUpgradeUI.update(delta);

    // 커서 범위 기반 공격 처리
    this.updateCursorAttack();

    // 공격 범위 인디케이터 업데이트
    this.updateAttackRangeIndicator();
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

    // 공격 범위 원
    this.attackRangeIndicator.lineStyle(2, COLORS.CYAN, 0.5);
    this.attackRangeIndicator.strokeCircle(x, y, cursorRadius);

    // 내부 채우기 (반투명)
    this.attackRangeIndicator.fillStyle(COLORS.CYAN, 0.08);
    this.attackRangeIndicator.fillCircle(x, y, cursorRadius);

    // 중앙 십자선
    const crossSize = 6;
    this.attackRangeIndicator.lineStyle(2, COLORS.WHITE, 0.9);
    this.attackRangeIndicator.beginPath();
    this.attackRangeIndicator.moveTo(x - crossSize, y);
    this.attackRangeIndicator.lineTo(x + crossSize, y);
    this.attackRangeIndicator.moveTo(x, y - crossSize);
    this.attackRangeIndicator.lineTo(x, y + crossSize);
    this.attackRangeIndicator.strokePath();

    // 중앙 점
    this.attackRangeIndicator.fillStyle(COLORS.WHITE, 1);
    this.attackRangeIndicator.fillCircle(x, y, 2);
  }

  getDishPool(): ObjectPool<Dish> {
    return this.dishPool;
  }

  // 웨이브 완료 시 업그레이드 효과 적용
  private onWaveCompleted(): void {
    // 웨이브 힐
    const waveHeal = this.upgradeSystem.getWaveHealAmount();
    if (waveHeal > 0) {
      this.healthSystem.heal(waveHeal);
    }

    // 폭탄 방어막 충전
    this.upgradeSystem.rechargeBombShield();
  }

  // 콤보 마일스톤에서 힐
  private onComboMilestone(milestone: number): void {
    const comboHealThreshold = this.upgradeSystem.getComboHealThreshold();
    if (comboHealThreshold > 0) {
      // 10콤보마다 힐 (10, 20, 30...)
      const healCount = Math.floor(milestone / 10);
      const prevHealCount = Math.floor(this.lastComboHealCombo / 10);

      if (healCount > prevHealCount) {
        // 새로운 10콤보 마일스톤 달성
        for (let i = 0; i < comboHealThreshold; i++) {
          this.healthSystem.heal(1);
        }
      }
      this.lastComboHealCombo = milestone;
    }
  }

  // 최대 HP 보너스 적용
  private applyMaxHpBonus(): void {
    const bonus = this.upgradeSystem.getMaxHpBonus();
    const baseHp = 5; // INITIAL_HP
    this.healthSystem.setMaxHp(baseHp + bonus);
  }

  // 시간 정지 효과
  private triggerTimeStop(): void {
    // 모든 접시 1초간 정지
    this.dishPool.forEach((dish) => {
      if (dish.active) {
        dish.applySlow(1000, 0); // factor 0 = 완전 정지
      }
    });
    this.feedbackSystem.onTimeStop();
  }

  // 자동 파괴 효과
  private triggerAutoDestroy(): void {
    // 랜덤 접시 1개 선택 (지뢰 제외)
    const candidates: Dish[] = [];
    this.dishPool.forEach((dish) => {
      if (dish.active && !dish.isDangerous()) {
        candidates.push(dish);
      }
    });

    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      target.forceDestroy();
      this.feedbackSystem.onAutoDestroy(target.x, target.y);
    }
  }

  // update 메서드에서 시간 정지/자동 파괴 타이머 처리
  private updateUpgradeTimers(delta: number): void {
    // 시간 정지 (10초마다)
    if (this.upgradeSystem.isTimeStopEnabled()) {
      this.timeStopTimer += delta;
      if (this.timeStopTimer >= 10000) {
        this.timeStopTimer = 0;
        this.triggerTimeStop();
      }
    }

    // 자동 파괴 (3초마다)
    if (this.upgradeSystem.isAutoDestroyEnabled()) {
      this.autoDestroyTimer += delta;
      if (this.autoDestroyTimer >= 3000) {
        this.autoDestroyTimer = 0;
        this.triggerAutoDestroy();
      }
    }
  }
}
