import Phaser from 'phaser';
import { COLORS } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import type { BlackHoleSnapshot } from '../systems/BlackHoleSystem';

export class BlackHoleRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  public render(blackHoles: BlackHoleSnapshot[], time: number): void {
    this.graphics.clear();
    if (blackHoles.length === 0) return;

    const config = Data.gameConfig.blackHoleVisual;
    const fadeInDuration = Math.max(1, config.fadeInDuration);
    const fadeInStartScale = Phaser.Math.Clamp(config.fadeInStartScale, 0.1, 1);
    const fadeInGlowBoost = Math.max(0, config.fadeInGlowBoost);
    const spawnFlashDuration = Math.max(1, config.spawnFlashDuration);
    const spawnFlashStartScale = Math.max(0.1, config.spawnFlashStartScale);
    const spawnFlashEndScale = Math.max(spawnFlashStartScale, config.spawnFlashEndScale);
    const spawnFlashAlpha = Phaser.Math.Clamp(config.spawnFlashAlpha, 0, 1);
    const spawnFlashLineWidth = Math.max(0.5, config.spawnFlashLineWidth);
    const arcBurstCount = Math.max(1, Math.floor(config.arcBurstCount));

    blackHoles.forEach((hole, index) => {
      const age = Math.max(0, time - hole.spawnedAt);
      const fadeProgress = Phaser.Math.Clamp(age / fadeInDuration, 0, 1);
      const fadeEase = BlackHoleRenderer.easeOutCubic(fadeProgress);
      const fadeScale = BlackHoleRenderer.lerp(fadeInStartScale, 1, fadeEase);
      const fadeGlow = 1 + (1 - fadeEase) * fadeInGlowBoost;

      const pulse = 0.92 + Math.sin(time * 0.004 + index * 1.4) * 0.08;
      const rotation = time * 0.0012 + index * 0.5;
      const outerRadius = hole.radius * fadeScale * pulse;
      const innerRadius = hole.radius * fadeScale * 0.34;

      if (age < spawnFlashDuration) {
        const flashProgress = Phaser.Math.Clamp(age / spawnFlashDuration, 0, 1);
        const flashFade = 1 - flashProgress;
        const flashRadius = hole.radius * BlackHoleRenderer.lerp(
          spawnFlashStartScale,
          spawnFlashEndScale,
          flashProgress
        );

        this.graphics.lineStyle(spawnFlashLineWidth, COLORS.WHITE, spawnFlashAlpha * flashFade);
        this.graphics.strokeCircle(hole.x, hole.y, flashRadius);

        for (let i = 0; i < arcBurstCount; i++) {
          const angle = rotation + (i / arcBurstCount) * Math.PI * 2 + flashProgress * 1.4;
          const startRadius = flashRadius + hole.radius * 0.08;
          const burstLength = hole.radius * (0.14 + flashFade * 0.28);
          const endRadius = startRadius + burstLength;

          const x1 = hole.x + Math.cos(angle) * startRadius;
          const y1 = hole.y + Math.sin(angle) * startRadius;
          const x2 = hole.x + Math.cos(angle) * endRadius;
          const y2 = hole.y + Math.sin(angle) * endRadius;

          this.graphics.lineStyle(1.4, COLORS.CYAN, spawnFlashAlpha * flashFade * 0.8);
          this.graphics.lineBetween(x1, y1, x2, y2);
        }
      }

      this.graphics.fillStyle(COLORS.DARK_BG, Math.min(0.9, 0.48 * fadeGlow * (0.3 + fadeEase * 0.7)));
      this.graphics.fillCircle(hole.x, hole.y, outerRadius);

      this.graphics.lineStyle(2.4, COLORS.MAGENTA, Math.min(0.8, 0.36 * fadeGlow));
      this.graphics.strokeCircle(hole.x, hole.y, outerRadius);

      this.graphics.fillStyle(COLORS.DARK_PURPLE, Math.min(0.95, 0.7 * fadeGlow));
      this.graphics.fillCircle(hole.x, hole.y, innerRadius);

      this.graphics.fillStyle(COLORS.WHITE, Math.min(0.4, 0.12 * fadeGlow * (0.35 + fadeEase * 0.65)));
      this.graphics.fillCircle(hole.x, hole.y, innerRadius * 0.35);

      for (let ring = 0; ring < 3; ring++) {
        const ringRadius = hole.radius * fadeScale * (0.45 + ring * 0.17);
        const start = rotation * (ring % 2 === 0 ? 1 : -1) + ring * 0.7;
        const arcLength = Math.PI * (0.5 - ring * 0.08);
        this.graphics.lineStyle(
          1.6 - ring * 0.3,
          COLORS.CYAN,
          Math.min(0.85, (0.3 - ring * 0.07) * fadeGlow)
        );
        this.graphics.beginPath();
        this.graphics.arc(hole.x, hole.y, ringRadius, start, start + arcLength);
        this.graphics.strokePath();
      }
    });
  }

  private static easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  public setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  public clear(): void {
    this.graphics.clear();
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
