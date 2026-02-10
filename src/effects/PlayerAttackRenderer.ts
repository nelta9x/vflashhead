import Phaser from 'phaser';
import { COLORS, DEPTHS } from '../data/constants';

export interface ChargeVisualConfig {
  initialRadius: number;
  maxScale: number;
  glowInitialAlpha: number;
  glowMaxAlpha: number;
  glowInitialRadius: number;
  glowMaxRadius: number;
  lightningChanceBase: number;
  lightningChanceP: number;
  lightningSegments: number;
  particleFrequency: number;
  energyConverge: {
    color: string;
    particleCount: number;
    outerRadiusMultiplier: number;
    outerRadiusPadding: number;
    innerRadius: number;
    minParticleRadius: number;
    maxParticleRadius: number;
    swirlTurns: number;
    alphaMin: number;
    alphaMax: number;
    wobbleRadius: number;
    angleJitter: number;
    radiusJitter: number;
    alphaFlicker: number;
    chaosRateMin: number;
    chaosRateMax: number;
  };
}

export interface ChargeVisualHandle {
  update(progress: number, x: number, y: number, cursorRadius: number): void;
  destroy(): void;
}

export interface MissileTrailConfig {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  trailWidth: number;
  mainColor: number;
  innerColor: number;
  trailAlpha: number;
  trailLifespan: number;
}

export interface BombWarningConfig {
  duration: number;
  radius: number;
  blinkInterval: number;
}

export interface PreFireCursorGlowConfig {
  duration: number;
  outerRadiusMultiplier: number;
  outerRadiusPadding: number;
  maxScale: number;
  alpha: number;
  ringWidth: number;
  ringAlpha: number;
}

interface EnergyConvergeParticleSeed {
  angle: number;
  phase: number;
  radius: number;
  alphaScale: number;
  swirlDirection: number;
  radialRateA: number;
  radialRateB: number;
  alphaRate: number;
  noiseWeight: number;
}

export class PlayerAttackRenderer {
  private readonly scene: Phaser.Scene;
  private readonly activeGraphics = new Set<Phaser.GameObjects.Graphics>();
  private readonly activeProjectiles = new Set<Phaser.GameObjects.Arc>();
  private readonly activeEmitters = new Set<Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly activeTimers = new Set<Phaser.Time.TimerEvent>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public createChargeVisual(
    mainColor: number,
    accentColor: number,
    config: ChargeVisualConfig
  ): ChargeVisualHandle {
    const projectile = this.scene.add.circle(0, 0, config.initialRadius, mainColor);
    projectile.setDepth(DEPTHS.projectile);
    this.activeProjectiles.add(projectile);

    const glow = this.scene.add.graphics();
    glow.setDepth(DEPTHS.projectileGlow);
    this.activeGraphics.add(glow);

    const convergeEnergy = this.scene.add.graphics();
    convergeEnergy.setDepth(DEPTHS.convergeEnergy);
    this.activeGraphics.add(convergeEnergy);

    const chargeParticles = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: -100, max: -300 },
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      blendMode: 'ADD',
      tint: accentColor,
      emitting: true,
      frequency: config.particleFrequency,
    });
    chargeParticles.setDepth(DEPTHS.chargeParticle);
    this.activeEmitters.add(chargeParticles);

    const lightning = this.scene.add.graphics();
    lightning.setDepth(DEPTHS.lightning);
    this.activeGraphics.add(lightning);

    const convergeConfig = config.energyConverge;
    const convergeColor = Phaser.Display.Color.HexStringToColor(convergeConfig.color).color;
    const minParticleRadius = Math.min(
      convergeConfig.minParticleRadius,
      convergeConfig.maxParticleRadius
    );
    const maxParticleRadius = Math.max(
      convergeConfig.minParticleRadius,
      convergeConfig.maxParticleRadius
    );
    const particleCount = Math.max(0, Math.floor(convergeConfig.particleCount));
    const minChaosRate = Math.min(convergeConfig.chaosRateMin, convergeConfig.chaosRateMax);
    const maxChaosRate = Math.max(convergeConfig.chaosRateMin, convergeConfig.chaosRateMax);
    const resolveChaosRate = () => minChaosRate + Math.random() * (maxChaosRate - minChaosRate);
    const convergeSeeds: EnergyConvergeParticleSeed[] = Array.from(
      { length: particleCount },
      () => ({
        angle: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        radius: minParticleRadius + Math.random() * (maxParticleRadius - minParticleRadius),
        alphaScale: 0.7 + Math.random() * 0.3,
        swirlDirection: Math.random() < 0.5 ? -1 : 1,
        radialRateA: resolveChaosRate(),
        radialRateB: resolveChaosRate(),
        alphaRate: resolveChaosRate(),
        noiseWeight: 0.35 + Math.random() * 0.65,
      })
    );

    return {
      update: (progress: number, x: number, y: number, cursorRadius: number) => {
        const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);

        projectile.setPosition(x, y);
        projectile.setScale(1 + clampedProgress * (config.maxScale - 1));
        chargeParticles.setPosition(x, y);

        const glowAlpha =
          config.glowInitialAlpha + clampedProgress * (config.glowMaxAlpha - config.glowInitialAlpha);
        glow.clear();
        glow.fillStyle(mainColor, glowAlpha * clampedProgress);
        glow.fillCircle(
          x,
          y,
          config.glowInitialRadius + clampedProgress * (config.glowMaxRadius - config.glowInitialRadius)
        );
        glow.fillStyle(COLORS.WHITE, 0.5 * clampedProgress);
        glow.fillCircle(x, y, 10 + clampedProgress * 20);

        convergeEnergy.clear();
        const startRadius = Math.max(
          cursorRadius * convergeConfig.outerRadiusMultiplier,
          cursorRadius + convergeConfig.outerRadiusPadding
        );
        const convergeRadius =
          startRadius + (convergeConfig.innerRadius - startRadius) * clampedProgress;
        const baseAlpha =
          convergeConfig.alphaMin +
          (convergeConfig.alphaMax - convergeConfig.alphaMin) * clampedProgress;
        const swirlRotation = convergeConfig.swirlTurns * Math.PI * 2 * clampedProgress;
        const irregularityScale = 1 - clampedProgress;
        const chaosTime = clampedProgress * Math.PI * 2;
        const alphaFlicker = Phaser.Math.Clamp(convergeConfig.alphaFlicker, 0, 1);

        convergeSeeds.forEach((seed) => {
          const wobble =
            Math.sin(seed.phase + chaosTime * seed.radialRateA) *
            convergeConfig.wobbleRadius *
            irregularityScale;
          const radialJitter =
            (Math.sin(seed.phase * seed.noiseWeight + chaosTime * seed.radialRateA) +
              Math.cos(seed.phase + chaosTime * seed.radialRateB) * seed.noiseWeight) *
            convergeConfig.radiusJitter *
            irregularityScale;
          const currentRadius = Math.max(0, convergeRadius + wobble + radialJitter);
          const angleJitter =
            Math.sin(seed.phase + chaosTime * seed.radialRateA) *
            convergeConfig.angleJitter *
            irregularityScale;
          const angle = seed.angle + seed.swirlDirection * swirlRotation + angleJitter;
          const particleX = x + Math.cos(angle) * currentRadius;
          const particleY = y + Math.sin(angle) * currentRadius;
          const flicker =
            1 - alphaFlicker * Math.abs(Math.sin(seed.phase + chaosTime * seed.alphaRate));
          const particleAlpha = Phaser.Math.Clamp(baseAlpha * seed.alphaScale * flicker, 0, 1);

          convergeEnergy.fillStyle(convergeColor, particleAlpha);
          convergeEnergy.fillCircle(particleX, particleY, seed.radius);
        });

        lightning.clear();
        if (
          Math.random() <
          config.lightningChanceBase + clampedProgress * config.lightningChanceP
        ) {
          lightning.lineStyle(2, accentColor, 0.8);
          let lastX = x + (Math.random() - 0.5) * 100 * (1 - clampedProgress / 2);
          let lastY = y + (Math.random() - 0.5) * 100 * (1 - clampedProgress / 2);

          lightning.beginPath();
          lightning.moveTo(lastX, lastY);
          for (let i = 1; i <= config.lightningSegments; i++) {
            const tx = x + (Math.random() - 0.5) * 10 * clampedProgress;
            const ty = y + (Math.random() - 0.5) * 10 * clampedProgress;
            const nextX =
              lastX + (tx - lastX) * (i / config.lightningSegments) + (Math.random() - 0.5) * 20;
            const nextY =
              lastY + (ty - lastY) * (i / config.lightningSegments) + (Math.random() - 0.5) * 20;
            lightning.lineTo(nextX, nextY);
            lastX = nextX;
            lastY = nextY;
          }
          lightning.strokePath();
        }
      },
      destroy: () => {
        projectile.destroy();
        glow.destroy();
        convergeEnergy.destroy();
        lightning.destroy();
        chargeParticles.destroy();
        this.activeProjectiles.delete(projectile);
        this.activeGraphics.delete(glow);
        this.activeGraphics.delete(convergeEnergy);
        this.activeGraphics.delete(lightning);
        this.activeEmitters.delete(chargeParticles);
      },
    };
  }

  public createMissile(
    x: number,
    y: number,
    radius: number,
    color: number,
    depth: number = DEPTHS.projectile
  ): Phaser.GameObjects.Arc {
    const missile = this.scene.add.circle(x, y, radius, color);
    missile.setDepth(depth);
    this.activeProjectiles.add(missile);
    return missile;
  }

  public destroyProjectile(projectile: Phaser.GameObjects.Arc): void {
    projectile.destroy();
    this.activeProjectiles.delete(projectile);
  }

  public spawnMissileTrail(config: MissileTrailConfig): void {
    const trail = this.scene.add.graphics();
    trail.setDepth(DEPTHS.missileTrail);
    this.activeGraphics.add(trail);

    trail.lineStyle(config.trailWidth, config.mainColor, config.trailAlpha);
    trail.lineBetween(config.fromX, config.fromY, config.toX, config.toY);

    trail.lineStyle(config.trailWidth * 0.4, config.innerColor, config.trailAlpha * 1.5);
    trail.lineBetween(config.fromX, config.fromY, config.toX, config.toY);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: config.trailLifespan,
      onComplete: () => {
        trail.destroy();
        this.activeGraphics.delete(trail);
      },
    });
  }

  public showPreFireCursorGlow(
    x: number,
    y: number,
    cursorRadius: number,
    color: number,
    config: PreFireCursorGlowConfig
  ): void {
    const glow = this.scene.add.graphics();
    glow.setDepth(DEPTHS.explosionGlow);
    this.activeGraphics.add(glow);

    const pulse = { progress: 0 };
    this.scene.tweens.add({
      targets: pulse,
      progress: 1,
      duration: config.duration,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        if (!this.activeGraphics.has(glow)) return;

        const p = Phaser.Math.Clamp(pulse.progress, 0, 1);
        const baseRadius = Math.max(
          cursorRadius * config.outerRadiusMultiplier,
          cursorRadius + config.outerRadiusPadding
        );
        const glowRadius = baseRadius * (1 + p * (config.maxScale - 1));
        const fadeAlpha = Math.max(0, (1 - p) * config.alpha);
        const ringAlpha = Math.max(0, (1 - p) * config.ringAlpha);

        glow.clear();
        glow.fillStyle(color, fadeAlpha);
        glow.fillCircle(x, y, glowRadius);
        glow.lineStyle(config.ringWidth, color, ringAlpha);
        glow.strokeCircle(x, y, glowRadius * 0.9);
      },
      onComplete: () => {
        if (!this.activeGraphics.has(glow)) return;
        glow.destroy();
        this.activeGraphics.delete(glow);
      },
    });
  }

  public showBombWarning(
    x: number,
    y: number,
    config: BombWarningConfig,
    onComplete: () => void
  ): void {
    const warningGraphics = this.scene.add.graphics();
    warningGraphics.setDepth(DEPTHS.missileWarning);
    this.activeGraphics.add(warningGraphics);

    let elapsed = 0;
    const updateWarning = () => {
      warningGraphics.clear();

      const blinkPhase = Math.floor(elapsed / config.blinkInterval) % 2;
      const alpha = blinkPhase === 0 ? 0.6 : 0.3;
      const progress = elapsed / config.duration;
      const currentRadius = config.radius * (0.5 + progress * 0.5);

      warningGraphics.fillStyle(COLORS.RED, alpha * 0.3);
      warningGraphics.fillCircle(x, y, currentRadius);

      warningGraphics.lineStyle(3, COLORS.RED, alpha);
      warningGraphics.strokeCircle(x, y, currentRadius);

      const crossSize = currentRadius * 0.5;
      warningGraphics.lineStyle(4, COLORS.RED, alpha);
      warningGraphics.beginPath();
      warningGraphics.moveTo(x - crossSize, y - crossSize);
      warningGraphics.lineTo(x + crossSize, y + crossSize);
      warningGraphics.moveTo(x + crossSize, y - crossSize);
      warningGraphics.lineTo(x - crossSize, y + crossSize);
      warningGraphics.strokePath();
    };

    updateWarning();

    const warningTimer = this.scene.time.addEvent({
      delay: 16,
      callback: () => {
        elapsed += 16;
        if (elapsed < config.duration) {
          updateWarning();
        }
      },
      loop: true,
    });
    this.activeTimers.add(warningTimer);

    this.scene.time.delayedCall(config.duration, () => {
      warningTimer.destroy();
      this.activeTimers.delete(warningTimer);
      warningGraphics.destroy();
      this.activeGraphics.delete(warningGraphics);
      onComplete();
    });
  }

  public destroy(): void {
    this.activeTimers.forEach((timer) => timer.destroy());
    this.activeTimers.clear();

    this.activeGraphics.forEach((graphics) => graphics.destroy());
    this.activeGraphics.clear();

    this.activeProjectiles.forEach((projectile) => projectile.destroy());
    this.activeProjectiles.clear();

    this.activeEmitters.forEach((particles) => particles.destroy());
    this.activeEmitters.clear();
  }
}
