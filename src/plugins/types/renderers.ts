import type Phaser from 'phaser';

// === BossRenderer interface ===
export interface BossRendererState {
  hpRatio: number;
  timeElapsed: number;
  armorPieceCount: number;
  filledArmorPieceCount: number;
}

export interface IBossRenderer {
  render(state: BossRendererState): void;
  playHitFlash(flashDuration: number): void;
}

// === LaserRenderer interface ===
export interface LaserRenderData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isFiring: boolean;
  progress: number;
}

export interface ILaserRenderer {
  render(lasers: LaserRenderData[]): void;
  clear(): void;
}

// === PlayerAttackRenderer interface ===
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

export interface PreFireCursorGlowConfig {
  duration: number;
  outerRadiusMultiplier: number;
  outerRadiusPadding: number;
  maxScale: number;
  alpha: number;
  ringWidth: number;
  ringAlpha: number;
}

export interface BombWarningConfig {
  duration: number;
  radius: number;
  blinkInterval: number;
}

export interface IPlayerAttackRenderer {
  createChargeVisual(mainColor: number, accentColor: number, config: ChargeVisualConfig): ChargeVisualHandle;
  createMissile(x: number, y: number, radius: number, color: number, depth?: number): Phaser.GameObjects.Arc;
  destroyProjectile(projectile: Phaser.GameObjects.Arc): void;
  spawnMissileTrail(config: MissileTrailConfig): void;
  showPreFireCursorGlow(x: number, y: number, cursorRadius: number, color: number, config: PreFireCursorGlowConfig): void;
  showBombWarning(x: number, y: number, config: BombWarningConfig, onComplete: () => void): void;
  destroy(): void;
}

// === BossShatterEffect interface ===
export interface IBossShatterEffect {
  createBossGaugeShatter(x: number, y: number, innerRadius: number, outerRadius: number, bodyColor: number): void;
}
