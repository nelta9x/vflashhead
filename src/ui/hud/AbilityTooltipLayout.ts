import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../data/constants';
import { Data } from '../../data/DataManager';

export function resolveAbilityTooltipPosition(
  slotBounds: Phaser.Geom.Rectangle,
  tooltipHeight: number
): { x: number; y: number } {
  const tooltipCfg = Data.gameConfig.hud.abilityDisplay.tooltip;
  const width = tooltipCfg.width;
  const height = Math.max(tooltipCfg.minHeight, tooltipHeight);

  const halfWidth = width / 2;
  const x = Phaser.Math.Clamp(
    slotBounds.centerX,
    halfWidth + tooltipCfg.screenMargin,
    GAME_WIDTH - halfWidth - tooltipCfg.screenMargin
  );

  const targetBottomY = slotBounds.y - tooltipCfg.offsetY;
  const minBottomY = height + tooltipCfg.screenMargin;
  const maxBottomY = GAME_HEIGHT - tooltipCfg.screenMargin;
  const y = Phaser.Math.Clamp(targetBottomY, minBottomY, maxBottomY);

  return { x, y };
}
