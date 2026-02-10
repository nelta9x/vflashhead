import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  CURSOR_HITBOX,
  SPAWN_AREA,
  INITIAL_HP,
} from '../data/constants';
import { Data } from '../data/DataManager';
import { Dish } from '../entities/Dish';
import { EventBus } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { ComboSystem } from '../systems/ComboSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { HealthPackSystem } from '../systems/HealthPackSystem';
import { FallingBombSystem } from '../systems/FallingBombSystem';
import { HUD } from '../ui/HUD';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { DamageText } from '../ui/DamageText';
import { CursorTrail } from '../effects/CursorTrail';
import { StarBackground } from '../effects/StarBackground';
import { GridRenderer } from '../effects/GridRenderer';
import { LaserRenderer } from '../effects/LaserRenderer';
import { CursorRenderer } from '../effects/CursorRenderer';
import { OrbRenderer } from '../effects/OrbRenderer';
import { PlayerAttackRenderer } from '../effects/PlayerAttackRenderer';
import { BlackHoleRenderer } from '../effects/BlackHoleRenderer';
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { MonsterSystem } from '../systems/MonsterSystem';
import { GaugeSystem } from '../systems/GaugeSystem';
import { OrbSystem } from '../systems/OrbSystem';
import { BlackHoleSystem } from '../systems/BlackHoleSystem';
import { PlayerCursorInputController } from '../systems/PlayerCursorInputController';
import { InGameUpgradeUI } from '../ui/InGameUpgradeUI';
import { WaveCountdownUI } from '../ui/WaveCountdownUI';
import { HudFrameContext } from '../ui/hud/types';
import { BossCombatCoordinator } from './game/BossCombatCoordinator';
import { PlayerAttackController } from './game/PlayerAttackController';
import { DishLifecycleController } from './game/DishLifecycleController';
import { GameSceneEventBinder } from './game/GameSceneEventBinder';
import { SceneInputAdapter } from './game/SceneInputAdapter';
import type { CursorSnapshot } from './game/GameSceneContracts';
import { computeCursorSmoothing } from '../utils/cursorSmoothing';

export class GameScene extends Phaser.Scene {
  private dishPool!: ObjectPool<Dish>;
  private dishes!: Phaser.GameObjects.Group;

  // 시스템
  private comboSystem!: ComboSystem;
  private waveSystem!: WaveSystem;
  private upgradeSystem!: UpgradeSystem;
  private healthSystem!: HealthSystem;
  private healthPackSystem!: HealthPackSystem;
  private fallingBombSystem!: FallingBombSystem;
  private feedbackSystem!: FeedbackSystem;
  private soundSystem!: SoundSystem;
  private monsterSystem!: MonsterSystem;
  private gaugeSystem!: GaugeSystem;
  private orbSystem!: OrbSystem;
  private blackHoleSystem!: BlackHoleSystem;

  // UI & 이펙트
  private hud!: HUD;
  private inGameUpgradeUI!: InGameUpgradeUI;
  private waveCountdownUI!: WaveCountdownUI;
  private particleManager!: ParticleManager;
  private screenShake!: ScreenShake;
  private damageText!: DamageText;
  private cursorTrail!: CursorTrail;
  private starBackground!: StarBackground;

  // 게임 상태
  private gameTime = 0;
  private isGameOver = false;
  private isEscPaused = false;
  private isDockPaused = false;
  private isSimulationPaused = false;
  private isUpgrading = false;
  private gaugeRatio = 0;
  private maxSpawnedDishRadius = 0;

  // 웨이브 전환 상태
  private pendingWaveNumber = 1;

  // 렌더러
  private gridRenderer!: GridRenderer;
  private cursorRenderer!: CursorRenderer;
  private laserRenderer!: LaserRenderer;
  private orbRenderer!: OrbRenderer;
  private blackHoleRenderer!: BlackHoleRenderer;
  private playerAttackRenderer: PlayerAttackRenderer | null = null;

  // BGM
  private bgm: Phaser.Sound.BaseSound | null = null;

  // 커서 시스템
  private cursorX = 0;
  private cursorY = 0;
  private targetCursorX = 0;
  private targetCursorY = 0;
  private inputController!: PlayerCursorInputController;

  // 기능 모듈
  private bossCombatCoordinator!: BossCombatCoordinator;
  private playerAttackController!: PlayerAttackController;
  private dishLifecycleController!: DishLifecycleController;
  private eventBinder!: GameSceneEventBinder;
  private inputAdapter!: SceneInputAdapter;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isGameOver = false;
    this.isEscPaused = false;
    this.isDockPaused = false;
    this.isSimulationPaused = false;
    this.isUpgrading = false;
    this.gameTime = 0;
    this.pendingWaveNumber = 1;
    this.gaugeRatio = 0;
    this.time.timeScale = 1;
    this.tweens.resumeAll();

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.DARK_BG)
      .setOrigin(0, 0)
      .setDepth(-10);

    this.gridRenderer = new GridRenderer(this);
    this.dishes = this.add.group();

    this.initializeSystems();
    this.initializeEntities();
    this.initializeRenderers();
    this.initializeGameModules();

    this.eventBinder.bind();
    this.inputAdapter.setup();

    // 초기 커서 위치 동기화 (스무딩 없이 즉시 반영)
    this.cursorX = this.targetCursorX;
    this.cursorY = this.targetCursorY;

    this.cameras.main.fadeIn(500);
    this.input.setDefaultCursor('none');

    const bgmConfig = Data.gameConfig.audio.bgm;
    this.bgm = this.sound.add(bgmConfig.key, {
      loop: true,
      volume: bgmConfig.volume,
    });
    this.bgm.play();

    this.waveSystem.startWave(1);
  }

  private initializeSystems(): void {
    EventBus.getInstance().clear();

    this.comboSystem = new ComboSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.maxSpawnedDishRadius = this.calculateMaxSpawnedDishRadius();

    this.particleManager = new ParticleManager(this);
    this.screenShake = new ScreenShake(this);
    this.damageText = new DamageText(this);
    this.cursorTrail = new CursorTrail(this);
    this.soundSystem = SoundSystem.getInstance();
    this.soundSystem.setScene(this);
    this.feedbackSystem = new FeedbackSystem(
      this,
      this.particleManager,
      this.screenShake,
      this.damageText,
      this.soundSystem
    );

    this.inGameUpgradeUI = new InGameUpgradeUI(this, this.upgradeSystem, this.particleManager);

    this.waveSystem = new WaveSystem(
      this,
      () => this.dishPool,
      () => {
        const baseMaxY = this.inGameUpgradeUI.isVisible()
          ? this.inGameUpgradeUI.getBlockedYArea()
          : SPAWN_AREA.maxY;
        return this.getDockSafeSpawnMaxY(baseMaxY);
      },
      () => this.bossCombatCoordinator?.getVisibleBossSnapshots() ?? []
    );

    this.healthSystem = new HealthSystem();
    this.healthPackSystem = new HealthPackSystem(this, this.upgradeSystem);
    this.fallingBombSystem = new FallingBombSystem(this);
    this.monsterSystem = new MonsterSystem();
    this.gaugeSystem = new GaugeSystem(this.comboSystem);
    this.orbSystem = new OrbSystem(this.upgradeSystem);
    this.blackHoleSystem = new BlackHoleSystem(
      this.upgradeSystem,
      () => this.dishPool,
      () => this.bossCombatCoordinator?.getAliveVisibleBossSnapshotsWithRadius() ?? [],
      (bossId, amount, sourceX, sourceY, isCritical) => {
        this.monsterSystem.takeDamage(bossId, amount, sourceX, sourceY);

        const bossTarget = this.bossCombatCoordinator?.getAliveBossTarget(bossId);
        const textX = bossTarget?.x ?? sourceX;
        const textY = bossTarget?.y ?? sourceY;
        this.feedbackSystem.onBossContactDamaged(textX, textY, amount, isCritical);
      },
      () => this.fallingBombSystem.getPool()
    );

    this.hud = new HUD(this, this.waveSystem, this.healthSystem, this.upgradeSystem);
    this.waveCountdownUI = new WaveCountdownUI(this);
  }

  private initializeEntities(): void {
    this.dishPool = new ObjectPool<Dish>(() => new Dish(this, 0, 0, 'basic'), 10, 50);
  }

  private initializeRenderers(): void {
    this.cursorRenderer = new CursorRenderer(this);
    this.cursorRenderer.setDepth(1000);

    this.orbRenderer = new OrbRenderer(this);
    this.orbRenderer.setDepth(1001);

    this.blackHoleRenderer = new BlackHoleRenderer(this);
    this.blackHoleRenderer.setDepth(Data.gameConfig.blackHoleVisual.depth);

    this.laserRenderer = new LaserRenderer(this);
    this.playerAttackRenderer = new PlayerAttackRenderer(this);

    const gridConfig = Data.gameConfig.gameGrid;
    this.starBackground = new StarBackground(this, Data.gameConfig.stars);
    this.starBackground.setDepth(gridConfig.depth - 1);
  }

  private initializeGameModules(): void {
    const playerInputConfig = Data.gameConfig.player.input;
    this.inputController = new PlayerCursorInputController({
      pointerPriorityMs: playerInputConfig.pointerPriorityMs,
      keyboardAxisRampUpMs: playerInputConfig.keyboardAxisRampUpMs,
    });

    this.bossCombatCoordinator = new BossCombatCoordinator({
      scene: this,
      waveSystem: this.waveSystem,
      monsterSystem: this.monsterSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      damageText: this.damageText,
      laserRenderer: this.laserRenderer,
      healthSystem: this.healthSystem,
      upgradeSystem: this.upgradeSystem,
      isGameOver: () => this.isGameOver,
      isPaused: () => this.isDockPaused,
    });

    this.dishLifecycleController = new DishLifecycleController({
      dishPool: this.dishPool,
      dishes: this.dishes,
      healthSystem: this.healthSystem,
      comboSystem: this.comboSystem,
      upgradeSystem: this.upgradeSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      damageText: this.damageText,
      particleManager: this.particleManager,
      getPlayerAttackRenderer: () => this.getPlayerAttackRenderer(),
      bossGateway: this.bossCombatCoordinator,
      isAnyLaserFiring: () => this.bossCombatCoordinator.isAnyLaserFiring(),
      getCursor: () => this.getCursorSnapshot(),
      isGameOver: () => this.isGameOver,
    });

    this.playerAttackController = new PlayerAttackController({
      scene: this,
      upgradeSystem: this.upgradeSystem,
      waveSystem: this.waveSystem,
      monsterSystem: this.monsterSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      particleManager: this.particleManager,
      dishPool: this.dishPool,
      getCursor: () => this.getCursorSnapshot(),
      getPlayerAttackRenderer: () => this.getPlayerAttackRenderer(),
      bossGateway: this.bossCombatCoordinator,
      isGameOver: () => this.isGameOver,
    });

    this.eventBinder = new GameSceneEventBinder({
      onDishDestroyed: (payload) => this.dishLifecycleController.onDishDestroyed(payload),
      onDishDamaged: (payload) => this.dishLifecycleController.onDishDamaged(payload),
      onComboMilestone: (milestone) => this.feedbackSystem.onComboMilestone(milestone),
      onWaveStarted: (_waveNumber) => this.bossCombatCoordinator.syncBossesForCurrentWave(),
      onWaveCompleted: (waveNumber) => this.onWaveCompleted(waveNumber),
      onUpgradeSelected: () => this.onUpgradeSelected(),
      onWaveCountdownTick: (seconds) => this.waveCountdownUI.updateCountdown(seconds),
      onWaveReady: () => this.waveCountdownUI.hide(),
      onGameOver: () => this.gameOver(),
      onDishMissed: (payload) => this.dishLifecycleController.onDishMissed(payload),
      onHealthPackUpgraded: (payload) => this.onHealthPackUpgraded(payload.hpBonus),
      onHpChanged: (payload) => this.onHpChanged(payload),
      onHealthPackPassing: (payload) => this.onHealthPackPassing(payload.x, payload.y),
      onHealthPackCollected: (payload) => this.onHealthPackCollected(payload.x, payload.y),
      onMonsterHpChanged: () => {
        // 보스 엔티티가 내부적으로 MONSTER_HP_CHANGED 이벤트를 직접 구독한다.
      },
      onGaugeUpdated: (payload) => {
        this.gaugeRatio = payload.ratio;
      },
      onPlayerAttack: () => this.playerAttackController.performPlayerAttack(),
      onMonsterDied: () => {
        if (this.monsterSystem.areAllDead()) {
          this.waveSystem.forceCompleteWave();
        }
      },
      onFallingBombDestroyed: (payload) => {
        if (!payload.byAbility) {
          this.healthSystem.takeDamage(Data.fallingBomb.playerDamage);
          if (Data.fallingBomb.resetCombo) {
            this.comboSystem.reset();
          }
        } else {
          this.damageText.showText(payload.x, payload.y - 40, Data.t('feedback.bomb_removed'), COLORS.CYAN);
        }
        this.feedbackSystem.onBombExploded(payload.x, payload.y, !!payload.byAbility);
      },
    });

    this.inputAdapter = new SceneInputAdapter({
      scene: this,
      inputController: this.inputController,
      getInputTimestamp: () => this.getInputTimestamp(),
      applyCursorPosition: (x, y) => this.applyCursorPosition(x, y),
      resetMovementInput: () => this.resetMovementInput(),
      isGameOver: () => this.isGameOver,
      togglePause: () => this.togglePause(),
    });
  }

  private onWaveCompleted(waveNumber: number): void {
    this.hud.showWaveComplete(waveNumber);
    this.clearAllDishes();
    this.bossCombatCoordinator.clearForWaveTransition();

    this.pendingWaveNumber = waveNumber + 1;
    this.time.delayedCall(500, () => {
      if (this.isGameOver) return;
      this.isUpgrading = true;
      this.inGameUpgradeUI.show();
    });
  }

  private onUpgradeSelected(): void {
    if (this.isGameOver) return;

    this.isUpgrading = false;

    this.time.delayedCall(300, () => {
      if (this.isGameOver) return;
      this.waveSystem.startCountdown(this.pendingWaveNumber);
      this.waveCountdownUI.show(this.pendingWaveNumber);
    });
  }

  private onHealthPackUpgraded(hpBonus: number): void {
    this.healthSystem.setMaxHp(INITIAL_HP + hpBonus);
    this.healthSystem.heal(hpBonus);
  }

  private onHpChanged(data: { hp: number; maxHp: number; delta: number; isFullHeal?: boolean }): void {
    if (data.isFullHeal) {
      this.healthSystem.reset();
      this.feedbackSystem.onHealthPackCollected(GAME_WIDTH / 2, GAME_HEIGHT / 2);
      return;
    }

    if (data.delta < 0) {
      this.hud.showHpLoss();
      this.feedbackSystem.onHpLost();
    }
  }

  private onHealthPackCollected(x: number, y: number): void {
    this.healthSystem.heal(1);
    this.feedbackSystem.onHealthPackCollected(x, y);
  }

  private onHealthPackPassing(x: number, y: number): void {
    this.feedbackSystem.onHealthPackPassing(x, y);
  }

  private getPlayerAttackRenderer(): PlayerAttackRenderer {
    if (!this.playerAttackRenderer) {
      this.playerAttackRenderer = new PlayerAttackRenderer(this);
    }
    return this.playerAttackRenderer;
  }

  private getDockSafeSpawnMaxY(baseMaxY: number): number {
    const dockHoverArea = this.hud.getDockHoverArea();
    if (!dockHoverArea) {
      return baseMaxY;
    }

    const dockSafeMaxY = Math.floor(dockHoverArea.y - this.maxSpawnedDishRadius);
    return Math.max(SPAWN_AREA.minY, Math.min(baseMaxY, dockSafeMaxY));
  }

  private calculateMaxSpawnedDishRadius(): number {
    const waveDishTypes = Data.waves.waves.flatMap((wave) => wave.dishTypes.map((dish) => dish.type));
    const feverDishTypes = Data.waves.fever.dishTypes.map((dish) => dish.type);
    const uniqueDishTypes = new Set<string>([...waveDishTypes, ...feverDishTypes]);

    let maxRadius = 0;
    uniqueDishTypes.forEach((type) => {
      const dishData = Data.getDishData(type);
      if (dishData) {
        maxRadius = Math.max(maxRadius, dishData.size);
      }
    });

    return maxRadius;
  }

  public spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    this.dishLifecycleController.spawnDish(type, x, y, speedMultiplier);
  }

  private togglePause(): void {
    if (this.isUpgrading) return;
    this.isEscPaused = !this.isEscPaused;
    if (this.isEscPaused) {
      this.resetMovementInput();
    }
  }

  private gameOver(): void {
    this.isGameOver = true;
    this.isEscPaused = false;
    this.isDockPaused = false;
    this.syncSimulationPauseState();
    this.physics.pause();

    if (this.bgm) {
      this.bgm.stop();
    }

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
    this.resetMovementInput();
    this.eventBinder?.unbind();
    this.inputAdapter?.teardown();
    EventBus.getInstance().clear();

    this.bossCombatCoordinator?.destroy();
    this.playerAttackController?.destroy();

    this.dishPool.clear();
    this.healthPackSystem?.destroy();
    this.healthPackSystem?.clear();
    this.fallingBombSystem?.destroy();
    this.fallingBombSystem?.clear();
    this.monsterSystem?.destroy();
    this.inGameUpgradeUI.destroy();
    this.waveCountdownUI.destroy();

    this.starBackground?.destroy();
    this.gridRenderer?.destroy();
    this.cursorRenderer?.destroy();
    this.laserRenderer?.destroy();
    this.cursorTrail?.destroy();
    this.gaugeSystem?.destroy();
    this.orbRenderer?.destroy();
    this.blackHoleRenderer?.destroy();
    this.blackHoleSystem?.clear();

    this.playerAttackRenderer?.destroy();
    this.playerAttackRenderer = null;
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    if (this.inputController) {
      const now = this.getInputTimestamp();
      const shouldUseKeyboard = this.shouldUseKeyboardMovement(now);
      const axis = this.inputController.getKeyboardAxis(delta, now);
      const speed = Data.gameConfig.player.cursorSpeed;
      const moveDistance = (speed * delta) / 1000;
      if (shouldUseKeyboard && axis.isMoving) {
        this.applyKeyboardMovement(
          this.cursorX + axis.x * moveDistance,
          this.cursorY + axis.y * moveDistance
        );
      }
    }

    this.updateCursorSmoothing(delta);

    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
    const hudContext = this.getHudFrameContext();

    if (this.isUpgrading) {
      this.setDockPaused(false);
      this.inGameUpgradeUI.update(delta);
      this.hud.update(this.gameTime, hudContext, delta);
      this.starBackground.update(delta, _time, Data.gameConfig.gameGrid.speed);
      this.gridRenderer.update(delta);
      this.cursorTrail.update(delta, cursorRadius, this.cursorX, this.cursorY);
      this.updateAttackRangeIndicator();
      return;
    }

    const hudInteraction = this.hud.updateInteractionState(hudContext, delta);
    this.setDockPaused(hudInteraction.shouldPauseGame || this.isEscPaused);
    if (this.isDockPaused) {
      this.hud.render(this.gameTime);
      this.cursorTrail.update(delta, cursorRadius, this.cursorX, this.cursorY);
      this.updateAttackRangeIndicator();
      return;
    }

    this.gameTime += delta;

    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.update(delta);
    this.waveSystem.update(delta);
    this.upgradeSystem.update(delta, this.gameTime);
    this.healthPackSystem.update(delta, this.gameTime);
    this.healthPackSystem.checkCollection(this.cursorX, this.cursorY, cursorRadius);
    this.fallingBombSystem.update(delta, this.gameTime, this.waveSystem.getCurrentWave());
    this.fallingBombSystem.checkCursorCollision(this.cursorX, this.cursorY, cursorRadius);

    this.dishPool.forEach((dish) => {
      dish.update(delta);
    });

    this.hud.render(this.gameTime);
    this.bossCombatCoordinator.updateBosses(delta);

    this.cursorTrail.update(delta, cursorRadius, this.cursorX, this.cursorY);
    this.inGameUpgradeUI.update(delta);

    this.gridRenderer.update(delta);
    this.starBackground.update(delta, _time, Data.gameConfig.gameGrid.speed);

    const cursor = this.getCursorSnapshot();
    this.dishLifecycleController.updateMagnetEffect(delta, cursor);

    this.blackHoleSystem.update(delta, this.gameTime);
    this.blackHoleRenderer.render(this.blackHoleSystem.getBlackHoles(), this.gameTime);

    this.orbSystem.update(
      delta, this.gameTime, this.cursorX, this.cursorY, this.dishPool,
      () => this.bossCombatCoordinator?.getAliveVisibleBossSnapshotsWithRadius() ?? [],
      (bossId, amount, sourceX, sourceY) => {
        this.monsterSystem.takeDamage(bossId, amount, sourceX, sourceY);
        const bossTarget = this.bossCombatCoordinator?.getAliveBossTarget(bossId);
        this.feedbackSystem.onBossContactDamaged(
          bossTarget?.x ?? sourceX, bossTarget?.y ?? sourceY, amount, false
        );
      },
      this.fallingBombSystem.getPool()
    );
    this.orbRenderer.render(this.orbSystem.getOrbs());

    this.dishLifecycleController.updateCursorAttack(cursor);
    this.updateAttackRangeIndicator();
    this.bossCombatCoordinator.update(delta, this.gameTime, cursor);
  }

  private updateAttackRangeIndicator(): void {
    const x = this.cursorX;
    const y = this.cursorY;

    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    const magnetRadius = this.upgradeSystem.getMagnetRadius();

    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    const currentHp = this.healthSystem.getHp();
    const maxHp = this.healthSystem.getMaxHp();

    this.cursorRenderer.renderAttackIndicator(
      x,
      y,
      cursorRadius,
      this.gaugeRatio,
      magnetRadius,
      magnetLevel,
      electricLevel,
      this.gameTime,
      currentHp,
      maxHp
    );
  }

  private clearAllDishes(): void {
    const activeDishes = this.dishPool.getActiveObjects();
    for (const dish of activeDishes) {
      dish.deactivate();
      this.dishes.remove(dish);
      this.dishPool.release(dish);
    }
  }

  public getDishPool(): ObjectPool<Dish> {
    return this.dishPool;
  }

  public getCursorPosition(): CursorSnapshot {
    return this.getCursorSnapshot();
  }

  public isUpgradeSelectionVisible(): boolean {
    return this.isUpgrading && this.inGameUpgradeUI.isVisible();
  }

  private getHudFrameContext(): HudFrameContext {
    return {
      cursorX: this.cursorX,
      cursorY: this.cursorY,
      isUpgradeSelectionVisible: this.isUpgradeSelectionVisible(),
      isEscPaused: this.isEscPaused,
    };
  }

  private getInputTimestamp(): number {
    const sceneNow = this.time?.now;
    if (typeof sceneNow === 'number' && Number.isFinite(sceneNow)) {
      return sceneNow;
    }
    if (typeof performance !== 'undefined') {
      return performance.now();
    }
    return Date.now();
  }

  private applyCursorPosition(x: number, y: number): void {
    this.targetCursorX = Phaser.Math.Clamp(x, 0, GAME_WIDTH);
    this.targetCursorY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT);
  }

  private applyKeyboardMovement(x: number, y: number): void {
    const clampedX = Phaser.Math.Clamp(x, 0, GAME_WIDTH);
    const clampedY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT);
    this.cursorX = clampedX;
    this.cursorY = clampedY;
    this.targetCursorX = clampedX;
    this.targetCursorY = clampedY;
  }

  private updateCursorSmoothing(delta: number): void {
    // 일시정지/업그레이드/ESC 상태 → 즉시 추적
    if (this.isEscPaused || this.isDockPaused || this.isUpgrading) {
      this.cursorX = this.targetCursorX;
      this.cursorY = this.targetCursorY;
      return;
    }

    const result = computeCursorSmoothing(
      this.cursorX, this.cursorY,
      this.targetCursorX, this.targetCursorY,
      delta,
      Data.gameConfig.player.input.smoothing
    );

    if (!result.skipped) {
      this.cursorX = result.x;
      this.cursorY = result.y;
    }
  }

  private resetMovementInput(): void {
    this.inputController?.resetMovementInput(this.getInputTimestamp());
  }

  private shouldUseKeyboardMovement(timestamp: number = this.getInputTimestamp()): boolean {
    if (!this.inputController) {
      return false;
    }
    return this.inputController.shouldUseKeyboardMovement(timestamp);
  }

  private getCursorSnapshot(): CursorSnapshot {
    return {
      x: this.cursorX,
      y: this.cursorY,
    };
  }

  private setDockPaused(paused: boolean): void {
    if (this.isDockPaused === paused) {
      return;
    }

    this.isDockPaused = paused;
    this.syncSimulationPauseState();
  }

  private syncSimulationPauseState(): void {
    const shouldPauseSimulation = this.isDockPaused;
    if (this.isSimulationPaused === shouldPauseSimulation) {
      return;
    }

    this.isSimulationPaused = shouldPauseSimulation;

    if (shouldPauseSimulation) {
      this.physics.pause();
      this.time.timeScale = 0;
      this.tweens.pauseAll();
      return;
    }

    this.time.timeScale = 1;
    this.tweens.resumeAll();

    if (!this.isGameOver) {
      this.physics.resume();
    }
  }
}
