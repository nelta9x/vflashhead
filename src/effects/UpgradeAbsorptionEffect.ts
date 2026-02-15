import Phaser from 'phaser';
import { DEPTHS } from '../data/constants';
import { Data } from '../data/DataManager';
import type { SoundSystem } from '../plugins/builtin/services/SoundSystem';

export class UpgradeAbsorptionEffect {
  private readonly scene: Phaser.Scene;
  private readonly cursorPositionFn: () => { x: number; y: number };
  private readonly starburstFn: (x: number, y: number, color: number) => void;
  private readonly soundSystem?: SoundSystem;

  constructor(
    scene: Phaser.Scene,
    cursorPositionFn: () => { x: number; y: number },
    starburstFn: (x: number, y: number, color: number) => void,
    soundSystem?: SoundSystem,
  ) {
    this.scene = scene;
    this.cursorPositionFn = cursorPositionFn;
    this.starburstFn = starburstFn;
    this.soundSystem = soundSystem;
  }

  createUpgradeAbsorption(
    startX: number,
    startY: number,
    _endX: number,
    _endY: number,
    color: number,
    onComplete?: () => void
  ): void {
    const config = Data.feedback.upgradeAbsorption;
    const {
      particleCount,
      duration,
      particleSizeMin,
      particleSizeMax,
      startSpread,
      spreadDuration,
      spreadEase,
      suctionEase,
      suctionDelayMax
    } = config;

    let completedCount = 0;

    for (let i = 0; i < particleCount; i++) {
      const size = Phaser.Math.Between(particleSizeMin, particleSizeMax);
      const particle = this.scene.add.circle(startX, startY, size, color, 1);
      particle.setDepth(DEPTHS.explosionParticle);

      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadDist = Math.random() * startSpread;
      const spreadX = startX + Math.cos(spreadAngle) * spreadDist;
      const spreadY = startY + Math.sin(spreadAngle) * spreadDist;

      this.scene.tweens.add({
        targets: particle,
        x: spreadX,
        y: spreadY,
        alpha: 0.8,
        duration: spreadDuration + Math.random() * 200,
        ease: spreadEase,
        onComplete: () => {
          const delay = Math.random() * suctionDelayMax;
          const currentSpreadX = particle.x;
          const currentSpreadY = particle.y;

          this.scene.tweens.add({
            targets: { progress: 0 },
            progress: 1,
            duration: duration,
            delay: delay,
            ease: suctionEase,
            onUpdate: (_tween, target) => {
              const p = target.progress;
              const cursorPos = this.cursorPositionFn();
              particle.x = currentSpreadX + (cursorPos.x - currentSpreadX) * p;
              particle.y = currentSpreadY + (cursorPos.y - currentSpreadY) * p;
              particle.alpha = 0.8 + 0.2 * p;
              particle.scale = 1 - p;
            },
            onComplete: () => {
              particle.destroy();
              completedCount++;
              if (completedCount === particleCount) {
                const finalPos = this.cursorPositionFn();
                this.createUpgradeImpact(finalPos.x, finalPos.y, color);
                if (onComplete) onComplete();
              }
            },
          });
        }
      });
    }
  }

  private createUpgradeImpact(x: number, y: number, color: number): void {
    this.soundSystem?.playUpgradeSound();

    const config = Data.feedback.upgradeAbsorption;

    const ring = this.scene.add.graphics();
    ring.lineStyle(5, color, 1);
    ring.strokeCircle(0, 0, config.impactRingSize);
    ring.setPosition(x, y);
    ring.setDepth(DEPTHS.explosionRing);

    this.scene.tweens.add({
      targets: ring,
      scaleX: config.impactRingScale,
      scaleY: config.impactRingScale,
      alpha: 0,
      duration: config.impactRingDuration,
      ease: config.impactRingEase,
      onComplete: () => ring.destroy(),
    });

    this.starburstFn(x, y, color);

    const glow = this.scene.add.circle(x, y, config.impactGlowSize, color, 0.8);
    glow.setDepth(DEPTHS.explosionGlow);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: glow,
      scale: config.impactGlowScale,
      alpha: 0,
      duration: config.impactGlowDuration,
      ease: config.impactGlowEase,
      onComplete: () => glow.destroy(),
    });
  }
}
