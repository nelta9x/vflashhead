import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, DEPTHS } from '../../data/constants';
import { Data } from '../../data/DataManager';
import { UpgradeSystem } from '../../plugins/builtin/services/UpgradeSystem';
import { HoverArea } from './WaveTimerVisibilityPolicy';
import { getUpgradeFallbackSymbol } from '../upgrade/UpgradeIconCatalog';
import { renderAbilityDockOverlay, renderAbilityDockPauseGauge } from './AbilityDockRenderer';
import { resolveAbilityTooltipPosition } from './AbilityTooltipLayout';

interface ActiveAbility {
  id: string;
  level: number;
  iconKey: string;
}

interface AbilitySlot {
  ability: ActiveAbility;
  bounds: Phaser.Geom.Rectangle;
}

export class AbilitySummaryWidget {
  private readonly scene: Phaser.Scene;
  private upgradeSystem: UpgradeSystem | null;
  private readonly container: Phaser.GameObjects.Container;
  private readonly dockOverlay: Phaser.GameObjects.Graphics;
  private readonly dockPauseGauge: Phaser.GameObjects.Graphics;
  private readonly dockResumeHint: Phaser.GameObjects.Text;
  private readonly tooltipContainer: Phaser.GameObjects.Container;
  private readonly tooltipBg: Phaser.GameObjects.Graphics;
  private readonly tooltipIconBg: Phaser.GameObjects.Graphics;
  private tooltipIconContent: Phaser.GameObjects.Image | Phaser.GameObjects.Text | null = null;
  private readonly tooltipNameText: Phaser.GameObjects.Text;
  private readonly tooltipLevelText: Phaser.GameObjects.Text;
  private readonly tooltipDescText: Phaser.GameObjects.Text;
  private entries: Phaser.GameObjects.Container[] = [];
  private abilitySlots: AbilitySlot[] = [];
  private abilitySignature = '';
  private hoverBounds: Phaser.Geom.Rectangle | null = null;
  private hasActiveAbilities = false;
  private tooltipSignature = '';
  private tooltipHeight = 0;

  constructor(scene: Phaser.Scene, upgradeSystem: UpgradeSystem | null) {
    this.scene = scene;
    this.upgradeSystem = upgradeSystem;

    const config = Data.gameConfig.hud.abilityDisplay;
    this.container = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT - config.bottomMargin);
    this.container.setDepth(DEPTHS.abilityDock);
    this.container.setVisible(false);

    this.dockOverlay = this.scene.add.graphics();
    this.dockOverlay.setDepth(DEPTHS.abilityDockOverlay);

    this.dockPauseGauge = this.scene.add.graphics();
    this.dockPauseGauge.setDepth(DEPTHS.abilityDockPauseGauge);

    const dockOverlayCfg = Data.gameConfig.hud.waveTimerDisplay.dockOverlay;
    this.dockResumeHint = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: `${dockOverlayCfg.resumeHintFontSize}px`,
        color: Data.getColorHex(dockOverlayCfg.resumeHintColor),
        stroke: Data.getColorHex(dockOverlayCfg.resumeHintStrokeColor),
        strokeThickness: dockOverlayCfg.resumeHintStrokeThickness,
      })
      .setOrigin(0.5);
    this.dockResumeHint.setAlpha(dockOverlayCfg.resumeHintAlpha);
    this.dockResumeHint.setDepth(DEPTHS.abilityDockResumeHint);
    this.dockResumeHint.setVisible(false);

    const tooltipCfg = Data.gameConfig.hud.abilityDisplay.tooltip;
    this.tooltipContainer = this.scene.add.container(0, 0);
    this.tooltipContainer.setDepth(DEPTHS.abilityTooltip);
    this.tooltipContainer.setVisible(false);

    this.tooltipBg = this.scene.add.graphics();
    this.tooltipContainer.add(this.tooltipBg);

    this.tooltipIconBg = this.scene.add.graphics();
    this.tooltipContainer.add(this.tooltipIconBg);

    this.tooltipNameText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.KOREAN,
        fontSize: `${tooltipCfg.titleFontSize}px`,
        color: Data.getColorHex(tooltipCfg.nameColor),
        stroke: Data.getColorHex(tooltipCfg.textStrokeColor),
        strokeThickness: tooltipCfg.textStrokeThickness,
      })
      .setOrigin(0, 0);
    this.tooltipContainer.add(this.tooltipNameText);

    this.tooltipLevelText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: `${tooltipCfg.levelFontSize}px`,
        color: Data.getColorHex(tooltipCfg.levelColor),
        stroke: Data.getColorHex(tooltipCfg.textStrokeColor),
        strokeThickness: tooltipCfg.textStrokeThickness,
      })
      .setOrigin(0, 0);
    this.tooltipContainer.add(this.tooltipLevelText);

    this.tooltipDescText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.KOREAN,
        fontSize: `${tooltipCfg.descFontSize}px`,
        color: Data.getColorHex(tooltipCfg.descColor),
        stroke: Data.getColorHex(tooltipCfg.textStrokeColor),
        strokeThickness: tooltipCfg.textStrokeThickness,
        lineSpacing: tooltipCfg.lineSpacing,
      })
      .setOrigin(0, 0);
    this.tooltipContainer.add(this.tooltipDescText);
  }

  public setUpgradeSystem(upgradeSystem: UpgradeSystem): void {
    this.upgradeSystem = upgradeSystem;
    this.abilitySignature = '';
  }

  public update(): void {
    const config = Data.gameConfig.hud.abilityDisplay;
    const activeAbilities = this.getActiveAbilities();
    this.hasActiveAbilities = activeAbilities.length > 0;
    const signature = activeAbilities.map((ability) => `${ability.id}:${ability.level}`).join('|');
    const panelHeight = this.getPanelHeight();

    if (activeAbilities.length === 0) {
      this.hoverBounds = this.getDockBounds(this.getBaseDockWidth(), panelHeight);
      this.abilitySlots = [];

      const isStateUnchanged =
        signature === this.abilitySignature && !this.container.visible && this.entries.length === 0;
      if (isStateUnchanged) {
        return;
      }

      this.abilitySignature = signature;
      this.clearEntries();
      this.container.setVisible(false);
      return;
    }

    if (signature === this.abilitySignature) {
      return;
    }
    this.abilitySignature = signature;

    this.clearEntries();
    this.abilitySlots = [];

    const totalWidth =
      activeAbilities.length * config.iconSize + (activeAbilities.length - 1) * config.iconGap;
    const panelWidth = totalWidth + config.panelPaddingX * 2;
    const dockWidth = Math.max(this.getBaseDockWidth(), panelWidth);
    const iconY = 0;

    this.hoverBounds = this.getDockBounds(dockWidth, panelHeight);
    this.container.setPosition(this.hoverBounds.centerX, this.hoverBounds.centerY);

    activeAbilities.forEach((ability, index) => {
      const x = -totalWidth / 2 + config.iconSize / 2 + index * (config.iconSize + config.iconGap);
      const entryContainer = this.scene.add.container(x, 0);

      this.addAbilityIcon(entryContainer, ability, iconY);

      this.container.add(entryContainer);
      this.entries.push(entryContainer);
      this.abilitySlots.push({
        ability,
        bounds: new Phaser.Geom.Rectangle(
          this.container.x + x - config.iconSize / 2,
          this.container.y + iconY - config.iconSize / 2,
          config.iconSize,
          config.iconSize
        ),
      });
    });
  }

  public getHoverArea(): HoverArea | null {
    return this.hoverBounds;
  }

  public getHoverBounds(): Phaser.Geom.Rectangle | null {
    return this.hoverBounds;
  }

  public renderDockInteraction(
    progress: number, visible: boolean, isPaused: boolean, isEscPaused: boolean
  ): void {
    this.dockOverlay.clear();
    this.dockPauseGauge.clear();
    this.dockResumeHint.setVisible(false);
    this.container.setVisible(visible && this.hasActiveAbilities);

    if (!visible || !this.hoverBounds) {
      return;
    }

    renderAbilityDockOverlay(this.dockOverlay, this.hoverBounds);
    renderAbilityDockPauseGauge(this.dockPauseGauge, this.hoverBounds, progress);

    if (isPaused) {
      const dockOverlayCfg = Data.gameConfig.hud.waveTimerDisplay.dockOverlay;
      const hint = isEscPaused
        ? Data.t('pause.resume_hint')
        : Data.t('hud.dock_leave_to_resume');
      this.dockResumeHint.setText(hint);
      this.dockResumeHint.setPosition(
        this.hoverBounds.centerX,
        this.hoverBounds.y - dockOverlayCfg.resumeHintOffsetY
      );
      this.dockResumeHint.setVisible(true);
    }
  }

  public renderAbilityTooltip(cursorX: number, cursorY: number, dockVisible: boolean): void {
    if (!dockVisible || !this.hasActiveAbilities || this.abilitySlots.length === 0) {
      this.hideTooltip();
      return;
    }

    const hoveredSlot = this.abilitySlots.find((slot) => slot.bounds.contains(cursorX, cursorY));
    if (!hoveredSlot) {
      this.hideTooltip();
      return;
    }

    this.updateTooltipContent(hoveredSlot.ability);
    const tooltipPosition = resolveAbilityTooltipPosition(hoveredSlot.bounds, this.tooltipHeight);
    this.tooltipContainer.setPosition(tooltipPosition.x, tooltipPosition.y);
    this.tooltipContainer.setVisible(true);
  }

  public destroy(): void {
    this.clearEntries();
    this.hideTooltip();
    this.tooltipContainer.destroy();
    this.tooltipIconContent = null;
    this.dockResumeHint.destroy();
    this.dockPauseGauge.destroy();
    this.dockOverlay.destroy();
    this.container.destroy();
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  private updateTooltipContent(ability: ActiveAbility): void {
    const tooltipCfg = Data.gameConfig.hud.abilityDisplay.tooltip;
    const name = Data.t(`upgrade.${ability.id}.name`);
    const levelLabel = Data.t('hud.ability_level', ability.level);
    const description = this.upgradeSystem
      ? this.upgradeSystem.getFormattedDescription(ability.id)
      : Data.t(`upgrade.${ability.id}.desc`);
    const tooltipSignature = `${ability.id}:${ability.level}:${name}:${levelLabel}:${description}`;
    if (this.tooltipSignature === tooltipSignature) {
      return;
    }

    this.tooltipSignature = tooltipSignature;
    this.tooltipNameText.setText(name);
    this.tooltipLevelText.setText(levelLabel);
    this.tooltipDescText.setText(description);
    this.tooltipDescText.setWordWrapWidth(tooltipCfg.width - tooltipCfg.paddingX * 2);

    const width = tooltipCfg.width;
    const headerRowHeight = Math.max(
      tooltipCfg.iconSize,
      this.tooltipNameText.height + tooltipCfg.levelNameGap + this.tooltipLevelText.height
    );
    const descHeight = this.tooltipDescText.height;
    const height = Math.max(
      tooltipCfg.minHeight,
      tooltipCfg.paddingY +
        headerRowHeight +
        tooltipCfg.headerBottomGap +
        descHeight +
        tooltipCfg.minBottomPadding
    );
    this.tooltipHeight = height;

    const topY = -height;
    const headerX = -width / 2 + tooltipCfg.paddingX;
    const headerY = topY + tooltipCfg.paddingY;
    const iconX = headerX + tooltipCfg.iconSize / 2;
    const iconY = headerY + headerRowHeight / 2;
    const headerTextX = headerX + tooltipCfg.iconSize + tooltipCfg.headerGap;
    const titleY = headerY;
    const levelY = titleY + this.tooltipNameText.height + tooltipCfg.levelNameGap;
    const descY = headerY + headerRowHeight + tooltipCfg.headerBottomGap;

    this.tooltipNameText.setPosition(headerTextX, titleY);
    this.tooltipLevelText.setPosition(headerTextX, levelY);
    this.tooltipDescText.setPosition(headerX, descY);

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(Data.getColor(tooltipCfg.cardColor), tooltipCfg.cardAlpha);
    this.tooltipBg.fillRoundedRect(-width / 2, -height, width, height, tooltipCfg.cardCornerRadius);
    this.tooltipBg.lineStyle(
      tooltipCfg.cardBorderWidth,
      Data.getColor(tooltipCfg.cardBorderColor),
      tooltipCfg.cardBorderAlpha
    );
    this.tooltipBg.strokeRoundedRect(
      -width / 2,
      -height,
      width,
      height,
      tooltipCfg.cardCornerRadius
    );

    this.tooltipIconBg.clear();
    this.tooltipIconBg.fillStyle(Data.getColor(tooltipCfg.iconBgColor), tooltipCfg.iconBgAlpha);
    this.tooltipIconBg.fillRoundedRect(
      iconX - tooltipCfg.iconSize / 2,
      iconY - tooltipCfg.iconSize / 2,
      tooltipCfg.iconSize,
      tooltipCfg.iconSize,
      tooltipCfg.iconCornerRadius
    );
    this.tooltipIconBg.lineStyle(
      tooltipCfg.iconBorderWidth,
      Data.getColor(tooltipCfg.iconBorderColor),
      tooltipCfg.iconBorderAlpha
    );
    this.tooltipIconBg.strokeRoundedRect(
      iconX - tooltipCfg.iconSize / 2,
      iconY - tooltipCfg.iconSize / 2,
      tooltipCfg.iconSize,
      tooltipCfg.iconSize,
      tooltipCfg.iconCornerRadius
    );

    this.tooltipIconContent?.destroy();
    this.tooltipIconContent = null;

    const iconContentY = iconY;
    if (this.scene.textures.exists(ability.iconKey)) {
      const iconImage = this.scene.add.image(iconX, iconContentY, ability.iconKey);
      iconImage.setDisplaySize(
        tooltipCfg.iconSize - tooltipCfg.iconPadding * 2,
        tooltipCfg.iconSize - tooltipCfg.iconPadding * 2
      );
      this.tooltipContainer.add(iconImage);
      this.tooltipIconContent = iconImage;
    } else {
      const iconText = this.scene.add
        .text(iconX, iconContentY, getUpgradeFallbackSymbol(ability.id), {
          fontFamily: FONTS.MAIN,
          fontSize: `${tooltipCfg.fallbackIconFontSize}px`,
          color: Data.getColorHex(tooltipCfg.descColor),
        })
        .setOrigin(0.5);
      this.tooltipContainer.add(iconText);
      this.tooltipIconContent = iconText;
    }
  }

  private clearEntries(): void {
    this.entries.forEach((entry) => entry.destroy());
    this.entries = [];
  }

  private getActiveAbilities(): ActiveAbility[] {
    const upgradeSystem = this.upgradeSystem;
    if (!upgradeSystem) {
      return [];
    }

    return Data.getActiveAbilityDefinitions()
      .map((definition) => ({
        id: definition.id,
        level: upgradeSystem.getAbilityLevel(definition.id),
        iconKey: definition.icon.key,
      }))
      .filter((ability) => ability.level > 0);
  }

  private getPanelHeight(): number {
    const config = Data.gameConfig.hud.abilityDisplay;
    return config.iconSize + config.panelPaddingY * 2;
  }

  private getBaseDockWidth(): number {
    const waveTimerCfg = Data.gameConfig.hud.waveTimerDisplay;
    const ratio = waveTimerCfg.virtualBarWidthRatio;
    const clampedRatio = Math.max(0.1, Math.min(1, ratio));
    return GAME_WIDTH * clampedRatio;
  }

  private getDockBounds(width: number, panelHeight: number): Phaser.Geom.Rectangle {
    const abilityConfig = Data.gameConfig.hud.abilityDisplay;
    const centerY =
      GAME_HEIGHT - abilityConfig.bottomMargin - this.getDockBottomReserve() - panelHeight / 2;

    return new Phaser.Geom.Rectangle(
      GAME_WIDTH / 2 - width / 2,
      centerY - panelHeight / 2,
      width,
      panelHeight
    );
  }

  private getDockBottomReserve(): number {
    const gaugeCfg = Data.gameConfig.hud.waveTimerDisplay.dockPauseGauge;
    return gaugeCfg.height + gaugeCfg.bottomInset;
  }

  private addAbilityIcon(
    entryContainer: Phaser.GameObjects.Container,
    ability: ActiveAbility,
    iconY: number
  ): void {
    const config = Data.gameConfig.hud.abilityDisplay;

    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(Data.getColor(config.iconBackgroundColor), config.iconBackgroundAlpha);
    iconBg.fillRoundedRect(
      -config.iconSize / 2,
      iconY - config.iconSize / 2,
      config.iconSize,
      config.iconSize,
      config.iconCornerRadius
    );
    iconBg.lineStyle(
      config.iconBorderWidth,
      Data.getColor(config.iconBorderColor),
      config.iconBorderAlpha
    );
    iconBg.strokeRoundedRect(
      -config.iconSize / 2,
      iconY - config.iconSize / 2,
      config.iconSize,
      config.iconSize,
      config.iconCornerRadius
    );
    entryContainer.add(iconBg);

    const iconSize = Math.max(1, config.iconSize - config.iconPadding * 2);
    if (this.scene.textures.exists(ability.iconKey)) {
      const iconImage = this.scene.add.image(0, iconY, ability.iconKey);
      iconImage.setDisplaySize(iconSize, iconSize);
      entryContainer.add(iconImage);
      return;
    }

    const symbol = getUpgradeFallbackSymbol(ability.id);
    const iconText = this.scene.add
      .text(0, iconY, symbol, {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.fallbackIconFontSize}px`,
        color: Data.getColorHex(config.levelTextColor),
      })
      .setOrigin(0.5);
    entryContainer.add(iconText);
  }

}
