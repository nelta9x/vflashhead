import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COLORS_HEX, UPGRADE_UI } from '../config/constants';
import { UpgradeSystem, Upgrade } from '../systems/UpgradeSystem';
import { EventBus, GameEvents } from '../utils/EventBus';

interface UpgradeBox {
  container: Phaser.GameObjects.Container;
  upgrade: Upgrade;
  hoverProgress: number;
  isHovered: boolean;
  progressBar: Phaser.GameObjects.Graphics;
  bg: Phaser.GameObjects.Graphics;
  borderColor: number;
}

export class InGameUpgradeUI {
  private scene: Phaser.Scene;
  private upgradeSystem: UpgradeSystem;
  private boxes: UpgradeBox[] = [];
  private visible: boolean = false;
  private mainContainer!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, upgradeSystem: UpgradeSystem) {
    this.scene = scene;
    this.upgradeSystem = upgradeSystem;
    this.createContainer();
  }

  private createContainer(): void {
    this.mainContainer = this.scene.add.container(0, 0);
    this.mainContainer.setDepth(900);
    this.mainContainer.setVisible(false);
  }

  show(): void {
    if (this.visible) return;

    this.visible = true;
    this.clearBoxes();

    const upgrades = this.upgradeSystem.getRandomUpgrades(3);
    this.createUpgradeBoxes(upgrades);

    this.mainContainer.setVisible(true);
    this.mainContainer.setAlpha(0);

    this.scene.tweens.add({
      targets: this.mainContainer,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
  }

  hide(): void {
    if (!this.visible) return;

    this.scene.tweens.add({
      targets: this.mainContainer,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.visible = false;
        this.mainContainer.setVisible(false);
        this.clearBoxes();
      },
    });
  }

  private clearBoxes(): void {
    this.boxes.forEach((box) => {
      box.container.destroy();
    });
    this.boxes = [];
  }

  private createUpgradeBoxes(upgrades: Upgrade[]): void {
    const { BOX_WIDTH, BOX_SPACING, BOX_Y_OFFSET } = UPGRADE_UI;
    const totalWidth = upgrades.length * BOX_WIDTH + (upgrades.length - 1) * BOX_SPACING;
    const startX = (GAME_WIDTH - totalWidth) / 2 + BOX_WIDTH / 2;
    const y = GAME_HEIGHT - BOX_Y_OFFSET;

    upgrades.forEach((upgrade, index) => {
      const x = startX + index * (BOX_WIDTH + BOX_SPACING);
      const box = this.createUpgradeBox(upgrade, x, y);
      this.boxes.push(box);
    });
  }

  private createUpgradeBox(upgrade: Upgrade, x: number, y: number): UpgradeBox {
    const { BOX_WIDTH, BOX_HEIGHT } = UPGRADE_UI;
    const container = this.scene.add.container(x, y);
    this.mainContainer.add(container);

    const rarityColors: Record<string, number> = {
      common: COLORS.WHITE,
      rare: COLORS.CYAN,
      epic: COLORS.MAGENTA,
      legendary: COLORS.YELLOW,
    };
    const borderColor = rarityColors[upgrade.rarity] || COLORS.WHITE;

    // 배경
    const bg = this.scene.add.graphics();
    this.drawBoxBackground(bg, BOX_WIDTH, BOX_HEIGHT, borderColor, false);
    container.add(bg);

    // 아이콘
    const iconSymbol = this.getUpgradeSymbol(upgrade.id);
    const icon = this.scene.add.text(0, -BOX_HEIGHT / 2 + 25, iconSymbol, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: `#${borderColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    container.add(icon);

    // 이름
    const name = this.scene.add.text(0, -BOX_HEIGHT / 2 + 55, upgrade.name, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: COLORS_HEX.WHITE,
      wordWrap: { width: BOX_WIDTH - 20 },
      align: 'center',
    }).setOrigin(0.5);
    container.add(name);

    // 레어리티 뱃지
    const rarityText = this.scene.add.text(0, BOX_HEIGHT / 2 - 35, upgrade.rarity.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: `#${borderColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    container.add(rarityText);

    // 진행바 배경
    const progressBarBg = this.scene.add.graphics();
    const barWidth = BOX_WIDTH - 40;
    const barHeight = 6;
    const barY = BOX_HEIGHT / 2 - 15;
    progressBarBg.fillStyle(0x333333, 0.8);
    progressBarBg.fillRoundedRect(-barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 3);
    container.add(progressBarBg);

    // 진행바
    const progressBar = this.scene.add.graphics();
    container.add(progressBar);

    return {
      container,
      upgrade,
      hoverProgress: 0,
      isHovered: false,
      progressBar,
      bg,
      borderColor,
    };
  }

  private drawBoxBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    borderColor: number,
    hovered: boolean
  ): void {
    graphics.clear();
    graphics.fillStyle(hovered ? 0x2a1a4e : 0x1a0a2e, 0.95);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    graphics.lineStyle(hovered ? 3 : 2, borderColor, hovered ? 1 : 0.7);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
  }

  private updateProgressBar(box: UpgradeBox): void {
    const { BOX_WIDTH, BOX_HEIGHT, HOVER_DURATION } = UPGRADE_UI;
    const barWidth = BOX_WIDTH - 40;
    const barHeight = 6;
    const barY = BOX_HEIGHT / 2 - 15;

    box.progressBar.clear();

    if (box.hoverProgress > 0) {
      const fillWidth = barWidth * (box.hoverProgress / HOVER_DURATION);
      box.progressBar.fillStyle(box.borderColor, 1);
      box.progressBar.fillRoundedRect(-barWidth / 2, barY - barHeight / 2, fillWidth, barHeight, 3);
    }
  }

  private getUpgradeSymbol(upgradeId: string): string {
    const symbols: Record<string, string> = {
      damage_up: '⚔',
      attack_speed: '⚡',
      dish_slow: '⏱',
      hp_up: '♥',
      heal_on_wave: '✚',
      aoe_destroy: '◎',
      bomb_shield: '🛡',
      lifesteal: '♡',
      combo_heal: '❤',
      cursor_size: '◯',
      critical_chance: '✦',
      aoe_destroy_enhanced: '◉',
      freeze_aura: '❄',
      electric_shock: '⚡',
      bomb_convert: '↻',
      second_chance: '↺',
      magnet_pull: '⊕',
      chain_reaction: '⁂',
      black_hole: '●',
      immortal: '∞',
      time_stop: '⏸',
      auto_destroy: '⟳',
    };
    return symbols[upgradeId] || '★';
  }

  update(delta: number): void {
    if (!this.visible) return;

    const pointer = this.scene.input.activePointer;
    const { BOX_WIDTH, BOX_HEIGHT, HOVER_DURATION } = UPGRADE_UI;

    for (const box of this.boxes) {
      const bounds = new Phaser.Geom.Rectangle(
        box.container.x - BOX_WIDTH / 2,
        box.container.y - BOX_HEIGHT / 2,
        BOX_WIDTH,
        BOX_HEIGHT
      );

      const wasHovered = box.isHovered;
      box.isHovered = bounds.contains(pointer.worldX, pointer.worldY);

      // 호버 상태 변경 시 배경 업데이트
      if (wasHovered !== box.isHovered) {
        this.drawBoxBackground(box.bg, BOX_WIDTH, BOX_HEIGHT, box.borderColor, box.isHovered);
        if (box.isHovered) {
          box.container.setScale(1.05);
        } else {
          box.container.setScale(1);
        }
      }

      if (box.isHovered) {
        // 호버 중: 진행바 증가
        box.hoverProgress += delta;

        if (box.hoverProgress >= HOVER_DURATION) {
          // 선택 완료
          this.selectUpgrade(box.upgrade);
          return;
        }
      } else {
        // 호버 해제: 진행바 빠르게 감소
        box.hoverProgress = Math.max(0, box.hoverProgress - delta * 3);
      }

      this.updateProgressBar(box);
    }
  }

  private selectUpgrade(upgrade: Upgrade): void {
    // 업그레이드 적용
    this.upgradeSystem.applyUpgrade(upgrade);

    // 선택 효과 (플래시)
    this.scene.cameras.main.flash(150, 0, 255, 255, true);

    // UI 숨김 후 이벤트 발행
    this.hide();

    this.scene.time.delayedCall(150, () => {
      EventBus.getInstance().emit(GameEvents.UPGRADE_SELECTED, upgrade);
    });
  }

  isVisible(): boolean {
    return this.visible;
  }

  getBlockedYArea(): number {
    // UI 표시 중 접시 스폰을 피해야 할 Y 영역의 상단 경계
    if (!this.visible) return GAME_HEIGHT;
    return GAME_HEIGHT - UPGRADE_UI.BOX_Y_OFFSET - UPGRADE_UI.BOX_HEIGHT / 2 - 30;
  }

  destroy(): void {
    this.clearBoxes();
    this.mainContainer.destroy();
  }
}
