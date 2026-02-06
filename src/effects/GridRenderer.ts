import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../data/constants';
import { Data } from '../data/DataManager';

export class GridRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private gridOffset: number = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(Data.gameConfig.gameGrid.depth);
    this.graphics.setBlendMode(Phaser.BlendModes.SCREEN);
  }

  public update(delta: number): void {
    const config = Data.mainMenu.grid;
    const globalConfig = Data.gameConfig.gameGrid;
    
    this.graphics.clear();
    
    const horizonY = GAME_HEIGHT * config.horizonRatio;
    const vanishingPointX = GAME_WIDTH / 2;
    const verticalSpread = 8; // 좌우로 퍼지는 강도

    // 1. 세로선 (원근법)
    this.graphics.lineStyle(globalConfig.lineWidth, COLORS.CYAN, globalConfig.alpha);
    
    for (let i = 0; i <= config.verticalLines!; i++) {
      const xOffset = (i - config.verticalLines! / 2) * (GAME_WIDTH / 25);
      const startX = vanishingPointX + xOffset * 0.08; 
      const endX = vanishingPointX + xOffset * verticalSpread; 

      this.graphics.moveTo(startX, horizonY);
      this.graphics.lineTo(endX, GAME_HEIGHT);
    }

    // 2. 움직이는 가로선 (원근법 적용)
    this.gridOffset += delta * globalConfig.speed;
    const maxRange = config.horizontalLines! * config.size;
    if (this.gridOffset >= config.size) {
      this.gridOffset -= config.size;
    }

    for (let i = 0; i < config.horizontalLines!; i++) {
      const progress = (i * config.size + this.gridOffset) / maxRange;
      const perspectiveProgress = Math.pow(progress, 2.0);
      const y = horizonY + perspectiveProgress * (GAME_HEIGHT - horizonY);

      if (y > GAME_HEIGHT) continue;

      const widthAtY = GAME_WIDTH * verticalSpread;
      this.graphics.moveTo(vanishingPointX - widthAtY / 2, y);
      this.graphics.lineTo(vanishingPointX + widthAtY / 2, y);
    }

    this.graphics.strokePath();

    // 지평선 강조
    this.graphics.lineStyle(2, COLORS.CYAN, globalConfig.alpha * 1.5);
    this.graphics.moveTo(0, horizonY);
    this.graphics.lineTo(GAME_WIDTH, horizonY);
    this.graphics.strokePath();
  }

  public setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
