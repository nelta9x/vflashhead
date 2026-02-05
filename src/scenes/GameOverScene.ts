import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COLORS_HEX, FONTS } from '../data/constants';

interface GameStats {
  maxCombo: number;
  wave: number;
  time: number;
}

export class GameOverScene extends Phaser.Scene {
  private stats!: GameStats;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameStats): void {
    this.stats = data;
  }

  create(): void {
    this.cameras.main.fadeIn(500);

    this.createBackground();
    this.createTitle();
    this.createStats();
    this.createButtons();
  }

  private createBackground(): void {
    const graphics = this.add.graphics();

    // 그리드 배경
    graphics.lineStyle(1, COLORS.RED, 0.1);
    const gridSize = 50;
    for (let x = 0; x < GAME_WIDTH; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_WIDTH, y);
    }
    graphics.strokePath();
  }

  private createTitle(): void {
    const title = this.add.text(GAME_WIDTH / 2, 120, 'GAME OVER', {
              fontFamily: FONTS.MAIN,      fontSize: '72px',
      color: COLORS_HEX.RED,
      stroke: COLORS_HEX.WHITE,
      strokeThickness: 2,
    });
    title.setOrigin(0.5);

    // 글리치 효과
    this.tweens.add({
      targets: title,
      x: { from: GAME_WIDTH / 2 - 3, to: GAME_WIDTH / 2 + 3 },
      duration: 50,
      yoyo: true,
      repeat: -1,
      ease: 'Steps',
      easeParams: [2],
    });
  }

  private createStats(): void {
    const statsContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);

    // 생존 시간 (최상단, 가장 큰 폰트)
    const timeLabel = this.add.text(-150, -80, 'SURVIVED', {
              fontFamily: FONTS.MAIN,      fontSize: '24px',
      color: COLORS_HEX.GREEN,
    });

    const timeValue = this.add.text(150, -80, this.formatTime(this.stats.time), {
              fontFamily: FONTS.MAIN,      fontSize: '48px',
      color: COLORS_HEX.GREEN,
    }).setOrigin(1, 0);

    // 도달 웨이브
    const waveLabel = this.add.text(-150, 0, 'WAVE REACHED', {
              fontFamily: FONTS.MAIN,      fontSize: '20px',
      color: COLORS_HEX.WHITE,
    });

    const waveValue = this.add.text(150, 0, `${this.stats.wave}`, {
              fontFamily: FONTS.MAIN,      fontSize: '32px',
      color: COLORS_HEX.YELLOW,
    }).setOrigin(1, 0);

    // 최대 콤보
    const comboLabel = this.add.text(-150, 60, 'MAX COMBO', {
              fontFamily: FONTS.MAIN,      fontSize: '20px',
      color: COLORS_HEX.WHITE,
    });

    const comboValue = this.add.text(150, 60, `x${this.stats.maxCombo}`, {
              fontFamily: FONTS.MAIN,      fontSize: '28px',
      color: COLORS_HEX.MAGENTA,
    }).setOrigin(1, 0);

    statsContainer.add([
      timeLabel, timeValue,
      waveLabel, waveValue,
      comboLabel, comboValue,
    ]);

    // 애니메이션
    statsContainer.setAlpha(0);
    this.tweens.add({
      targets: statsContainer,
      alpha: 1,
      y: GAME_HEIGHT / 2 - 50,
      duration: 500,
      ease: 'Power2',
    });
  }

  private createButtons(): void {
    // 다시 시작 버튼
    this.createButton(GAME_WIDTH / 2 - 140, GAME_HEIGHT - 150, 'RETRY', COLORS.CYAN, () => {
      this.cameras.main.fadeOut(500);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });

    // 메뉴 버튼
    this.createButton(GAME_WIDTH / 2 + 140, GAME_HEIGHT - 150, 'MENU', COLORS.MAGENTA, () => {
      this.cameras.main.fadeOut(500);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
    });
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: number,
    callback: () => void
  ): void {
    const buttonWidth = 200;
    const buttonHeight = 50;

    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a0a2e, 0.8);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    bg.lineStyle(2, color, 1);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);

    const buttonText = this.add.text(0, 0, text, {
              fontFamily: FONTS.MAIN,      fontSize: '24px',
      color: `#${color.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);

    container.add([bg, buttonText]);

    const hitArea = new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      container.setScale(1.1);
    });

    container.on('pointerout', () => {
      container.setScale(1);
    });

    container.on('pointerdown', callback);
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
