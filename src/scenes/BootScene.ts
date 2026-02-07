import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS } from '../data/constants';
import { SoundSystem } from '../systems/SoundSystem';
import { Data } from '../data/DataManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const config = Data.gameConfig.boot;
    // 로딩 바 생성
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();

    const boxWidth = config.progressBar.width;
    const boxHeight = config.progressBar.height;
    const padding = config.progressBar.innerPadding;

    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(GAME_WIDTH / 2 - boxWidth / 2, GAME_HEIGHT / 2 - boxHeight / 2, boxWidth, boxHeight);

    const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - config.loadingText.yOffset, 'LOADING...', {
      fontFamily: FONTS.MAIN,
      fontSize: `${config.loadingText.fontSize}px`,
      color: Data.getColorHex(config.loadingText.color),
    });
    loadingText.setOrigin(0.5, 0.5);

    // 로딩 진행률 표시
    const barColor = Data.getColor(config.progressBar.color);
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(barColor, 1);
      progressBar.fillRect(
        GAME_WIDTH / 2 - (boxWidth - padding) / 2,
        GAME_HEIGHT / 2 - (boxHeight - padding * 2) / 2,
        (boxWidth - padding) * value,
        boxHeight - padding * 2
      );
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // 오디오 에셋 로드
    this.loadAudioAssets();

    // 아이콘 에셋 로드 (SVG)
    this.loadIconAssets();

    // 게임에서 사용할 기본 그래픽 생성 (프로시저럴)
    this.createProceduralAssets();
  }

  private loadAudioAssets(): void {
    const audioConfig = Data.gameConfig.audio;
    // 모든 오디오 설정 항목을 순회하며 로드
    Object.values(audioConfig).forEach((config: any) => {
      if (config.key && config.path) {
        this.load.audio(config.key, config.path);
      }
    });
  }

  private loadIconAssets(): void {
    const icons = [
      'cursor_size',
      'electric_shock',
      'static_discharge',
      'magnet',
      'missile',
      'health_pack',
    ];

    icons.forEach((icon) => {
      this.load.svg(icon, `assets/icons/${icon}.svg`, { width: 64, height: 64 });
    });
  }

  private createProceduralAssets(): void {
    // 플레이어 (네온 삼각형)
    const playerGraphics = this.make.graphics({ x: 0, y: 0 });
    playerGraphics.fillStyle(COLORS.CYAN, 1);
    playerGraphics.beginPath();
    playerGraphics.moveTo(20, 0);
    playerGraphics.lineTo(40, 40);
    playerGraphics.lineTo(0, 40);
    playerGraphics.closePath();
    playerGraphics.fillPath();
    playerGraphics.lineStyle(2, COLORS.WHITE, 1);
    playerGraphics.strokePath();
    playerGraphics.generateTexture('player', 40, 40);
    playerGraphics.destroy();

    // 발사체 (네온 원)
    const projectileGraphics = this.make.graphics({ x: 0, y: 0 });
    projectileGraphics.fillStyle(COLORS.CYAN, 1);
    projectileGraphics.fillCircle(8, 8, 6);
    projectileGraphics.lineStyle(2, COLORS.WHITE, 0.8);
    projectileGraphics.strokeCircle(8, 8, 6);
    projectileGraphics.generateTexture('projectile', 16, 16);
    projectileGraphics.destroy();

    // 기본 접시 (네온 팔각형)
    this.createDishTexture('dish_basic', COLORS.CYAN, 30);
    this.createDishTexture('dish_golden', COLORS.YELLOW, 35);
    this.createDishTexture('dish_crystal', COLORS.MAGENTA, 25);
    this.createDishTexture('dish_bomb', COLORS.RED, 40);

    // 파티클
    const particleGraphics = this.make.graphics({ x: 0, y: 0 });
    particleGraphics.fillStyle(COLORS.WHITE, 1);
    particleGraphics.fillCircle(4, 4, 4);
    particleGraphics.generateTexture('particle', 8, 8);
    particleGraphics.destroy();
  }

  private createDishTexture(key: string, color: number, size: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const sides = 8;
    const centerX = size;
    const centerY = size;

    graphics.fillStyle(color, 0.8);
    graphics.beginPath();

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (size - 5);
      const y = centerY + Math.sin(angle) * (size - 5);
      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }

    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(3, color, 1);
    graphics.strokePath();

    // 내부 원
    graphics.lineStyle(2, 0xffffff, 0.5);
    graphics.strokeCircle(centerX, centerY, size * 0.5);

    graphics.generateTexture(key, size * 2, size * 2);
    graphics.destroy();
  }

  create(): void {
    // 사운드 시스템 사전 초기화
    SoundSystem.getInstance();
    this.scene.start('MenuScene');
  }
}
