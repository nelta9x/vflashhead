import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  CURSOR_HITBOX,
  SPAWN_AREA,
  INITIAL_HP,
  DEPTHS,
} from '../data/constants';
import { Data } from '../data/DataManager';
import { Entity } from '../entities/Entity';
import { deactivateEntity } from '../entities/EntityLifecycle';
import { EventBus } from '../utils/EventBus';
import { EntityPoolManager } from '../systems/EntityPoolManager';
import { ComboSystem } from '../systems/ComboSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { HealthSystem } from '../systems/HealthSystem';
import type { HealthPackSystem } from '../systems/HealthPackSystem';
import type { FallingBombSystem } from '../systems/FallingBombSystem';
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
import { C_DishTag } from '../world';
import type { TransformComponent, PlayerInputComponent } from '../world';
import { AbilityManager } from '../systems/AbilityManager';
import { StatusEffectManager } from '../systems/StatusEffectManager';
import { EntityDamageService } from '../systems/EntityDamageService';
import { setSpawnDamageServiceGetter } from '../entities/EntitySpawnInitializer';
import { EntityQueryService } from '../systems/EntityQueryService';
import {
  EntityStatusSystem,
  EntityTimingSystem,
  EntityMovementSystem,
  EntityVisualSystem,
  EntityRenderSystem,
  PlayerTickSystem,
  MagnetSystem,
  CursorAttackSystem,
  BossReactionSystem,
} from '../systems/entity-systems';
import { EntitySystemPipeline } from '../systems/EntitySystemPipeline';
import { World } from '../world';
import { PluginRegistry } from '../plugins/PluginRegistry';
import { ModSystemRegistry } from '../plugins/ModSystemRegistry';
import type { ModSystemContext } from '../plugins/ModSystemRegistry';
import { ModRegistry } from '../plugins/ModRegistry';
import { registerBuiltinAbilities } from '../plugins/builtin/abilities';
import { registerBuiltinEntityTypes } from '../plugins/builtin/entities';
import { registerBuiltinSystemPlugins } from '../plugins/builtin/systems';
import type { SystemPluginContext } from '../plugins/types/SystemPlugin';

export class GameScene extends Phaser.Scene {
  private entityPoolManager!: EntityPoolManager;
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
  private abilityManager!: AbilityManager;
  private statusEffectManager!: StatusEffectManager;
  private entityQueryService!: EntityQueryService;
  private modSystemRegistry!: ModSystemRegistry;
  private entitySystemPipeline!: EntitySystemPipeline;
  private modRegistry!: ModRegistry;
  private ecsWorld!: World;
  private entityDamageService!: EntityDamageService;

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

  // 커서 시스템 (Player entity via ECS World)
  private playerTickSystem!: PlayerTickSystem;
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
    this.time.timeScale = 1;
    this.tweens.resumeAll();

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.DARK_BG)
      .setOrigin(0, 0)
      .setDepth(DEPTHS.background);

    this.gridRenderer = new GridRenderer(this);
    this.dishes = this.add.group();

    this.initializeSystems();
    this.initializeEntities();
    this.initializeRenderers();
    this.initializeGameModules();

    this.eventBinder.bind();
    this.inputAdapter.setup();

    // 초기 커서 위치 동기화 (스무딩 없이 즉시 반영)
    this.snapPlayerToTarget();

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
      () => this.entityPoolManager.getPool('dish')!,
      () => {
        const baseMaxY = this.inGameUpgradeUI.isVisible()
          ? this.inGameUpgradeUI.getBlockedYArea()
          : SPAWN_AREA.maxY;
        return this.getDockSafeSpawnMaxY(baseMaxY);
      },
      () => this.bossCombatCoordinator?.getVisibleBossSnapshots() ?? []
    );

    this.healthSystem = new HealthSystem();
    // HealthPackSystem created after ECS World (see below)
    this.monsterSystem = new MonsterSystem();
    this.gaugeSystem = new GaugeSystem(this.comboSystem);
    // ECS World (BlackHoleSystem, OrbSystem 생성 전 필요)
    this.ecsWorld = new World();

    // MOD 인프라
    this.statusEffectManager = new StatusEffectManager();
    this.modSystemRegistry = new ModSystemRegistry();

    // EntityDamageService 연결
    this.entityDamageService = new EntityDamageService(
      this.ecsWorld,
      this.statusEffectManager,
      (id) => this.findEntityById(id),
      this,
    );
    setSpawnDamageServiceGetter(() => this.entityDamageService);

    // OrbSystem / BlackHoleSystem (World + DamageService 필요)
    this.orbSystem = new OrbSystem(this.upgradeSystem, this.ecsWorld, this.entityDamageService);
    this.blackHoleSystem = new BlackHoleSystem(
      this.upgradeSystem,
      this.ecsWorld,
      this.entityDamageService,
      () => this.bossCombatCoordinator?.getAliveVisibleBossSnapshotsWithRadius() ?? [],
      (bossId: string, amount: number, sourceX: number, sourceY: number, isCritical: boolean) => {
        this.monsterSystem.takeDamage(bossId, amount, sourceX, sourceY);

        const bossTarget = this.bossCombatCoordinator?.getAliveBossTarget(bossId);
        const textX = bossTarget?.x ?? sourceX;
        const textY = bossTarget?.y ?? sourceY;
        this.feedbackSystem.onBossContactDamaged(textX, textY, amount, isCritical);
      },
    );

    // ECS-style entity system pipeline (data-driven 순서)
    this.entitySystemPipeline = new EntitySystemPipeline(Data.gameConfig.entityPipeline);
    this.entitySystemPipeline.register(new EntityStatusSystem(this.ecsWorld, this.statusEffectManager));
    this.entitySystemPipeline.register(new EntityTimingSystem(this.ecsWorld, this.entityDamageService));
    this.entitySystemPipeline.register(new EntityMovementSystem(this.ecsWorld));
    this.entitySystemPipeline.register(new EntityVisualSystem(this.ecsWorld));
    this.entitySystemPipeline.register(new EntityRenderSystem(this.ecsWorld));

    // Boss reaction system (replaces BossEntityBehavior damage/death tweens)
    this.entitySystemPipeline.register(new BossReactionSystem({
      world: this.ecsWorld,
      scene: this,
      feedbackSystem: this.feedbackSystem,
    }));

    // Pipeline-managed magnet + cursor attack systems (replaces DishFieldEffectService)
    this.entitySystemPipeline.register(new MagnetSystem({
      world: this.ecsWorld,
      damageService: this.entityDamageService,
      upgradeSystem: this.upgradeSystem,
      particleManager: this.particleManager,
      getCursor: () => this.getCursorSnapshot(),
    }));
    this.entitySystemPipeline.register(new CursorAttackSystem({
      world: this.ecsWorld,
      damageService: this.entityDamageService,
      upgradeSystem: this.upgradeSystem,
      getCursor: () => this.getCursorSnapshot(),
    }));

    // Register BlackHoleSystem + OrbSystem as pipeline systems
    this.entitySystemPipeline.register(this.blackHoleSystem);
    this.entitySystemPipeline.register(this.orbSystem);

    // Register SystemPlugin-based systems (FallingBombSystem, HealthPackSystem)
    registerBuiltinSystemPlugins();
    const systemCtx: SystemPluginContext = {
      scene: this,
      world: this.ecsWorld,
      entityPoolManager: this.entityPoolManager,
      upgradeSystem: this.upgradeSystem,
      entityDamageService: this.entityDamageService,
      statusEffectManager: this.statusEffectManager,
    };
    for (const plugin of PluginRegistry.getInstance().getAllSystemPlugins().values()) {
      for (const system of plugin.createSystems(systemCtx)) {
        this.entitySystemPipeline.register(system);
      }
    }

    // Cross-system wiring: OrbSystem/BlackHoleSystem → FallingBombSystem
    this.fallingBombSystem = this.entitySystemPipeline.getSystem('core:falling_bomb') as FallingBombSystem;
    this.healthPackSystem = this.entitySystemPipeline.getSystem('core:health_pack') as HealthPackSystem;
    this.orbSystem.setFallingBombSystem(this.fallingBombSystem);
    this.blackHoleSystem.setFallingBombSystem(this.fallingBombSystem);

    // Player entity 생성 (아키타입 기반)
    const playerArchetype = this.ecsWorld.archetypeRegistry.getRequired('player');
    this.ecsWorld.spawnFromArchetype(playerArchetype, 'player', {
      identity: { entityId: 'player', entityType: 'player', isGatekeeper: false },
      transform: { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 },
      health: { currentHp: INITIAL_HP, maxHp: INITIAL_HP, isDead: false },
      statusCache: { isFrozen: false, slowFactor: 1.0, isShielded: false },
      playerInput: {
        targetX: 0, targetY: 0,
        smoothingConfig: Data.gameConfig.player.input.smoothing,
      },
      playerRender: { gaugeRatio: 0, gameTime: 0 },
    });

    // 플러그인 등록 및 초기화
    PluginRegistry.resetInstance();
    registerBuiltinAbilities();
    registerBuiltinEntityTypes();

    // MOD 라이프사이클
    this.modRegistry = new ModRegistry(
      PluginRegistry.getInstance(),
      this.modSystemRegistry,
      this.entitySystemPipeline,
      this.statusEffectManager,
      EventBus.getInstance(),
      this.ecsWorld,
    );
    // Future: new ModLoader().loadMultiple(userMods, this.modRegistry);

    this.abilityManager = new AbilityManager();
    this.abilityManager.init({
      scene: this,
      upgradeSystem: this.upgradeSystem,
      getCursor: () => this.getCursorSnapshot(),
    });

    this.hud = new HUD(this, this.waveSystem, this.healthSystem, this.upgradeSystem);
    this.waveCountdownUI = new WaveCountdownUI(this);
  }

  private initializeEntities(): void {
    this.entityPoolManager = new EntityPoolManager();
    this.entityPoolManager.registerPool('dish', () => new Entity(this), 10, 50);
    this.entityPoolManager.registerPool('boss', () => new Entity(this), 2, 5);
    this.entityPoolManager.registerPool('fallingBomb', () => new Entity(this, { physics: false }), 3, 10);
    this.entityPoolManager.registerPool('healthPack', () => new Entity(this, { physics: false }), 2, 5);

    const dishPool = this.entityPoolManager.getPool('dish')!;
    this.entityQueryService = new EntityQueryService(dishPool);
  }

  private initializeRenderers(): void {
    this.cursorRenderer = new CursorRenderer(this);
    this.cursorRenderer.setDepth(DEPTHS.cursor);

    this.orbRenderer = new OrbRenderer(this);
    this.orbRenderer.setDepth(DEPTHS.orb);

    this.blackHoleRenderer = new BlackHoleRenderer(this);
    this.blackHoleRenderer.setDepth(Data.gameConfig.blackHoleVisual.depth);

    this.laserRenderer = new LaserRenderer(this);
    this.playerAttackRenderer = new PlayerAttackRenderer(this);

    this.starBackground = new StarBackground(this, Data.gameConfig.stars);
    this.starBackground.setDepth(DEPTHS.starBackground);

    // PlayerTickSystem 등록 (cursorRenderer/cursorTrail 의존)
    this.playerTickSystem = new PlayerTickSystem(
      this.ecsWorld,
      this.cursorRenderer,
      this.cursorTrail,
      this.upgradeSystem,
      this.healthSystem,
    );
    this.entitySystemPipeline.register(this.playerTickSystem);
  }

  private initializeGameModules(): void {
    const playerInputConfig = Data.gameConfig.player.input;
    this.inputController = new PlayerCursorInputController({
      pointerPriorityMs: playerInputConfig.pointerPriorityMs,
      keyboardAxisRampUpMs: playerInputConfig.keyboardAxisRampUpMs,
      keyboardEaseInPower: playerInputConfig.keyboardEaseInPower,
      keyboardMinAxisSpeed: playerInputConfig.keyboardMinAxisSpeed,
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
      damageService: this.entityDamageService,
      world: this.ecsWorld,
      statusEffectManager: this.statusEffectManager,
      isGameOver: () => this.isGameOver,
      isPaused: () => this.isDockPaused,
    });

    this.dishLifecycleController = new DishLifecycleController({
      world: this.ecsWorld,
      dishPool: this.entityPoolManager.getPool('dish')!,
      dishes: this.dishes,
      healthSystem: this.healthSystem,
      comboSystem: this.comboSystem,
      upgradeSystem: this.upgradeSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      damageText: this.damageText,
      damageService: this.entityDamageService,
      getPlayerAttackRenderer: () => this.getPlayerAttackRenderer(),
      isAnyLaserFiring: () => this.bossCombatCoordinator.isAnyLaserFiring(),
      isGameOver: () => this.isGameOver,
    });

    this.playerAttackController = new PlayerAttackController({
      scene: this,
      world: this.ecsWorld,
      damageService: this.entityDamageService,
      upgradeSystem: this.upgradeSystem,
      waveSystem: this.waveSystem,
      monsterSystem: this.monsterSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      particleManager: this.particleManager,
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
        const pr = this.ecsWorld.playerRender.get('player');
        if (pr) pr.gaugeRatio = payload.ratio;
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
      onBlackHoleConsumed: (payload) => {
        this.damageText.showText(payload.x, payload.y - 40, Data.t('feedback.black_hole_consumed'), COLORS.CYAN);
      },
    });

    this.inputAdapter = new SceneInputAdapter({
      scene: this,
      inputController: this.inputController,
      getInputTimestamp: () => this.getInputTimestamp(),
      applyCursorPosition: (x, y) => {
        const input = this.ecsWorld.playerInput.get('player');
        if (input) {
          input.targetX = Phaser.Math.Clamp(x, 0, GAME_WIDTH);
          input.targetY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT);
        }
      },
      resetMovementInput: () => this.resetMovementInput(),
      isGameOver: () => this.isGameOver,
      togglePause: () => this.togglePause(),
    });

    // EntityQueryService에 보스 프로바이더 연결
    this.entityQueryService.setBossProvider(() => {
      const bosses: Entity[] = [];
      this.bossCombatCoordinator.forEachBoss((boss) => bosses.push(boss));
      return bosses;
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
    this.modRegistry?.unloadAll();
    EventBus.getInstance().clear();

    this.bossCombatCoordinator?.destroy();
    this.playerAttackController?.destroy();

    this.entityPoolManager.clearAll();
    this.healthPackSystem?.destroy();
    this.healthPackSystem?.clear();
    this.fallingBombSystem?.destroy();
    this.fallingBombSystem?.clear();
    this.monsterSystem?.destroy();
    this.inGameUpgradeUI.destroy();
    this.waveCountdownUI.destroy();

    this.ecsWorld?.clear();
    this.statusEffectManager?.clear();
    this.modSystemRegistry?.clear();
    this.entitySystemPipeline?.clear();

    this.starBackground?.destroy();
    this.gridRenderer?.destroy();
    this.cursorRenderer?.destroy();
    this.laserRenderer?.destroy();
    this.cursorTrail?.destroy();
    this.gaugeSystem?.destroy();
    this.orbRenderer?.destroy();
    this.blackHoleRenderer?.destroy();
    this.blackHoleSystem?.clear();
    this.abilityManager?.destroy();

    this.playerAttackRenderer?.destroy();
    this.playerAttackRenderer = null;
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    const playerT = this.getPlayerTransform();
    const playerI = this.getPlayerInput();

    // 1. 키보드 입력 → transform.x/y + playerInput.targetX/Y
    if (this.inputController) {
      const now = this.getInputTimestamp();
      const shouldUseKeyboard = this.shouldUseKeyboardMovement(now);
      const axis = this.inputController.getKeyboardAxis(delta, now);
      const speed = Data.gameConfig.player.cursorSpeed;
      const moveDistance = (speed * delta) / 1000;
      if (shouldUseKeyboard && axis.isMoving) {
        const newX = Phaser.Math.Clamp(playerT.x + axis.x * moveDistance, 0, GAME_WIDTH);
        const newY = Phaser.Math.Clamp(playerT.y + axis.y * moveDistance, 0, GAME_HEIGHT);
        playerT.x = newX;
        playerT.y = newY;
        playerI.targetX = newX;
        playerI.targetY = newY;
      }
    }

    const hudContext = this.getHudFrameContext();

    // 2. Pause/upgrade 경로: snap + renderOnly
    if (this.isUpgrading) {
      this.snapPlayerToTarget();
      this.setDockPaused(false);
      this.inGameUpgradeUI.update(delta);
      this.hud.update(this.gameTime, hudContext, delta);
      this.starBackground.update(delta, _time, Data.gameConfig.gameGrid.speed);
      this.gridRenderer.update(delta);
      this.playerTickSystem.renderOnly(delta);
      return;
    }

    const hudInteraction = this.hud.updateInteractionState(hudContext, delta);
    this.setDockPaused(hudInteraction.shouldPauseGame || this.isEscPaused);
    if (this.isDockPaused) {
      this.snapPlayerToTarget();
      this.hud.render(this.gameTime);
      this.playerTickSystem.renderOnly(delta);
      return;
    }

    // 3. Active 경로
    this.gameTime += delta;
    const pr = this.ecsWorld.playerRender.get('player');
    if (pr) pr.gameTime = this.gameTime;

    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.update(delta);
    this.waveSystem.update(delta);
    this.upgradeSystem.update(delta, this.gameTime);

    // MOD 인프라: 상태효과 틱을 엔티티 업데이트 전에 실행 (만료 처리 우선)
    this.statusEffectManager.tick(delta);

    // Set context for pipeline-managed systems before they run
    this.blackHoleSystem.setGameTime(this.gameTime);
    this.orbSystem.setContext(
      this.gameTime, playerT.x, playerT.y,
      () => this.bossCombatCoordinator?.getAliveVisibleBossSnapshotsWithRadius() ?? [],
      (bossId: string, amount: number, sourceX: number, sourceY: number) => {
        this.monsterSystem.takeDamage(bossId, amount, sourceX, sourceY);
        const bossTarget = this.bossCombatCoordinator?.getAliveBossTarget(bossId);
        this.feedbackSystem.onBossContactDamaged(
          bossTarget?.x ?? sourceX, bossTarget?.y ?? sourceY, amount, false
        );
      },
    );
    this.fallingBombSystem.setContext(this.gameTime, this.waveSystem.getCurrentWave());
    this.healthPackSystem.setContext(this.gameTime);

    // ECS pipeline: all entity systems including magnet, cursor attack, black hole, orb
    this.entitySystemPipeline.run(delta);

    // 4. pipeline 후 player 위치 사용
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // HealthPackSystem + FallingBombSystem run in pipeline; post-pipeline checks
    this.healthPackSystem.checkCollection(playerT.x, playerT.y, cursorRadius);
    this.fallingBombSystem.checkCursorCollision(playerT.x, playerT.y, cursorRadius);

    this.hud.render(this.gameTime);
    this.inGameUpgradeUI.update(delta);

    this.gridRenderer.update(delta);
    this.starBackground.update(delta, _time, Data.gameConfig.gameGrid.speed);

    // Render outputs from pipeline-managed systems
    this.blackHoleRenderer.render(this.blackHoleSystem.getBlackHoles(), this.gameTime);
    this.orbRenderer.render(this.orbSystem.getOrbs());

    const cursor = this.getCursorSnapshot();
    this.bossCombatCoordinator.update(delta, this.gameTime, cursor);

    // MOD 시스템 실행 (새 효과 적용은 다음 프레임에 반영)
    this.modSystemRegistry.runAll(delta, this.getModSystemContext());
  }

  private getModSystemContext(): ModSystemContext {
    return {
      entities: this.entityQueryService,
      statusEffectManager: this.statusEffectManager,
      eventBus: EventBus.getInstance(),
    };
  }

  private findEntityById(entityId: string): Entity | undefined {
    const node = this.ecsWorld.phaserNode.get(entityId);
    if (node) return node.container as Entity;

    // Fallback: boss lookup
    let found: Entity | undefined;
    this.bossCombatCoordinator.forEachBoss((boss) => {
      if (!found && boss.getEntityId() === entityId) found = boss;
    });
    return found;
  }

  private clearAllDishes(): void {
    for (const [entityId] of this.ecsWorld.query(C_DishTag)) {
      const node = this.ecsWorld.phaserNode.get(entityId);
      if (node) {
        const entity = node.container as Entity;
        deactivateEntity(entity, this.ecsWorld, this.statusEffectManager);
        this.dishes.remove(entity);
        this.entityPoolManager.release('dish', entity);
      }
    }
  }

  public getDishPool() {
    return this.entityPoolManager.getPool('dish')!;
  }

  public getCursorPosition(): CursorSnapshot {
    return this.getCursorSnapshot();
  }

  public isUpgradeSelectionVisible(): boolean {
    return this.isUpgrading && this.inGameUpgradeUI.isVisible();
  }

  // === Player entity helpers ===

  private getPlayerTransform(): TransformComponent {
    return this.ecsWorld.transform.getRequired('player');
  }

  private getPlayerInput(): PlayerInputComponent {
    return this.ecsWorld.playerInput.getRequired('player');
  }

  private snapPlayerToTarget(): void {
    const input = this.getPlayerInput();
    const transform = this.getPlayerTransform();
    transform.x = input.targetX;
    transform.y = input.targetY;
  }

  private getHudFrameContext(): HudFrameContext {
    const t = this.getPlayerTransform();
    return {
      cursorX: t.x,
      cursorY: t.y,
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
    const t = this.getPlayerTransform();
    return { x: t.x, y: t.y };
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
