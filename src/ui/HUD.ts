import Phaser from 'phaser';
import { WaveSystem } from '../systems/WaveSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { AbilitySummaryWidget } from './hud/AbilitySummaryWidget';
import { DockPauseController } from './hud/DockPauseController';
import { WaveTimerVisibilityPolicy } from './hud/WaveTimerVisibilityPolicy';
import { WaveTimerWidget } from './hud/WaveTimerWidget';
import { HudFrameContext, HudInteractionState } from './hud/types';
import { Data } from '../data/DataManager';

export class HUD {
  private readonly scene: Phaser.Scene;
  private healthSystem: HealthSystem | null = null;
  private readonly hpContainer: Phaser.GameObjects.Container;
  private readonly waveTimerWidget: WaveTimerWidget;
  private readonly dockPauseController: DockPauseController;
  private abilitySummaryWidget: AbilitySummaryWidget | null = null;
  private dockBarHovered = false;

  constructor(
    scene: Phaser.Scene,
    waveSystem: WaveSystem,
    healthSystem?: HealthSystem,
    upgradeSystem?: UpgradeSystem
  ) {
    this.scene = scene;
    this.healthSystem = healthSystem || null;

    this.hpContainer = this.scene.add.container(0, 0);
    this.hpContainer.setVisible(false);

    this.waveTimerWidget = new WaveTimerWidget(this.scene, waveSystem);
    this.dockPauseController = new DockPauseController(
      Data.gameConfig.hud.waveTimerDisplay.dockPauseHoldDurationMs
    );

    if (upgradeSystem) {
      this.abilitySummaryWidget = new AbilitySummaryWidget(this.scene, upgradeSystem);
    }
  }

  public setHealthSystem(healthSystem: HealthSystem): void {
    this.healthSystem = healthSystem;
    this.updateHpDisplay();
  }

  public setUpgradeSystem(upgradeSystem: UpgradeSystem): void {
    if (this.abilitySummaryWidget) {
      this.abilitySummaryWidget.setUpgradeSystem(upgradeSystem);
      return;
    }

    this.abilitySummaryWidget = new AbilitySummaryWidget(this.scene, upgradeSystem);
  }

  public updateInteractionState(context: HudFrameContext, deltaMs: number): HudInteractionState {
    this.abilitySummaryWidget?.update();
    const hoverArea = this.abilitySummaryWidget?.getHoverArea() ?? null;
    this.dockBarHovered = hoverArea ? hoverArea.contains(context.cursorX, context.cursorY) : false;

    const dockPauseState = this.dockPauseController.update({
      isEnabled: !context.isUpgradeSelectionVisible,
      isHovered: this.dockBarHovered,
      deltaMs,
    });

    const isDockOverlayVisible =
      context.isUpgradeSelectionVisible || this.dockBarHovered
      || dockPauseState.progress > 0 || context.isEscPaused;

    const effectiveProgress = context.isEscPaused ? 1 : dockPauseState.progress;
    const effectivePaused = dockPauseState.shouldPauseGame || context.isEscPaused;

    this.abilitySummaryWidget?.renderDockInteraction(
      effectiveProgress, isDockOverlayVisible, effectivePaused, context.isEscPaused
    );
    this.abilitySummaryWidget?.renderAbilityTooltip(
      context.cursorX,
      context.cursorY,
      isDockOverlayVisible
    );

    const shouldShowWaveTimer = WaveTimerVisibilityPolicy.shouldShow({
      isUpgradeSelectionVisible: context.isUpgradeSelectionVisible,
      hoverArea,
      cursorX: context.cursorX,
      cursorY: context.cursorY,
    });

    this.waveTimerWidget.setWaveTimerVisible(shouldShowWaveTimer);
    return {
      isDockBarHovered: this.dockBarHovered,
      shouldPauseGame: dockPauseState.shouldPauseGame,
      dockPauseProgress: dockPauseState.progress,
    };
  }

  public render(gameTime: number): void {
    this.updateHpDisplay();
    this.waveTimerWidget.update(gameTime);
  }

  public update(gameTime: number, context: HudFrameContext, deltaMs: number): HudInteractionState {
    const interactionState = this.updateInteractionState(context, deltaMs);
    this.render(gameTime);
    return interactionState;
  }

  public getDockHoverArea(): Phaser.Geom.Rectangle | null {
    return this.abilitySummaryWidget?.getHoverBounds() ?? null;
  }

  public showHpLoss(): void {
    if (!this.hpContainer.visible) {
      return;
    }

    this.scene.tweens.add({
      targets: this.hpContainer,
      x: this.hpContainer.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }

  public showWaveComplete(waveNumber: number): void {
    this.waveTimerWidget.showWaveComplete(waveNumber);
  }

  private updateHpDisplay(): void {
    if (!this.healthSystem || !this.hpContainer.visible) {
      return;
    }
  }
}
