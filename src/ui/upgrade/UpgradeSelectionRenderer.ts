import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, UPGRADE_UI } from '../../data/constants';
import { Data } from '../../data/DataManager';

export function resolveUpgradeSafeBoxCenterY(baseY: number): number {
  const { BOX_HEIGHT } = UPGRADE_UI;
  const upgradeUiConfig = Data.gameConfig.upgradeUI;
  const abilityConfig = Data.gameConfig.hud.abilityDisplay;
  const gaugeCfg = Data.gameConfig.hud.waveTimerDisplay.dockPauseGauge;
  const dockBottomReserve = gaugeCfg.height + gaugeCfg.bottomInset;

  const abilityPanelHeight = abilityConfig.levelInsideIcon
    ? abilityConfig.iconSize + abilityConfig.panelPaddingY * 2
    : abilityConfig.iconSize +
      abilityConfig.levelOffsetY +
      abilityConfig.levelFontSize +
      abilityConfig.panelPaddingY * 2;
  const abilityTopY = GAME_HEIGHT - abilityConfig.bottomMargin - dockBottomReserve - abilityPanelHeight;
  const maxYWithoutOverlap = abilityTopY - upgradeUiConfig.avoidAbilityUiGap - BOX_HEIGHT / 2;
  const minVisibleY = BOX_HEIGHT / 2 + 20;

  return Math.max(minVisibleY, Math.min(baseY, maxYWithoutOverlap));
}

export function drawUpgradeBoxBackground(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  borderColor: number,
  hovered: boolean,
  isCurse: boolean = false
): void {
  graphics.clear();
  const bgColor = isCurse
    ? (hovered ? COLORS.CURSE_CARD_BG_HOVER : COLORS.CURSE_CARD_BG)
    : (hovered ? COLORS.UPGRADE_CARD_BG_HOVER : COLORS.UPGRADE_CARD_BG);
  graphics.fillStyle(bgColor, 0.95);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
  graphics.lineStyle(hovered ? 6 : 4, borderColor, hovered ? 1 : 0.7);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 20);
}

export function drawUpgradeProgressBar(
  graphics: Phaser.GameObjects.Graphics,
  hoverProgress: number,
  borderColor: number
): void {
  const { BOX_WIDTH, BOX_HEIGHT, HOVER_DURATION } = UPGRADE_UI;
  const barWidth = BOX_WIDTH - 60;
  const barHeight = 10;
  const barY = BOX_HEIGHT / 2 - 40;

  graphics.clear();

  if (hoverProgress > 0) {
    const fillWidth = barWidth * (hoverProgress / HOVER_DURATION);
    graphics.fillStyle(borderColor, 1);
    graphics.fillRoundedRect(-barWidth / 2, barY - barHeight / 2, fillWidth, barHeight, 5);
  }
}
