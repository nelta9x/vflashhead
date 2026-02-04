import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COLORS_HEX } from '../config/constants';
import { UpgradeSystem, Upgrade } from '../systems/UpgradeSystem';
import { EventBus, GameEvents } from '../utils/EventBus';

export class UpgradeScene extends Phaser.Scene {
  private upgradeSystem!: UpgradeSystem;
  private upgradeCards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'UpgradeScene' });
  }

  init(data: { upgradeSystem: UpgradeSystem }): void {
    this.upgradeSystem = data.upgradeSystem;
  }

  create(): void {
    // 반투명 배경
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8);
    bg.setInteractive();

    // 타이틀
    this.add.text(GAME_WIDTH / 2, 100, 'UPGRADE', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: COLORS_HEX.CYAN,
      stroke: COLORS_HEX.WHITE,
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 150, '업그레이드를 선택하세요', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: COLORS_HEX.WHITE,
    }).setOrigin(0.5);

    // 업그레이드 옵션 가져오기
    const options = this.upgradeSystem.getRandomUpgrades(3);

    // 업그레이드 카드 생성
    this.createUpgradeCards(options);
  }

  private createUpgradeCards(upgrades: Upgrade[]): void {
    const cardWidth = 300;
    const cardHeight = 400;
    const spacing = 50;
    const totalWidth = upgrades.length * cardWidth + (upgrades.length - 1) * spacing;
    const startX = (GAME_WIDTH - totalWidth) / 2 + cardWidth / 2;

    upgrades.forEach((upgrade, index) => {
      const x = startX + index * (cardWidth + spacing);
      const y = GAME_HEIGHT / 2 + 30;

      const card = this.createUpgradeCard(upgrade, x, y, cardWidth, cardHeight);
      this.upgradeCards.push(card);
    });
  }

  private createUpgradeCard(
    upgrade: Upgrade,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // 레어리티별 색상
    const rarityColors: Record<string, number> = {
      common: COLORS.WHITE,
      rare: COLORS.CYAN,
      epic: COLORS.MAGENTA,
      legendary: COLORS.YELLOW,
    };

    const borderColor = rarityColors[upgrade.rarity] || COLORS.WHITE;

    // 카드 배경
    const bg = this.add.graphics();
    bg.fillStyle(0x1a0a2e, 0.95);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 15);
    bg.lineStyle(3, borderColor, 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 15);

    // 레어리티 뱃지
    const rarityText = this.add.text(0, -height / 2 + 30, upgrade.rarity.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: `#${borderColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);

    // 아이콘 (심볼)
    const iconSymbol = this.getUpgradeSymbol(upgrade.id);
    const icon = this.add.text(0, -height / 2 + 100, iconSymbol, {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: `#${borderColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);

    // 이름
    const name = this.add.text(0, -height / 2 + 170, upgrade.name, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: COLORS_HEX.WHITE,
      wordWrap: { width: width - 40 },
      align: 'center',
    }).setOrigin(0.5);

    // 설명
    const description = this.add.text(0, -height / 2 + 230, upgrade.description, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
      wordWrap: { width: width - 40 },
      align: 'center',
    }).setOrigin(0.5, 0);

    // 스택 정보 (있으면)
    const currentStack = this.upgradeSystem.getUpgradeStack(upgrade.id);
    if (currentStack > 0) {
      this.add.text(-width / 2 + 20, -height / 2 + 20, `x${currentStack}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: COLORS_HEX.GREEN,
      }).setOrigin(0, 0);
    }

    container.add([bg, rarityText, icon, name, description]);

    // 인터랙티브 설정
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // 호버 효과
    container.on('pointerover', () => {
      container.setScale(1.05);
      bg.clear();
      bg.fillStyle(0x2a1a4e, 0.95);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 15);
      bg.lineStyle(4, borderColor, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 15);
    });

    container.on('pointerout', () => {
      container.setScale(1);
      bg.clear();
      bg.fillStyle(0x1a0a2e, 0.95);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 15);
      bg.lineStyle(3, borderColor, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 15);
    });

    // 클릭 시 업그레이드 선택
    container.on('pointerdown', () => {
      this.selectUpgrade(upgrade);
    });

    return container;
  }

  private getUpgradeSymbol(upgradeId: string): string {
    const symbols: Record<string, string> = {
      // Common - 시각 효과
      bigger_explosions: '***',
      screen_shake_boost: '~*~',
      hit_sparks: '!*!',
      combo_duration: '...',
      combo_bonus: 'x2',
      // Rare - 범위/연쇄
      aoe_destroy: '(*)',
      explosion_rainbow: 'RGB',
      slow_on_destroy: '>>|',
      screen_flash: '![]',
      combo_duration_big: '>>>',
      split_on_destroy: '->2',
      // Epic - 강력한 효과
      aoe_destroy_enhanced: '(**)',
      freeze_aura: '[F]',
      electric_shock: '/Z/',
      magnet_pull: '(O)',
      piercing_damage: '->|',
      combo_master: 'xN',
      // Legendary - 궁극
      fireworks: '***',
      chain_reaction: '***',
      nuclear_chain: 'NUC',
      black_hole: '(@)',
      combo_god: 'GOD',
    };
    return symbols[upgradeId] || '+';
  }

  private selectUpgrade(upgrade: Upgrade): void {
    // 업그레이드 적용
    this.upgradeSystem.applyUpgrade(upgrade);

    // 선택 효과
    this.cameras.main.flash(200, 0, 255, 255);

    // 씬 종료
    this.time.delayedCall(200, () => {
      EventBus.getInstance().emit(GameEvents.UPGRADE_SELECTED, upgrade);
      this.scene.stop();
    });
  }
}
