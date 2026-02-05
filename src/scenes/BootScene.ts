import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS } from '../config/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 로딩 바 생성
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();

    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 25, 320, 50);

    const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'LOADING...', {
      fontFamily: FONTS.MAIN,
      fontSize: '24px',
      color: '#00ffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    // 로딩 진행률 표시
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(COLORS.CYAN, 1);
      progressBar.fillRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // 게임에서 사용할 기본 그래픽 생성 (프로시저럴)
    this.createProceduralAssets();
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
    this.scene.start('MenuScene');
  }
}
