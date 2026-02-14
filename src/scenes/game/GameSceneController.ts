import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../data/constants';
import { Data } from '../../data/DataManager';
import { ComboSystem } from '../../systems/ComboSystem';
import { PlayerCursorInputController } from '../../systems/PlayerCursorInputController';
import { WaveSystem } from '../../systems/WaveSystem';
import { HUD } from '../../ui/HUD';
import { InGameUpgradeUI } from '../../ui/InGameUpgradeUI';
import { WaveCountdownUI } from '../../ui/WaveCountdownUI';
import { StarBackground } from '../../effects/StarBackground';
import { World } from '../../world';
import { EventBus, GameEvents } from '../../utils/EventBus';
import { GameEnvironment } from './GameEnvironment';
import type { CursorSnapshot } from './GameSceneContracts';
import type { HudFrameContext, HudInteractionState } from '../../ui/hud/types';
import type { ServiceRegistry } from '../../plugins/ServiceRegistry';

export class GameSceneController {
  private readonly scene: Phaser.Scene;
  private readonly gameEnv: GameEnvironment;
  private readonly world: World;
  private readonly hud: HUD;
  private readonly inGameUpgradeUI: InGameUpgradeUI;
  private readonly starBackground: StarBackground;
  private readonly inputController: PlayerCursorInputController;
  private readonly waveSystem: WaveSystem;
  private readonly comboSystem: ComboSystem;
  private readonly waveCountdownUI: WaveCountdownUI;

  constructor(scene: Phaser.Scene, services: ServiceRegistry) {
    this.scene = scene;
    this.gameEnv = services.get(GameEnvironment);
    this.world = services.get(World);
    this.hud = services.get(HUD);
    this.inGameUpgradeUI = services.get(InGameUpgradeUI);
    this.starBackground = services.get(StarBackground);
    this.inputController = services.get(PlayerCursorInputController);
    this.waveSystem = services.get(WaveSystem);
    this.comboSystem = services.get(ComboSystem);
    this.waveCountdownUI = services.get(WaveCountdownUI);
  }

  // === Game flow ===

  startGame(): void {
    this.waveSystem.startWave(1);
  }

  onWaveCompleted(waveNumber: number): void {
    this.hud.showWaveComplete(waveNumber);
    EventBus.getInstance().emit(GameEvents.WAVE_TRANSITION);
    const expectedWave = waveNumber + 1;
    this.gameEnv.pendingWaveNumber = expectedWave;
    this.scene.time.delayedCall(500, () => {
      if (this.gameEnv.isGameOver) return;
      if (this.gameEnv.pendingWaveNumber !== expectedWave) return;
      this.gameEnv.isUpgrading = true;
      this.inGameUpgradeUI.show();
    });
  }

  onUpgradeSelected(): void {
    if (this.gameEnv.isGameOver) return;
    this.gameEnv.isUpgrading = false;
    const pendingWave = this.gameEnv.pendingWaveNumber;
    this.scene.time.delayedCall(300, () => {
      if (this.gameEnv.isGameOver) return;
      if (this.gameEnv.pendingWaveNumber !== pendingWave) return;
      this.waveSystem.startCountdown(pendingWave);
      this.waveCountdownUI.show(pendingWave);
    });
  }

  getGameOverData(): { maxCombo: number; wave: number; time: number } {
    return {
      maxCombo: this.comboSystem.getMaxCombo(),
      wave: this.waveSystem.getCurrentWave(),
      time: this.world.context.gameTime,
    };
  }

  // === Per-frame ===

  processKeyboardInput(delta: number, timestamp: number): void {
    const playerId = this.world.context.playerId;
    const playerT = this.world.transform.getRequired(playerId);
    const playerI = this.world.playerInput.getRequired(playerId);
    const shouldUseKeyboard = this.inputController.shouldUseKeyboardMovement(timestamp);
    const axis = this.inputController.getKeyboardAxis(delta, timestamp);
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

  updateHudInteraction(delta: number): HudInteractionState {
    return this.hud.updateInteractionState(this.getHudFrameContext(), delta);
  }

  tickGameTime(delta: number): void {
    this.world.context.gameTime += delta;
  }

  syncWorldContext(): void {
    this.world.context.currentWave = this.waveSystem.getCurrentWave();
    const pr = this.world.playerRender.get(this.world.context.playerId);
    if (pr) pr.gameTime = this.world.context.gameTime;
  }

  renderFrame(delta: number, time: number): void {
    this.hud.render(this.world.context.gameTime);
    this.inGameUpgradeUI.update(delta);
    this.starBackground.update(delta, time, Data.gameConfig.gameGrid.speed);
  }

  renderHud(): void {
    this.hud.render(this.world.context.gameTime);
  }

  snapPlayerToTarget(): void {
    const playerId = this.world.context.playerId;
    const input = this.world.playerInput.getRequired(playerId);
    const transform = this.world.transform.getRequired(playerId);
    transform.x = input.targetX;
    transform.y = input.targetY;
  }

  // === State ===

  get isGameOver(): boolean {
    return this.gameEnv.isGameOver;
  }

  get isPaused(): boolean {
    return this.gameEnv.isPaused;
  }

  get isUpgrading(): boolean {
    return this.gameEnv.isUpgrading;
  }

  get isEscPaused(): boolean {
    return this.gameEnv.isEscPaused;
  }

  setDockPaused(paused: boolean): void {
    if (this.gameEnv.isPaused === paused) return;
    this.gameEnv.isPaused = paused;
  }

  setGameOver(): void {
    this.gameEnv.isGameOver = true;
    this.gameEnv.isEscPaused = false;
    this.gameEnv.isPaused = false;
  }

  toggleEscPause(timestamp: number): void {
    this.gameEnv.isEscPaused = !this.gameEnv.isEscPaused;
    if (this.gameEnv.isEscPaused) {
      this.inputController.resetMovementInput(timestamp);
    }
  }

  isUpgradeUIVisible(): boolean {
    return this.gameEnv.isUpgrading && this.inGameUpgradeUI.isVisible();
  }

  getCursorPosition(): CursorSnapshot {
    return this.gameEnv.getCursorPosition();
  }

  applyCursorPosition(x: number, y: number): void {
    const input = this.world.playerInput.get(this.world.context.playerId);
    if (input) {
      input.targetX = Phaser.Math.Clamp(x, 0, GAME_WIDTH);
      input.targetY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT);
    }
  }

  resetMovementInput(timestamp: number): void {
    this.inputController.resetMovementInput(timestamp);
  }

  // === Private ===

  private getHudFrameContext(): HudFrameContext {
    const t = this.world.transform.getRequired(this.world.context.playerId);
    return {
      cursorX: t.x,
      cursorY: t.y,
      isUpgradeSelectionVisible: this.isUpgradeUIVisible(),
      isEscPaused: this.gameEnv.isEscPaused,
    };
  }
}
