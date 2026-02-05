import Phaser from 'phaser';
import { COLORS, COLORS_HEX, GAME_WIDTH, GAME_HEIGHT, FONTS } from '../../data/constants';
import { SoundSystem } from '../systems/SoundSystem';

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private startPrompt!: Phaser.GameObjects.Text;
  private isTransitioning: boolean = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.createBackground();
    this.createTitle();
    this.createStartUI();
    
    // 입력을 감지하기 위한 이벤트 리스너 등록
    this.setupInputHandlers();
  }

  private createBackground(): void {
    // 그리드 배경
    const graphics = this.add.graphics();
    graphics.lineStyle(1, COLORS.CYAN, 0.05);

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
    // 메인 타이틀
    this.titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'VIBESHOOTER', {
      fontFamily: FONTS.MAIN,
      fontSize: '84px',
      color: COLORS_HEX.CYAN,
      stroke: COLORS_HEX.WHITE,
      strokeThickness: 2,
    });
    this.titleText.setOrigin(0.5);

    // 은은한 글로우/애니메이션
    this.tweens.add({
      targets: this.titleText,
      y: GAME_HEIGHT / 2 - 30,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createStartUI(): void {
    // 시작 안내 텍스트
    this.startPrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, 'CLICK TO START', {
      fontFamily: FONTS.MAIN,
      fontSize: '24px',
      color: COLORS_HEX.CYAN,
    });
    this.startPrompt.setOrigin(0.5);

    this.tweens.add({
      targets: this.startPrompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setupInputHandlers(): void {
    // 아무 키나 입력
    this.input.keyboard?.on('keydown', () => this.startGame());
    
    // 마우스 클릭
    this.input.on('pointerdown', () => this.startGame());

    // 화면 어디든 클릭 시 시작 (안전장치 - 브라우저 네이티브 이벤트)
    const onNativeInput = () => {
      this.startGame();
      window.removeEventListener('mousedown', onNativeInput);
      window.removeEventListener('keydown', onNativeInput);
    };
    window.addEventListener('mousedown', onNativeInput);
    window.addEventListener('keydown', onNativeInput);
  }

  update(): void {
    // 업데이트 로직 불필요
  }

  private async startGame(): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // 사운드 시스템 활성화 및 대기
    const ss = SoundSystem.getInstance();
    await ss.init();
    
    // 시작음 재생
    ss.playSafeSound();

    // 시작 시 강렬한 효과
    this.tweens.add({
      targets: [this.titleText, this.startPrompt],
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.scene.start('GameScene');
      }
    });

    this.cameras.main.fadeOut(400, 0, 0, 0);
  }
}
