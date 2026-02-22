import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../data/constants';
import type { ShootingStarConfig, StarsConfig } from '../data/types';

interface StarData {
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  offset: number;
  cachedAlpha: number;
}

interface ShootingStarData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  directionX: number;
  directionY: number;
  length: number;
  lineWidth: number;
  color: number;
  alpha: number;
  headGlowIntensity: number;
  lifetime: number;
  age: number;
}

export class StarBackground {
  private starGraphics: Phaser.GameObjects.Graphics;
  private shootingStarGraphics: Phaser.GameObjects.Graphics;
  private config: StarsConfig;
  private stars: StarData[] = [];
  private shootingStars: ShootingStarData[] = [];
  private shootingStarColor: number = COLORS.CYAN;
  private nextBurstInMs: number = 0;
  private burstSpawnDelayMs: number = 0;
  private burstRemainingCount: number = 0;
  private frameCounter: number = 10;
  private accumulatedDelta: number = 0;
  private starsDirty: boolean = true;
  private lastGridSpeed: number = 0;

  constructor(scene: Phaser.Scene, config: StarsConfig) {
    this.config = config;
    this.starGraphics = scene.add.graphics();
    this.shootingStarGraphics = scene.add.graphics();
    this.init();
    this.initShootingStarState();
  }

  private init(): void {
    this.stars = [];
    const limitY = GAME_HEIGHT * this.config.verticalLimitRatio;

    for (let i = 0; i < this.config.count; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * limitY,
        size: Phaser.Math.FloatBetween(this.config.minSize, this.config.maxSize),
        twinkleSpeed: Phaser.Math.FloatBetween(
          this.config.twinkleSpeedMin,
          this.config.twinkleSpeedMax
        ),
        offset: Math.random() * Math.PI * 2,
        cachedAlpha: 1,
      });
    }
  }

  public update(delta: number, time: number, gridSpeed: number): void {
    const limitY = GAME_HEIGHT * this.config.verticalLimitRatio;

    this.accumulatedDelta += delta;
    this.lastGridSpeed = gridSpeed;
    this.frameCounter++;

    if (this.frameCounter >= 10) {
      this.updateStarPhysics(time, limitY);
      this.frameCounter = 0;
      this.accumulatedDelta = 0;
      this.starsDirty = true;
    }

    if (this.starsDirty) {
      this.starsDirty = false;
      this.redrawStars();
    }

    this.shootingStarGraphics.clear();
    this.updateShootingStars(delta, limitY);
  }

  private updateStarPhysics(time: number, limitY: number): void {
    const accDelta = this.accumulatedDelta;
    const gridSpeed = this.lastGridSpeed;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const sizeFactor = star.size / this.config.maxSize;
      const baseRatio = this.config.parallaxRatio;
      const variation = this.config.sizeSpeedFactor;
      const parallaxSpeed = gridSpeed * baseRatio * (1 - variation * 0.5 + sizeFactor * variation);

      star.y += parallaxSpeed * accDelta;

      if (star.y > limitY) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }

      star.cachedAlpha = 0.2 + Math.abs(Math.sin(time * star.twinkleSpeed + star.offset)) * 0.8;
    }
  }

  private redrawStars(): void {
    this.starGraphics.clear();
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      this.starGraphics.fillStyle(0xffffff, star.cachedAlpha);
      this.starGraphics.fillCircle(star.x, star.y, star.size);

      if (star.size > 1.5) {
        this.starGraphics.lineStyle(1, COLORS.CYAN, star.cachedAlpha * 0.4);
        this.starGraphics.strokeCircle(star.x, star.y, star.size + 1);
      }
    }
  }

  public setDepth(depth: number): void {
    this.starGraphics.setDepth(depth);
    this.shootingStarGraphics.setDepth(depth);
  }

  public destroy(): void {
    this.starGraphics.destroy();
    this.shootingStarGraphics.destroy();
  }

  private initShootingStarState(): void {
    const shootingStarConfig = this.config.shootingStar;

    this.shootingStars = [];
    this.nextBurstInMs = 0;
    this.burstSpawnDelayMs = 0;
    this.burstRemainingCount = 0;

    if (!shootingStarConfig?.enabled) return;

    this.shootingStarColor = this.parseHexColor(shootingStarConfig.color);
    this.nextBurstInMs = this.randomFloat(
      shootingStarConfig.cycleIntervalMs.min,
      shootingStarConfig.cycleIntervalMs.max
    );
  }

  private updateShootingStars(delta: number, limitY: number): void {
    const shootingStarConfig = this.config.shootingStar;
    if (!shootingStarConfig?.enabled) return;

    if (this.burstRemainingCount > 0) {
      this.burstSpawnDelayMs -= delta;

      while (this.burstRemainingCount > 0 && this.burstSpawnDelayMs <= 0) {
        this.spawnShootingStar(shootingStarConfig, limitY);
        this.burstRemainingCount--;

        if (this.burstRemainingCount > 0) {
          this.burstSpawnDelayMs += this.randomFloat(
            shootingStarConfig.spawnDelayMs.min,
            shootingStarConfig.spawnDelayMs.max
          );
        }
      }
    } else {
      this.nextBurstInMs -= delta;
      if (this.nextBurstInMs <= 0) {
        this.startShootingStarBurst(shootingStarConfig);
      }
    }

    const deltaSeconds = delta / 1000;

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const shootingStar = this.shootingStars[i];
      shootingStar.age += delta;

      if (shootingStar.age >= shootingStar.lifetime) {
        const last = this.shootingStars.length - 1;
        if (i !== last) {
          this.shootingStars[i] = this.shootingStars[last];
        }
        this.shootingStars.pop();
        continue;
      }

      shootingStar.x += shootingStar.vx * deltaSeconds;
      shootingStar.y += shootingStar.vy * deltaSeconds;

      const outOfBounds =
        shootingStar.x < -shootingStarConfig.startXPadding * 2 ||
        shootingStar.x > GAME_WIDTH + shootingStarConfig.startXPadding * 2 ||
        shootingStar.y > GAME_HEIGHT + shootingStarConfig.startXPadding;

      if (outOfBounds) {
        const last = this.shootingStars.length - 1;
        if (i !== last) {
          this.shootingStars[i] = this.shootingStars[last];
        }
        this.shootingStars.pop();
        continue;
      }

      const progress = shootingStar.age / shootingStar.lifetime;
      const fadeAlpha = 1 - progress;
      const bodyAlpha = shootingStar.alpha * fadeAlpha;
      const tailAlpha = bodyAlpha * shootingStarConfig.tailAlphaScale;
      const headGlowIntensity = Phaser.Math.Clamp(shootingStar.headGlowIntensity, 0, 1);

      const tailX = shootingStar.x - shootingStar.directionX * shootingStar.length;
      const tailY = shootingStar.y - shootingStar.directionY * shootingStar.length;

      this.shootingStarGraphics.lineStyle(
        shootingStar.lineWidth * 2,
        shootingStar.color,
        tailAlpha * shootingStarConfig.glowAlphaScale
      );
      this.shootingStarGraphics.beginPath();
      this.shootingStarGraphics.moveTo(shootingStar.x, shootingStar.y);
      this.shootingStarGraphics.lineTo(tailX, tailY);
      this.shootingStarGraphics.strokePath();

      this.shootingStarGraphics.lineStyle(shootingStar.lineWidth, shootingStar.color, bodyAlpha);
      this.shootingStarGraphics.beginPath();
      this.shootingStarGraphics.moveTo(shootingStar.x, shootingStar.y);
      this.shootingStarGraphics.lineTo(tailX, tailY);
      this.shootingStarGraphics.strokePath();

      const headRadius = shootingStar.lineWidth * shootingStarConfig.glowRadiusScale;

      this.shootingStarGraphics.fillStyle(
        shootingStar.color,
        bodyAlpha * shootingStarConfig.glowAlphaScale * 0.5 * headGlowIntensity
      );
      this.shootingStarGraphics.fillCircle(shootingStar.x, shootingStar.y, headRadius * 2.2);

      this.shootingStarGraphics.fillStyle(
        shootingStar.color,
        bodyAlpha * 0.75 * headGlowIntensity
      );
      this.shootingStarGraphics.fillCircle(shootingStar.x, shootingStar.y, headRadius * 1.15);

      this.shootingStarGraphics.fillStyle(0xffffff, bodyAlpha * 0.5 * headGlowIntensity);
      this.shootingStarGraphics.fillCircle(shootingStar.x, shootingStar.y, headRadius * 0.55);
    }
  }

  private startShootingStarBurst(config: ShootingStarConfig): void {
    this.burstRemainingCount = this.randomInt(config.burstCount.min, config.burstCount.max);
    this.burstSpawnDelayMs = 0;
    this.nextBurstInMs = this.randomFloat(config.cycleIntervalMs.min, config.cycleIntervalMs.max);
  }

  private spawnShootingStar(config: ShootingStarConfig, limitY: number): void {
    const spawnFromLeft = Math.random() < 0.5;
    const startX = spawnFromLeft ? -config.startXPadding : GAME_WIDTH + config.startXPadding;
    const startY = this.randomFloat(0, limitY * config.startYMaxRatio);

    const angleDeg = this.randomFloat(config.angleDeg.min, config.angleDeg.max);
    const directionDeg = spawnFromLeft ? angleDeg : 180 - angleDeg;
    const angleRad = Phaser.Math.DegToRad(directionDeg);

    const directionX = Math.cos(angleRad);
    const directionY = Math.sin(angleRad);
    const speed = this.randomFloat(config.speed.min, config.speed.max);
    const travelDistance = this.randomFloat(config.travelDistance.min, config.travelDistance.max);
    const headGlowIntensity = this.randomFloat(
      config.headGlowIntensity.min,
      config.headGlowIntensity.max
    );

    this.shootingStars.push({
      x: startX,
      y: startY,
      vx: directionX * speed,
      vy: directionY * speed,
      directionX,
      directionY,
      length: this.randomFloat(config.length.min, config.length.max),
      lineWidth: this.randomFloat(config.lineWidth.min, config.lineWidth.max),
      color: this.rollShootingStarColor(config),
      alpha: this.randomFloat(config.alpha.min, config.alpha.max),
      headGlowIntensity,
      lifetime: (travelDistance / speed) * 1000,
      age: 0,
    });
  }

  private randomFloat(min: number, max: number): number {
    return Phaser.Math.FloatBetween(min, max);
  }

  private randomInt(min: number, max: number): number {
    const start = Math.round(Math.min(min, max));
    const end = Math.round(Math.max(min, max));
    return Phaser.Math.Between(start, end);
  }

  private rollShootingStarColor(config: ShootingStarConfig): number {
    const palette = config.colorPalette;
    if (!Array.isArray(palette) || palette.length === 0) {
      return this.shootingStarColor;
    }

    const index = Phaser.Math.Between(0, palette.length - 1);
    return this.parseHexColor(palette[index]);
  }

  private parseHexColor(hex: string): number {
    const parsed = parseInt(hex.replace('#', ''), 16);
    return Number.isNaN(parsed) ? COLORS.CYAN : parsed;
  }
}
