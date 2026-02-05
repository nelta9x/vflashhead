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
    
    // 커서 다시 표시 (GameScene에서 숨겼을 수 있음)
    this.input.setDefaultCursor('default');

    this.createBackground();
    this.createTitle();
    this.createStats();
    this.createPrompt();

    // 0.5초 후에만 입력을 받도록 설정 (실수 클릭 방지 및 입력 활성화 보장)
    this.time.delayedCall(500, () => {
      // 투명한 사각형을 만들어 화면 전체 클릭 영역 확보
      const zone = this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT);
      zone.setOrigin(0);
      zone.setInteractive();
      
      zone.once('pointerdown', () => {
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('MenuScene');
        });
      });
    });
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
    const title = this.add.text(GAME_WIDTH / 2, 120, 'PLAY RECORD', {
      fontFamily: FONTS.MAIN,
      fontSize: '72px',
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
      fontFamily: FONTS.MAIN,
      fontSize: '24px',
      color: COLORS_HEX.GREEN,
    });

    const timeValue = this.add
      .text(150, -80, this.formatTime(this.stats.time), {
        fontFamily: FONTS.MAIN,
        fontSize: '48px',
        color: COLORS_HEX.GREEN,
      })
      .setOrigin(1, 0);

    // 도달 웨이브
    const waveLabel = this.add.text(-150, 0, 'WAVE REACHED', {
      fontFamily: FONTS.MAIN,
      fontSize: '20px',
      color: COLORS_HEX.WHITE,
    });

    const waveValue = this.add
      .text(150, 0, `${this.stats.wave}`, {
        fontFamily: FONTS.MAIN,
        fontSize: '32px',
        color: COLORS_HEX.YELLOW,
      })
      .setOrigin(1, 0);

    // 최대 콤보
    const comboLabel = this.add.text(-150, 60, 'MAX COMBO', {
      fontFamily: FONTS.MAIN,
      fontSize: '20px',
      color: COLORS_HEX.WHITE,
    });

    const comboValue = this.add
      .text(150, 60, `x${this.stats.maxCombo}`, {
        fontFamily: FONTS.MAIN,
        fontSize: '28px',
        color: COLORS_HEX.MAGENTA,
      })
      .setOrigin(1, 0);

    statsContainer.add([timeLabel, timeValue, waveLabel, waveValue, comboLabel, comboValue]);

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

  private createPrompt(): void {
    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'CLICK TO MENU', {
      fontFamily: FONTS.MAIN,
      fontSize: '24px',
      color: COLORS_HEX.CYAN,
    });
    prompt.setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Power2',
    });
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
