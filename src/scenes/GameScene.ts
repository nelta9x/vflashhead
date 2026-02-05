import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CURSOR_HITBOX, SPAWN_AREA, MAGNET } from '../data/constants';
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
  private inGameUpgradeUI!: InGameUpgradeUI;
  private waveCountdownUI!: WaveCountdownUI;
  private abilityPanel!: AbilityPanel;
  private particleManager!: ParticleManager;
  private screenShake!: ScreenShake;
  private slowMotion!: SlowMotion;
  private damageText!: DamageText;

  // 게임 상태
  private gameTime: number = 0;
  private isGameOver: boolean = false;
  private isPaused: boolean = false;

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
    // 이전 게임의 이벤트 리스너 정리 (재시작 시 중복 방지)
    EventBus.getInstance().clear();

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
    this.monsterSystem = new MonsterSystem();
    this.gaugeSystem = new GaugeSystem(this.comboSystem);

    // 이펙트 시스템
    this.particleManager = new ParticleManager(this);
    this.screenShake = new ScreenShake(this);
    this.slowMotion = new SlowMotion(this);
    this.damageText = new DamageText(this);
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

    // 몬스터 HP 변경
    EventBus.getInstance().on(GameEvents.MONSTER_HP_CHANGED, (...args: unknown[]) => {
      const data = args[0] as { current: number; max: number };
      this.hud.updateMonsterHp(data.current, data.max);
    });

    // 플레이어 게이지 업데이트
    EventBus.getInstance().on(GameEvents.GAUGE_UPDATED, (...args: unknown[]) => {
      const data = args[0] as { current: number; max: number };
      this.hud.updateGauge(data.current, data.max);
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
    const startX = pointer.worldX;
    const startY = pointer.worldY;
    const endX = GAME_WIDTH / 2;
    const endY = 80; // Approximate boss pos

    // 1. Charge Phase
    // 발사체 생성 (작게 시작)
    const projectile = this.add.circle(startX, startY, 5, COLORS.YELLOW);
    this.physics.add.existing(projectile);
    
    // 기를 모으는 효과 (주변에서 모여드는 파티클 시뮬레이션 - 역재생 링)
    const chargeRing = this.add.graphics();
    chargeRing.lineStyle(2, COLORS.YELLOW, 1);
    chargeRing.strokeCircle(0, 0, 50); // 중심을 0,0으로 설정하여 x,y 이동이 편하게 함
    chargeRing.setPosition(startX, startY);
    
    // 기 모으기 애니메이션 (크기 감소)
    this.tweens.add({
        targets: chargeRing,
        scale: 0,
        alpha: 0.5,
        duration: 500,
        ease: 'Cubic.In',
        onUpdate: () => {
            chargeRing.setPosition(pointer.worldX, pointer.worldY);
        },
        onComplete: () => chargeRing.destroy()
    });

    this.tweens.add({
        targets: projectile,
        scale: 3, // 커짐
        alpha: 1,
        duration: 500,
        ease: 'Back.In', // 살짝 수축했다가 커짐
        onUpdate: () => {
            // 기를 모으는 동안 커서를 따라다님
            projectile.x = pointer.worldX;
            projectile.y = pointer.worldY;
        },
        onComplete: () => {
            // 2. Fire Phase (발사!)
            const fireX = projectile.x;
            const fireY = projectile.y;
            
            // 발사 반동
            this.cameras.main.shake(50, 0.005);
            this.particleManager.createSparkBurst(fireX, fireY, COLORS.YELLOW);

            // 날아가기
            this.tweens.add({
                targets: projectile,
                x: endX,
                y: endY,
                duration: 200, // 순식간에 도달
                ease: 'Power4.In', // 가속
                onUpdate: () => {
                   // 트레일 효과 (간단히 잔상 남기기)
                   if (Math.random() > 0.5) {
                       const trail = this.add.circle(projectile.x, projectile.y, 10, COLORS.YELLOW, 0.5);
                       this.tweens.add({
                           targets: trail,
                           scale: 0,
                           alpha: 0,
                           duration: 200,
                           onComplete: () => trail.destroy()
                       });
                   }
                },
                onComplete: () => {
                    projectile.destroy();
                    this.monsterSystem.takeDamage(1);
                    
                    // 3. Impact Phase (타격!)
                    
                    // 강력한 화면 흔들림
                    this.cameras.main.shake(200, 0.02);
                    
                    // 대형 폭발 (bomb 타입이 쇼크웨이브 포함)
                    this.particleManager.createExplosion(endX, endY, COLORS.RED, 'bomb', 3);
                    
                    // 추가 임팩트: 화면 번쩍임
                    this.cameras.main.flash(100, 255, 255, 255);
                }
            });
        }
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

  private onDishMissed(data: { dish: Dish; x: number; y: number; type: string; isDangerous: boolean }): void {
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

    // 콤보 증가
    this.comboSystem.increment();

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
    // 전기 충격 (주변 접시에 데미지)
    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    if (electricLevel > 0) {
      const electricRadius = 100 + electricLevel * 15; // 레벨당 15 증가
      this.applyElectricShock(x, y, electricLevel, dish, electricRadius);
    }

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  // 전기 충격: 주변 접시에 데미지
  private applyElectricShock(x: number, y: number, level: number, excludeDish: Dish, radius: number): void {
    const targets: { x: number; y: number }[] = [];
    const damage = level; // 레벨당 1 데미지

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

  private spawnDishImmediate(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    const dish = this.dishPool.acquire();
    if (dish) {
      // 업그레이드 옵션 적용
      const options = {
        cursorSizeBonus: this.upgradeSystem.getCursorSizeBonus(),
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
    if (this.gaugeSystem) this.gaugeSystem.destroy();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 시간 업데이트
    this.gameTime += delta;

    // 시스템 업데이트
    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.update(delta);
    this.waveSystem.update(delta);
    this.upgradeSystem.update(delta, this.gameTime);
    this.healthPackSystem.update(delta, this.gameTime);
    this.slowMotion.update(delta);

    // 접시 업데이트
    this.dishPool.forEach((dish) => {
      dish.update(delta);
    });

    // HUD 업데이트
    this.hud.update(this.gameTime);

    // 인게임 업그레이드 UI 업데이트
    this.inGameUpgradeUI.update(delta);

    // 자기장 효과 업데이트
    this.updateMagnetEffect(delta);

    // 커서 범위 기반 공격 처리
    this.updateCursorAttack();

    // 공격 범위 인디케이터 업데이트
    this.updateAttackRangeIndicator();
  }

  private updateMagnetEffect(delta: number): void {
    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    if (magnetLevel <= 0) return;

    const pointer = this.input.activePointer;
    const cursorX = pointer.worldX;
    const cursorY = pointer.worldY;

    // 자기장 범위/힘 계산
    const magnetRadius = MAGNET.BASE_RADIUS + magnetLevel * MAGNET.RADIUS_PER_LEVEL;
    const magnetForce = MAGNET.BASE_FORCE + magnetLevel * MAGNET.FORCE_PER_LEVEL;

    // delta를 초 단위로 변환
    const deltaSeconds = delta / 1000;

    this.dishPool.forEach((dish) => {
      if (!dish.active) return;
      // 폭탄(dangerous)은 당기지 않음
      if (dish.isDangerous()) return;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, dish.x, dish.y);
      if (dist > magnetRadius || dist < MAGNET.MIN_PULL_DISTANCE) return;

      // 거리 기반 선형 감쇠 (가까울수록 강함)
      const pullStrength = 1 - dist / magnetRadius;
      const pullAmount = magnetForce * pullStrength * deltaSeconds;

      // 커서 방향으로 이동
      const angle = Phaser.Math.Angle.Between(dish.x, dish.y, cursorX, cursorY);
      dish.x += Math.cos(angle) * pullAmount;
      dish.y += Math.sin(angle) * pullAmount;
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
      const magnetRadius = MAGNET.BASE_RADIUS + magnetLevel * MAGNET.RADIUS_PER_LEVEL;

      // 자기장 범위 (마젠타, 더 투명하게)
      this.attackRangeIndicator.lineStyle(1, COLORS.MAGENTA, 0.15);
      this.attackRangeIndicator.strokeCircle(x, y, magnetRadius);

      // 내부 채우기 (매우 투명)
      this.attackRangeIndicator.fillStyle(COLORS.MAGENTA, 0.02);
      this.attackRangeIndicator.fillCircle(x, y, magnetRadius);
    }

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
}
