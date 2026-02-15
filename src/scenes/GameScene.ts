import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  DEPTHS,
} from '../data/constants';
import { Data } from '../data/DataManager';
import { EventBus } from '../utils/EventBus';
import { UpgradeSystem } from '../plugins/builtin/services/UpgradeSystem';
import { StatusEffectManager } from '../systems/StatusEffectManager';
import { PlayerCursorInputController } from '../systems/PlayerCursorInputController';
import { GridRenderer } from '../effects/GridRenderer';
import { GameSceneEventBinder } from './game/GameSceneEventBinder';
import { SceneInputAdapter } from './game/SceneInputAdapter';
import { GameSceneController } from './game/GameSceneController';
import type { CursorSnapshot } from './game/GameSceneContracts';
import { AbilityManager } from '../systems/AbilityManager';
import type { EntitySystem } from '../systems/entity-systems/EntitySystem';
import { EntitySystemPipeline } from '../systems/EntitySystemPipeline';
import { World } from '../world';
import { PluginRegistry } from '../plugins/PluginRegistry';
import { ServiceRegistry } from '../plugins/ServiceRegistry';
import { ModSystemRegistry } from '../plugins/ModSystemRegistry';
import { ModRegistry } from '../plugins/ModRegistry';
import { registerBuiltinAbilities } from '../plugins/builtin/abilities';
import { registerBuiltinEntityTypes } from '../plugins/builtin/entities';
import { registerBuiltinServicePlugins } from '../plugins/builtin/services';
import { registerBuiltinSystemPlugins } from '../plugins/builtin/systems';
import type { SystemPluginContext } from '../plugins/types/SystemPlugin';

export class GameScene extends Phaser.Scene {
  private serviceRegistry!: ServiceRegistry;
  private entitySystemPipeline!: EntitySystemPipeline;
  private controller!: GameSceneController;

  private abilityManager!: AbilityManager;
  private modRegistry!: ModRegistry;

  private gridRenderer!: GridRenderer;
  private bgm: Phaser.Sound.BaseSound | null = null;
  private eventBinder!: GameSceneEventBinder;
  private inputAdapter!: SceneInputAdapter;

  // 물리/Tween 상태 (Phaser Scene API 전용)
  private isSimulationPaused = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isSimulationPaused = false;
    this.time.timeScale = 1;
    this.tweens.resumeAll();

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.DARK_BG)
      .setOrigin(0, 0)
      .setDepth(DEPTHS.background);

    this.gridRenderer = new GridRenderer(this);
    this.initializeSystems();

    this.eventBinder = new GameSceneEventBinder(this.serviceRegistry, {
      onWaveCompleted: (waveNumber) => this.controller.onWaveCompleted(waveNumber),
      onUpgradeSelected: () => this.controller.onUpgradeSelected(),
      onGameOver: () => this.gameOver(),
    });

    this.inputAdapter = new SceneInputAdapter({
      scene: this,
      inputController: this.serviceRegistry.get(PlayerCursorInputController),
      getInputTimestamp: () => this.getInputTimestamp(),
      applyCursorPosition: (x, y) => this.controller.applyCursorPosition(x, y),
      resetMovementInput: () => this.controller.resetMovementInput(this.getInputTimestamp()),
      isGameOver: () => this.controller.isGameOver,
      togglePause: () => this.togglePause(),
    });

    this.eventBinder.bind();
    this.inputAdapter.setup();
    this.controller.snapPlayerToTarget();

    this.cameras.main.fadeIn(500);
    this.input.setDefaultCursor('none');

    const bgmConfig = Data.gameConfig.audio.bgm;
    this.bgm = this.sound.add(bgmConfig.key, {
      loop: true,
      volume: bgmConfig.volume,
    });
    this.bgm.play();

    this.controller.startGame();
  }

  private initializeSystems(): void {
    EventBus.getInstance().clear();

    // ── 1. ServiceRegistry ──
    this.serviceRegistry = new ServiceRegistry();
    this.serviceRegistry.set(Phaser.Scene, this as Phaser.Scene);

    // ── 2. ServicePlugin resolve (core:services → core:ecs → core:game_modules) ──
    registerBuiltinServicePlugins();
    for (const pluginId of Data.gameConfig.servicePlugins) {
      const plugin = PluginRegistry.getInstance().getServicePlugin(pluginId);
      this.serviceRegistry.resolveEntries(plugin.services);
    }

    // ── 3. Entity types & abilities (game-config.json 기반 동적 등록) ──
    registerBuiltinAbilities(Data.gameConfig.abilities);
    registerBuiltinEntityTypes(Data.gameConfig.entityTypes);

    // ── 4. SystemPlugin pipeline (includes core:initial_spawn) ──
    const world = this.serviceRegistry.get(World);
    this.entitySystemPipeline = new EntitySystemPipeline(Data.gameConfig.entityPipeline);
    registerBuiltinSystemPlugins();
    const ctx: SystemPluginContext = {
      scene: this,
      world,
      services: this.serviceRegistry,
    };
    for (const pluginId of Data.gameConfig.systemPlugins) {
      const plugin = PluginRegistry.getInstance().getSystemPlugin(pluginId);
      for (const system of plugin.createSystems(ctx)) {
        this.entitySystemPipeline.register(system);
        this.serviceRegistry.set(
          system.constructor as abstract new (...args: unknown[]) => EntitySystem,
          system,
        );
      }
    }
    // startAll() → InitialEntitySpawnSystem.start()에서 player spawn (world.context.playerId 설정)
    this.entitySystemPipeline.startAll({ services: this.serviceRegistry });

    // ── 5. GameSceneController ──
    this.controller = new GameSceneController(this, this.serviceRegistry);

    this.modRegistry = new ModRegistry(
      PluginRegistry.getInstance(),
      this.serviceRegistry.get(ModSystemRegistry),
      this.entitySystemPipeline,
      this.serviceRegistry.get(StatusEffectManager),
      EventBus.getInstance(),
      world,
    );

    this.abilityManager = new AbilityManager();
    this.abilityManager.init({
      scene: this,
      upgradeSystem: this.serviceRegistry.get(UpgradeSystem),
      getCursor: () => this.controller.getCursorPosition(),
    });
  }

  // === CursorPositionProvider (duck-typed for InGameUpgradeUI/ParticleManager) ===

  public getCursorPosition(): CursorSnapshot {
    return this.controller.getCursorPosition();
  }

  // === Update ===

  update(_time: number, delta: number): void {
    if (this.controller.isGameOver) return;

    this.controller.processKeyboardInput(delta, this.getInputTimestamp());

    if (this.controller.isUpgrading) {
      this.controller.snapPlayerToTarget();
      this.controller.setDockPaused(false);
      this.syncSimulationPauseState(false);
      this.controller.updateHudInteraction(delta);
      this.controller.renderFrame(delta, _time);
      this.gridRenderer.update(delta);
      this.entitySystemPipeline.runRenderOnly(delta);
      return;
    }

    const hudInteraction = this.controller.updateHudInteraction(delta);
    const shouldPause = hudInteraction.shouldPauseGame || this.controller.isEscPaused;
    this.controller.setDockPaused(shouldPause);
    this.syncSimulationPauseState(shouldPause);

    if (this.controller.isPaused) {
      this.controller.snapPlayerToTarget();
      this.controller.renderHud();
      this.entitySystemPipeline.runRenderOnly(delta);
      return;
    }

    this.controller.tickGameTime(delta);
    this.controller.syncWorldContext();
    this.entitySystemPipeline.run(delta);

    this.controller.renderFrame(delta, _time);
    this.gridRenderer.update(delta);
  }

  // === Scene lifecycle ===

  private togglePause(): void {
    if (this.controller.isUpgrading) return;
    this.controller.toggleEscPause(this.getInputTimestamp());
  }

  private gameOver(): void {
    this.controller.setGameOver();
    this.syncSimulationPauseState(false);
    this.physics.pause();

    if (this.bgm) this.bgm.stop();

    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.cleanup();
      this.scene.start('GameOverScene', this.controller.getGameOverData());
    });
  }

  private cleanup(): void {
    this.controller.resetMovementInput(this.getInputTimestamp());
    this.eventBinder?.unbind();
    this.inputAdapter?.teardown();
    this.modRegistry?.unloadAll();
    EventBus.getInstance().clear();

    this.entitySystemPipeline?.destroyAll();
    this.abilityManager?.destroy();
    this.gridRenderer?.destroy();
    this.serviceRegistry?.destroyAll();
  }

  // === Internal helpers ===

  private getInputTimestamp(): number {
    const sceneNow = this.time?.now;
    if (typeof sceneNow === 'number' && Number.isFinite(sceneNow)) return sceneNow;
    if (typeof performance !== 'undefined') return performance.now();
    return Date.now();
  }

  private syncSimulationPauseState(shouldPause: boolean): void {
    if (this.isSimulationPaused === shouldPause) return;
    this.isSimulationPaused = shouldPause;

    if (shouldPause) {
      this.physics.pause();
      this.time.timeScale = 0;
      this.tweens.pauseAll();
      return;
    }

    this.time.timeScale = 1;
    this.tweens.resumeAll();
    if (!this.controller.isGameOver) this.physics.resume();
  }
}
