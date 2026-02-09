import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COLORS_HEX, UPGRADE_UI, FONTS } from '../data/constants';
import { Data } from '../data/DataManager';
import { UpgradeSystem, Upgrade } from '../systems/UpgradeSystem';
import { EventBus, GameEvents } from '../utils/EventBus';

import { ParticleManager } from '../effects/ParticleManager';
import {
  CursorPositionProvider,
  resolveCursorPosition,
} from '../scenes/game/CursorPositionProvider';
import { getUpgradeFallbackSymbol } from './upgrade/UpgradeIconCatalog';
import {
  drawUpgradeBoxBackground,
  drawUpgradeProgressBar,
  resolveUpgradeSafeBoxCenterY,
} from './upgrade/UpgradeSelectionRenderer';

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
  private particleManager: ParticleManager;
  private boxes: UpgradeBox[] = [];
  private visible: boolean = false;
  private mainContainer!: Phaser.GameObjects.Container;
  private currentBoxCenterY: number = GAME_HEIGHT - UPGRADE_UI.BOX_Y_OFFSET;
  private readonly cursorProvider?: CursorPositionProvider;

  constructor(
    scene: Phaser.Scene,
    upgradeSystem: UpgradeSystem,
    particleManager: ParticleManager,
    cursorProvider?: CursorPositionProvider
  ) {
    this.scene = scene;
    this.upgradeSystem = upgradeSystem;
    this.particleManager = particleManager;
    this.cursorProvider = cursorProvider;
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

    this.visible = false;
    this.hideWithAnimation();
  }

  private hideWithAnimation(): void {
    this.scene.tweens.add({
      targets: this.mainContainer,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
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
    const baseY = GAME_HEIGHT - BOX_Y_OFFSET;
    const y = resolveUpgradeSafeBoxCenterY(baseY);
    this.currentBoxCenterY = y;

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
    drawUpgradeBoxBackground(bg, BOX_WIDTH, BOX_HEIGHT, borderColor, false);
    container.add(bg);

    // 아이콘 표시 (SVG 스프라이트 또는 텍스트 폴백)
    const iconY = -BOX_HEIGHT / 2 + 80;
    const iconSize = 80;

    // 텍스처가 존재하는지 확인
    if (this.scene.textures.exists(upgrade.id)) {
      const iconSprite = this.scene.add.image(0, iconY, upgrade.id);
      iconSprite.setDisplaySize(iconSize, iconSize);
      iconSprite.setTint(borderColor); // 희귀도 색상 적용
      container.add(iconSprite);
    } else {
      // 텍스처가 없으면 텍스트 심볼 폴백
      const iconSymbol = getUpgradeFallbackSymbol(upgrade.id);
      const icon = this.scene.add
        .text(0, iconY, iconSymbol, {
          fontFamily: FONTS.MAIN,
          fontSize: '60px',
          color: `#${borderColor.toString(16).padStart(6, '0')}`,
        })
        .setOrigin(0.5);
      container.add(icon);
    }

    // 이름
    const textCfg = Data.gameConfig.textSettings;
    const name = this.scene.add
      .text(0, -BOX_HEIGHT / 2 + 150, Data.t(`upgrade.${upgrade.id}.name`), {
        fontFamily: FONTS.KOREAN,
        fontSize: `${textCfg.upgradeUI.nameSize}px`,
        fontStyle: 'normal',
        color: COLORS_HEX.WHITE,
        wordWrap: { width: BOX_WIDTH - 30 },
        align: 'center',
        resolution: textCfg.resolution,
      })
      .setOrigin(0.5, 0);
    container.add(name);

    // 효과 미리보기 설명
    const previewDesc = this.upgradeSystem.getPreviewDescription(upgrade.id);
    const descText = this.scene.add
      .text(0, -BOX_HEIGHT / 2 + 210, previewDesc, {
        fontFamily: FONTS.KOREAN,
        fontSize: `${textCfg.upgradeUI.descSize}px`,
        fontStyle: 'normal',
        color: '#cccccc',
        wordWrap: { width: BOX_WIDTH - 36 },
        align: 'center',
        resolution: textCfg.resolution,
      })
      .setOrigin(0.5, 0);
    container.add(descText);

    // 진행바 배경
    const progressBarBg = this.scene.add.graphics();
    const barWidth = BOX_WIDTH - 60;
    const barHeight = 10;
    const barY = BOX_HEIGHT / 2 - 40;
    progressBarBg.fillStyle(0x333333, 0.8);
    progressBarBg.fillRoundedRect(-barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 5);
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

  private updateProgressBar(box: UpgradeBox): void {
    drawUpgradeProgressBar(box.progressBar, box.hoverProgress, box.borderColor);
  }

  update(delta: number): void {
    if (!this.visible) return;

    const cursorPos = this.getCursorPosition();
    const { BOX_WIDTH, BOX_HEIGHT, HOVER_DURATION } = UPGRADE_UI;

    for (const box of this.boxes) {
      const bounds = new Phaser.Geom.Rectangle(
        box.container.x - BOX_WIDTH / 2,
        box.container.y - BOX_HEIGHT / 2,
        BOX_WIDTH,
        BOX_HEIGHT
      );

      const wasHovered = box.isHovered;
      box.isHovered = bounds.contains(cursorPos.x, cursorPos.y);

      // 호버 상태 변경 시 배경 업데이트
      if (wasHovered !== box.isHovered) {
        drawUpgradeBoxBackground(box.bg, BOX_WIDTH, BOX_HEIGHT, box.borderColor, box.isHovered);
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
          this.selectUpgrade(box);
          return;
        }
      } else {
        // 호버 해제: 진행바 빠르게 감소
        box.hoverProgress = Math.max(0, box.hoverProgress - delta * 3);
      }

      this.updateProgressBar(box);
    }
  }

  private selectUpgrade(box: UpgradeBox): void {
    // 이미 숨김 처리 중이면 무시 (중복 호출 방지)
    if (!this.visible) return;

    const upgrade = box.upgrade;

    // 즉시 visible을 false로 설정하여 중복 호출 방지
    this.visible = false;

    // 업그레이드 적용
    this.upgradeSystem.applyUpgrade(upgrade);

    // 시각적 연출: 카드 위치에서 커서 위치로 입자 흡수
    // box.container.x/y는 mainContainer 내부의 상대 좌표이므로 월드 좌표로 변환 필요
    // mainContainer는 (0,0)에 있으므로 box 좌표가 곧 월드 좌표와 동일함 (단, 카메라 스크롤 없다는 가정)
    const startX = box.container.x;
    const startY = box.container.y;
    const cursorPos = this.getCursorPosition();

    this.particleManager.createUpgradeAbsorption(
      startX,
      startY,
      cursorPos.x,
      cursorPos.y,
      box.borderColor,
      () => {
        // 이펙트 완료 후 이벤트 발생
        EventBus.getInstance().emit(GameEvents.UPGRADE_SELECTED, upgrade);
      }
    );

    // UI 숨김 애니메이션
    this.hideWithAnimation();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getBlockedYArea(): number {
    // UI 표시 중 접시 스폰을 피해야 할 Y 영역의 상단 경계
    if (!this.visible) return GAME_HEIGHT;
    return this.currentBoxCenterY - UPGRADE_UI.BOX_HEIGHT / 2 - 30;
  }

  destroy(): void {
    this.clearBoxes();
    this.mainContainer.destroy();
  }

  private getCursorPosition(): { x: number; y: number } {
    return resolveCursorPosition(this.scene, this.cursorProvider);
  }
}
