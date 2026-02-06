import Phaser from 'phaser';
import { COLORS } from '../data/constants';

export class OrbRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private readonly ORB_COLOR = COLORS.ORB_CORE;
  private readonly GLOW_COLOR = COLORS.ORB_GLOW;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  public render(orbs: Array<{ x: number; y: number; size: number }>): void {
    this.graphics.clear();

    if (orbs.length === 0) return;

    for (const orb of orbs) {
      // "지지직"거리는 느낌을 위한 무작위 노이즈 값들
      const jitterX = (Math.random() - 0.5) * 4;
      const jitterY = (Math.random() - 0.5) * 4;
      const pulse = 1 + Math.sin(Date.now() * 0.02) * 0.1;
      const flicker = 0.7 + Math.random() * 0.3;

      // 1. Outer Glow (Light Blue - pulsing)
      this.graphics.fillStyle(this.GLOW_COLOR, 0.25 * flicker);
      this.graphics.fillCircle(orb.x + jitterX, orb.y + jitterY, orb.size * 2.2 * pulse);

      // 2. Static Aura (White jittering lines)
      this.graphics.lineStyle(2, this.ORB_COLOR, 0.4 * flicker);
      const auraPoints = 8;
      this.graphics.beginPath();
      for (let i = 0; i <= auraPoints; i++) {
        const angle = (i / auraPoints) * Math.PI * 2;
        const dist = orb.size * (1.1 + Math.random() * 0.4);
        const px = orb.x + Math.cos(angle) * dist;
        const py = orb.y + Math.sin(angle) * dist;
        if (i === 0) this.graphics.moveTo(px, py);
        else this.graphics.lineTo(px, py);
      }
      this.graphics.strokePath();

      // 3. Main Body (White)
      this.graphics.fillStyle(this.ORB_COLOR, 0.9);
      this.graphics.fillCircle(orb.x, orb.y, orb.size);

      // 4. Center Highlight (Pure White Glow)
      this.graphics.fillStyle(COLORS.WHITE, 1);
      this.graphics.fillCircle(orb.x, orb.y, orb.size * 0.5);
    }
  }

  public setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  public clear(): void {
    this.graphics.clear();
  }
}
