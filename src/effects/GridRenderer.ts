import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../data/constants';
import { Data } from '../data/DataManager';

export class GridRenderer {
  private staticGraphics: Phaser.GameObjects.Graphics;
  private dynamicGraphics: Phaser.GameObjects.Graphics;
  private gridOffset: number = 0;

  /** Dirty-flag key for dynamic layer redraw skip optimization. */
  private lastGridStateKey = '';

  constructor(scene: Phaser.Scene) {
    const depth = Data.gameConfig.gameGrid.depth;

    this.staticGraphics = scene.add.graphics();
    this.staticGraphics.setDepth(depth);
    this.staticGraphics.setBlendMode(Phaser.BlendModes.SCREEN);

    this.dynamicGraphics = scene.add.graphics();
    this.dynamicGraphics.setDepth(depth);
    this.dynamicGraphics.setBlendMode(Phaser.BlendModes.SCREEN);

    this.drawStaticLayer();
  }

  private drawStaticLayer(): void {
    const config = Data.mainMenu.grid;
    const globalConfig = Data.gameConfig.gameGrid;
    const horizonY = GAME_HEIGHT * config.horizonRatio;
    const vanishingPointX = GAME_WIDTH / 2;
    const verticalSpread = 8;

    // 세로선 (원근법) — 완전 정적
    this.staticGraphics.lineStyle(globalConfig.lineWidth, COLORS.CYAN, globalConfig.alpha);

    for (let i = 0; i <= config.verticalLines!; i++) {
      const xOffset = (i - config.verticalLines! / 2) * (GAME_WIDTH / 25);
      const startX = vanishingPointX + xOffset * 0.08;
      const endX = vanishingPointX + xOffset * verticalSpread;

      this.staticGraphics.moveTo(startX, horizonY);
      this.staticGraphics.lineTo(endX, GAME_HEIGHT);
    }

    this.staticGraphics.strokePath();

    // 지평선 강조 — 완전 정적
    this.staticGraphics.lineStyle(2, COLORS.CYAN, globalConfig.alpha * 1.5);
    this.staticGraphics.moveTo(0, horizonY);
    this.staticGraphics.lineTo(GAME_WIDTH, horizonY);
    this.staticGraphics.strokePath();
  }

  public update(delta: number): void {
    const config = Data.mainMenu.grid;
    const globalConfig = Data.gameConfig.gameGrid;

    // Advance grid offset (must happen every frame for smooth scrolling)
    this.gridOffset += delta * globalConfig.speed;
    if (this.gridOffset >= config.size) {
      this.gridOffset -= config.size;
    }

    // Dirty-check: quantize offset to skip redraw when visual change is imperceptible.
    // 30 steps per grid cell — sufficient for 15 horizontal lines with perspective compression.
    const quantizedOffset = (this.gridOffset / config.size * 30) | 0;
    const stateKey = `${quantizedOffset}`;
    if (this.lastGridStateKey === stateKey) return;
    this.lastGridStateKey = stateKey;

    this.dynamicGraphics.clear();

    const horizonY = GAME_HEIGHT * config.horizonRatio;
    const vanishingPointX = GAME_WIDTH / 2;
    const verticalSpread = 8;
    const maxRange = config.horizontalLines! * config.size;

    // 움직이는 가로선 (원근법 적용)
    this.dynamicGraphics.lineStyle(globalConfig.lineWidth, COLORS.CYAN, globalConfig.alpha);

    for (let i = 0; i < config.horizontalLines!; i++) {
      const progress = (i * config.size + this.gridOffset) / maxRange;
      const perspectiveProgress = Math.pow(progress, 2.0);
      const y = horizonY + perspectiveProgress * (GAME_HEIGHT - horizonY);

      if (y > GAME_HEIGHT) continue;

      const widthAtY = GAME_WIDTH * verticalSpread;
      this.dynamicGraphics.moveTo(vanishingPointX - widthAtY / 2, y);
      this.dynamicGraphics.lineTo(vanishingPointX + widthAtY / 2, y);
    }

    this.dynamicGraphics.strokePath();
  }

  public setDepth(depth: number): void {
    this.staticGraphics.setDepth(depth);
    this.dynamicGraphics.setDepth(depth);
  }

  public destroy(): void {
    this.staticGraphics.destroy();
    this.dynamicGraphics.destroy();
  }
}
