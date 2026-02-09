import Phaser from 'phaser';
import { Data } from '../../data/DataManager';

export function renderAbilityDockOverlay(
  graphics: Phaser.GameObjects.Graphics,
  bounds: Phaser.Geom.Rectangle
): void {
  const dockOverlayCfg = Data.gameConfig.hud.waveTimerDisplay.dockOverlay;
  const cornerRadius = Math.min(dockOverlayCfg.cornerRadius, bounds.height / 2);

  graphics.fillStyle(Data.getColor(dockOverlayCfg.bgColor), dockOverlayCfg.bgAlpha);
  graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, cornerRadius);

  const highlightHeight = Math.max(1, Math.min(bounds.height, dockOverlayCfg.highlightHeight));
  graphics.fillStyle(Data.getColor(dockOverlayCfg.highlightColor), dockOverlayCfg.highlightAlpha);
  graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, highlightHeight, cornerRadius);

  graphics.lineStyle(
    dockOverlayCfg.borderWidth,
    Data.getColor(dockOverlayCfg.borderColor),
    dockOverlayCfg.borderAlpha
  );
  graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, cornerRadius);
}

export function renderAbilityDockPauseGauge(
  graphics: Phaser.GameObjects.Graphics,
  bounds: Phaser.Geom.Rectangle,
  progress: number
): void {
  const gaugeCfg = Data.gameConfig.hud.waveTimerDisplay.dockPauseGauge;
  const width = Math.max(1, bounds.width - gaugeCfg.insetX * 2);
  const height = gaugeCfg.height;
  const x = bounds.x + gaugeCfg.insetX;
  const y = bounds.y + bounds.height + gaugeCfg.bottomInset;
  const cornerRadius = Math.min(gaugeCfg.cornerRadius, height / 2);
  const clampedProgress = Math.max(0, Math.min(1, progress));

  graphics.fillStyle(Data.getColor(gaugeCfg.bgColor), gaugeCfg.bgAlpha);
  graphics.fillRoundedRect(x, y, width, height, cornerRadius);

  if (clampedProgress > 0) {
    graphics.fillStyle(Data.getColor(gaugeCfg.fillColor), gaugeCfg.fillAlpha);
    graphics.fillRoundedRect(x, y, width * clampedProgress, height, cornerRadius);
  }

  graphics.lineStyle(
    gaugeCfg.borderWidth,
    Data.getColor(gaugeCfg.borderColor),
    gaugeCfg.borderAlpha
  );
  graphics.strokeRoundedRect(x, y, width, height, cornerRadius);
}
