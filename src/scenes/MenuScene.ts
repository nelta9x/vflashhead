import Phaser from 'phaser';
import { COLORS, COLORS_HEX, GAME_WIDTH, GAME_HEIGHT, FONTS } from '../config/constants';

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.createBackground();
    this.createTitle();
    this.createStartButton();
    this.createInstructions();
  }

  private createBackground(): void {
    // 그리드 배경
    const graphics = this.add.graphics();
    graphics.lineStyle(1, COLORS.CYAN, 0.1);

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

    // 스캔라인 효과
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      graphics.lineStyle(1, 0x000000, 0.1);
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_WIDTH, y);
    }
    graphics.strokePath();
  }

  private createTitle(): void {
    // 메인 타이틀
    this.titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 3, 'VIBESHOOTER', {
      fontFamily: FONTS.MAIN,
      fontSize: '72px',
      color: COLORS_HEX.CYAN,
      stroke: COLORS_HEX.WHITE,
      strokeThickness: 2,
    });
    this.titleText.setOrigin(0.5);

    // 글로우 효과
    this.tweens.add({
      targets: this.titleText,
      alpha: { from: 1, to: 0.7 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 서브타이틀
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 3 + 60, '네온 접시깨기 로그라이크', {
        fontFamily: FONTS.KOREAN,
        fontSize: '24px',
        color: COLORS_HEX.MAGENTA,
      })
      .setOrigin(0.5);
  }

  private createStartButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 60;
    const buttonY = GAME_HEIGHT / 2 + 50;

    // 버튼 배경
    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(COLORS.DARK_PURPLE, 0.8);
    buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    buttonBg.lineStyle(3, COLORS.CYAN, 1);
    buttonBg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);

    // 버튼 텍스트
    const buttonText = this.add.text(0, 0, 'START GAME', {
      fontFamily: FONTS.MAIN,
      fontSize: '28px',
      color: COLORS_HEX.CYAN,
    });
    buttonText.setOrigin(0.5);

    // 컨테이너로 묶기
    this.startButton = this.add.container(GAME_WIDTH / 2, buttonY, [buttonBg, buttonText]);

    // 인터랙티브 영역
    const hitArea = new Phaser.Geom.Rectangle(
      -buttonWidth / 2,
      -buttonHeight / 2,
      buttonWidth,
      buttonHeight
    );
    this.startButton.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // 호버 효과
    this.startButton.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(COLORS.CYAN, 0.3);
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      buttonBg.lineStyle(3, COLORS.MAGENTA, 1);
      buttonBg.strokeRoundedRect(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        10
      );
      buttonText.setColor(COLORS_HEX.MAGENTA);
      this.startButton.setScale(1.05);
    });

    this.startButton.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(COLORS.DARK_PURPLE, 0.8);
      buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      buttonBg.lineStyle(3, COLORS.CYAN, 1);
      buttonBg.strokeRoundedRect(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        10
      );
      buttonText.setColor(COLORS_HEX.CYAN);
      this.startButton.setScale(1);
    });

    // 클릭 시 게임 시작
    this.startButton.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }

  private createInstructions(): void {
    const instructions = [
      '접시를 클릭하여 파괴!',
      '빠르게 클릭해서 콤보 쌓기',
      '콤보로 점수 배율 상승',
      '30초마다 업그레이드 선택',
    ];

    instructions.forEach((text, index) => {
      const instructionText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 150 + index * 25, text, {
        fontFamily: FONTS.KOREAN,
        fontSize: '16px',
        color: COLORS_HEX.WHITE,
      });
      instructionText.setOrigin(0.5);
      instructionText.setAlpha(0.7);
    });
  }
}
