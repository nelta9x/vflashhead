import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Phaser from 'phaser';
import { ChargeVisualConfig, PlayerAttackRenderer } from '../src/effects/PlayerAttackRenderer';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    },
    Display: {
      Color: {
        HexStringToColor: (hex: string) => ({ color: parseInt(hex.replace('#', ''), 16) }),
      },
    },
  },
}));

type MockGraphics = ReturnType<typeof createMockGraphics>;
type MockProjectile = ReturnType<typeof createMockProjectile>;
type MockParticleEmitter = ReturnType<typeof createMockParticleEmitter>;

function createMockGraphics() {
  const graphics = {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    strokePath: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
  };
  graphics.clear.mockReturnValue(graphics);
  graphics.fillStyle.mockReturnValue(graphics);
  graphics.fillCircle.mockReturnValue(graphics);
  graphics.lineStyle.mockReturnValue(graphics);
  graphics.strokeCircle.mockReturnValue(graphics);
  graphics.beginPath.mockReturnValue(graphics);
  graphics.moveTo.mockReturnValue(graphics);
  graphics.lineTo.mockReturnValue(graphics);
  graphics.strokePath.mockReturnValue(graphics);
  graphics.setDepth.mockReturnValue(graphics);
  return graphics;
}

function createMockProjectile() {
  const projectile = {
    setDepth: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
    displayWidth: 10,
  };
  projectile.setDepth.mockReturnValue(projectile);
  projectile.setPosition.mockReturnValue(projectile);
  projectile.setScale.mockReturnValue(projectile);
  return projectile;
}

function createMockParticleEmitter() {
  const emitter = {
    setDepth: vi.fn(),
    setPosition: vi.fn(),
    destroy: vi.fn(),
  };
  emitter.setDepth.mockReturnValue(emitter);
  emitter.setPosition.mockReturnValue(emitter);
  return emitter;
}

function resolveDistanceFromCenter(
  fillCircleCall: [number, number, number],
  centerX: number,
  centerY: number
): number {
  return Math.hypot(fillCircleCall[0] - centerX, fillCircleCall[1] - centerY);
}

describe('PlayerAttackRenderer', () => {
  let renderer: PlayerAttackRenderer;
  let glowGraphics: MockGraphics;
  let convergeGraphics: MockGraphics;
  let lightningGraphics: MockGraphics;
  let preFireGlowGraphics: MockGraphics;
  let projectile: MockProjectile;
  let chargeParticles: MockParticleEmitter;
  let tweenAddSpy = vi.fn();

  const chargeConfig: ChargeVisualConfig = {
    initialRadius: 5,
    maxScale: 4,
    glowInitialAlpha: 0.3,
    glowMaxAlpha: 0.8,
    glowInitialRadius: 20,
    glowMaxRadius: 60,
    lightningChanceBase: 0,
    lightningChanceP: 0,
    lightningSegments: 3,
    particleFrequency: 20,
    energyConverge: {
      color: '#ffffff',
      particleCount: 1,
      outerRadiusMultiplier: 1.5,
      outerRadiusPadding: 12,
      innerRadius: 10,
      minParticleRadius: 2,
      maxParticleRadius: 2,
      swirlTurns: 0,
      alphaMin: 0.2,
      alphaMax: 0.8,
      wobbleRadius: 0,
      angleJitter: 0,
      radiusJitter: 0,
      alphaFlicker: 0,
      chaosRateMin: 1,
      chaosRateMax: 1,
    },
  };

  beforeEach(() => {
    glowGraphics = createMockGraphics();
    convergeGraphics = createMockGraphics();
    lightningGraphics = createMockGraphics();
    preFireGlowGraphics = createMockGraphics();
    projectile = createMockProjectile();
    chargeParticles = createMockParticleEmitter();
    tweenAddSpy = vi.fn((config: { onUpdate?: () => void; onComplete?: () => void }) => {
      if (config.onUpdate) config.onUpdate();
      if (config.onComplete) config.onComplete();
    });

    const graphicsQueue: MockGraphics[] = [
      glowGraphics,
      convergeGraphics,
      lightningGraphics,
      preFireGlowGraphics,
    ];
    const scene = {
      add: {
        circle: vi.fn(() => projectile),
        graphics: vi.fn(() => {
          const nextGraphics = graphicsQueue.shift();
          if (!nextGraphics) {
            return createMockGraphics();
          }
          return nextGraphics;
        }),
        particles: vi.fn(() => chargeParticles),
      },
      tweens: {
        add: tweenAddSpy,
      },
    };

    renderer = new PlayerAttackRenderer(scene as unknown as Phaser.Scene);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts converge energy outside the cursor radius at progress=0', () => {
    const visual = renderer.createChargeVisual(0xffffff, 0x88ccff, chargeConfig);

    visual.update(0, 100, 120, 40);

    const firstParticleCall = convergeGraphics.fillCircle.mock.calls[0] as [number, number, number];
    const distance = resolveDistanceFromCenter(firstParticleCall, 100, 120);
    expect(distance).toBeCloseTo(60, 5);
  });

  it('moves the same converge particle inward as charge progress increases', () => {
    const visual = renderer.createChargeVisual(0xffffff, 0x88ccff, chargeConfig);

    visual.update(0, 100, 120, 40);
    visual.update(0.7, 100, 120, 40);

    const initialCall = convergeGraphics.fillCircle.mock.calls[0] as [number, number, number];
    const progressedCall = convergeGraphics.fillCircle.mock.calls[1] as [number, number, number];

    const initialDistance = resolveDistanceFromCenter(initialCall, 100, 120);
    const progressedDistance = resolveDistanceFromCenter(progressedCall, 100, 120);
    expect(progressedDistance).toBeLessThan(initialDistance);
  });

  it('destroys charge visuals and particles cleanly', () => {
    const visual = renderer.createChargeVisual(0xffffff, 0x88ccff, chargeConfig);

    visual.destroy();

    expect(projectile.destroy).toHaveBeenCalledTimes(1);
    expect(glowGraphics.destroy).toHaveBeenCalledTimes(1);
    expect(convergeGraphics.destroy).toHaveBeenCalledTimes(1);
    expect(lightningGraphics.destroy).toHaveBeenCalledTimes(1);
    expect(chargeParticles.destroy).toHaveBeenCalledTimes(1);
  });

  it('shows pre-fire glow outside cursor and cleans up after tween', () => {
    renderer.showPreFireCursorGlow(100, 120, 40, 0xffffff, {
      duration: 90,
      outerRadiusMultiplier: 1.25,
      outerRadiusPadding: 12,
      maxScale: 1.35,
      alpha: 0.45,
      ringWidth: 2,
      ringAlpha: 0.9,
    });

    const activeGlowGraphics =
      glowGraphics.fillCircle.mock.calls.length > 0 ? glowGraphics : preFireGlowGraphics;
    const firstGlowCall = activeGlowGraphics.fillCircle.mock.calls[0] as [number, number, number];
    expect(firstGlowCall[2]).toBeGreaterThan(40);
    expect(activeGlowGraphics.strokeCircle).toHaveBeenCalled();
    expect(activeGlowGraphics.destroy).toHaveBeenCalledTimes(1);
    expect(tweenAddSpy).toHaveBeenCalledTimes(1);
  });
});
