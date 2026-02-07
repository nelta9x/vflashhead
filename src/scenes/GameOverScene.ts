import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COLORS_HEX, FONTS } from '../data/constants';
import { Data } from '../data/DataManager';
import { SoundSystem } from '../systems/SoundSystem';

interface GameStats {
  maxCombo: number;
  wave: number;
  time: number;
}

export class GameOverScene extends Phaser.Scene {
  private stats!: GameStats;
  private isNewBestWave: boolean = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameStats): void {
    this.stats = data;
    this.isNewBestWave = this.saveBestWave(data.wave);
  }

  private saveBestWave(wave: number): boolean {
    const key = Data.mainMenu.bestWave.localStorageKey;
    const prev = parseInt(localStorage.getItem(key) || '0', 10);
    if (wave > prev) {
      localStorage.setItem(key, String(wave));
      return true;
    }
    return false;
  }

  create(): void {
    this.cameras.main.fadeIn(500);

    // 사운드 시스템 씬 설정
    SoundSystem.getInstance().setScene(this);

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

      const returnToMenu = () => {
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('MenuScene');
        });
      };

      zone.once('pointerdown', returnToMenu);
      
      if (this.input.keyboard) {
        this.input.keyboard.once('keydown-SPACE', returnToMenu);
        this.input.keyboard.once('keydown-ENTER', returnToMenu);
      }
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
    const config = Data.gameConfig.gameOver.title;
    const title = this.add.text(GAME_WIDTH / 2, config.y, Data.t('gameover.title'), {
      fontFamily: FONTS.MAIN,
      fontSize: `${config.fontSize}px`,
      color: Data.getColorHex(config.color),
    });
    title.setOrigin(0.5);
    title.setShadow(0, 0, COLORS_HEX.RED, 15, true, true);
    title.setAlpha(0.75);

    // 은은한 펄스
    this.tweens.add({
      targets: title,
      alpha: { from: 0.75, to: 0.55 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 살짝 글리치
    this.tweens.add({
      targets: title,
      x: { from: GAME_WIDTH / 2 - 2, to: GAME_WIDTH / 2 + 2 },
      duration: 80,
      yoyo: true,
      repeat: -1,
      ease: 'Steps',
      easeParams: [2],
    });
  }

  private createStats(): void {
    const config = Data.gameConfig.gameOver.stats;
    const statsContainer = this.add.container(GAME_WIDTH / 2, config.y - 30);

    // 생존 시간 (최상단, 가장 큰 폰트)
    const timeLabel = this.add.text(-150, -80, Data.t('gameover.survived'), {
      fontFamily: FONTS.MAIN,
      fontSize: `${config.timeLabelFontSize}px`,
      color: COLORS_HEX.GREEN,
    });

    const timeValue = this.add
      .text(150, -80, this.formatTime(this.stats.time), {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.timeValueFontSize}px`,
        color: COLORS_HEX.GREEN,
      })
      .setOrigin(1, 0);

    // 도달 웨이브
    const waveLabel = this.add.text(-150, 0, Data.t('gameover.wave_reached'), {
      fontFamily: FONTS.MAIN,
      fontSize: `${config.labelFontSize}px`,
      color: COLORS_HEX.WHITE,
    });

    const waveValue = this.add
      .text(150, 0, `${this.stats.wave}`, {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.valueFontSize}px`,
        color: COLORS_HEX.YELLOW,
      })
      .setOrigin(1, 0);

    // 최대 콤보
    const comboLabel = this.add.text(-150, 60, Data.t('gameover.max_combo'), {
      fontFamily: FONTS.MAIN,
      fontSize: `${config.labelFontSize}px`,
      color: COLORS_HEX.WHITE,
    });

    const comboValue = this.add
      .text(150, 60, `x${this.stats.maxCombo}`, {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.comboValueFontSize}px`,
        color: COLORS_HEX.MAGENTA,
      })
      .setOrigin(1, 0);

    const children = [timeLabel, timeValue, waveLabel, waveValue, comboLabel, comboValue];

    if (this.isNewBestWave) {
      const bestBadge = this.add.text(160, 0, Data.t('gameover.new_best'), {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.badgeFontSize}px`,
        color: COLORS_HEX.YELLOW,
      });
      bestBadge.setShadow(0, 0, COLORS_HEX.YELLOW, 8, true, true);

      this.tweens.add({
        targets: bestBadge,
        alpha: { from: 1, to: 0.4 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      children.push(bestBadge);
    }

    statsContainer.add(children);

    // 애니메이션
    statsContainer.setAlpha(0);
    this.tweens.add({
      targets: statsContainer,
      alpha: 1,
      y: config.y - 50,
      duration: 500,
      ease: 'Power2',
    });
  }

  private createPrompt(): void {
    const config = Data.gameConfig.gameOver.prompt;
    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - config.yOffset, Data.t('gameover.click_menu'), {
      fontFamily: FONTS.MAIN,
      fontSize: `${config.fontSize}px`,
      color: COLORS_HEX.WHITE,
    });
    prompt.setOrigin(0.5);
    prompt.setShadow(0, 0, COLORS_HEX.CYAN, 10, true, true);

    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      scale: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Cubic.easeInOut',
    });
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
