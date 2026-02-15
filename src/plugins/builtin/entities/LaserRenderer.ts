import Phaser from 'phaser';
import { DEPTHS } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import type { ILaserRenderer } from '../../types/renderers';

export class LaserRenderer implements ILaserRenderer {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTHS.laser);
  }

  public render(
    lasers: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isFiring: boolean;
      progress: number;
    }>
  ): void {
    this.graphics.clear();
    const config = Data.gameConfig.monsterAttack.laser;
    const color = Phaser.Display.Color.HexStringToColor(config.color).color;

    lasers.forEach((laser) => {
      if (laser.isFiring) {
        // 발사 중: 굵고 밝은 선
        this.graphics.lineStyle(config.width, color, config.fireAlpha);
        this.graphics.beginPath();
        this.graphics.moveTo(laser.x1, laser.y1);
        this.graphics.lineTo(laser.x2, laser.y2);
        this.graphics.strokePath();

        // 중앙 코어 (흰색)
        this.graphics.lineStyle(config.width * 0.4, 0xffffff, config.fireAlpha);
        this.graphics.beginPath();
        this.graphics.moveTo(laser.x1, laser.y1);
        this.graphics.lineTo(laser.x2, laser.y2);
        this.graphics.strokePath();
      } else {
        // 경고 중: 가늘고 깜빡이는 선
        const alpha = config.warningAlpha * (0.5 + Math.sin(laser.progress * 40) * 0.5);
        this.graphics.lineStyle(2, color, alpha);
        this.graphics.beginPath();
        this.graphics.moveTo(laser.x1, laser.y1);
        this.graphics.lineTo(laser.x2, laser.y2);
        this.graphics.strokePath();

        // 외곽 점선/가이드 느낌 (선택 사항)
        this.graphics.lineStyle(config.width, color, alpha * 0.3);
        this.graphics.beginPath();
        this.graphics.moveTo(laser.x1, laser.y1);
        this.graphics.lineTo(laser.x2, laser.y2);
        this.graphics.strokePath();
      }
    });
  }

  public clear(): void {
    this.graphics.clear();
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
