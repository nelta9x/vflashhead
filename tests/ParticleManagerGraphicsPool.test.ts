import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    BlendModes: { NORMAL: 0 },
    Math: {
      Between: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      Vector2: class {
        x: number;
        y: number;
        constructor(x: number, y: number) { this.x = x; this.y = y; }
      },
    },
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: { feedback: { particles: { basic: { count: 5 } } } },
}));

vi.mock('../src/data/constants', () => ({
  COLORS: { WHITE: 0xffffff, CYAN: 0x00ffff },
  DEPTHS: { dishGlow: 10, playerHitDebris: 20 },
  RAINBOW_COLORS: [],
}));

vi.mock('../src/scenes/game/CursorPositionProvider', () => ({
  resolveCursorPosition: () => ({ x: 0, y: 0 }),
}));

vi.mock('../src/effects/UpgradeAbsorptionEffect', () => ({
  UpgradeAbsorptionEffect: class {
    createUpgradeAbsorption() { /* no-op */ }
  },
}));

function createMockGraphics() {
  return {
    active: true,
    clear: vi.fn(),
    setPosition: vi.fn(),
    setAlpha: vi.fn(),
    setScale: vi.fn(),
    setRotation: vi.fn(),
    setDepth: vi.fn(),
    setBlendMode: vi.fn(),
    setVisible: vi.fn(),
    destroy: vi.fn(),
    lineStyle: vi.fn(),
    fillStyle: vi.fn(),
    strokeCircle: vi.fn(),
    fillCircle: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    strokePath: vi.fn(),
    lineBetween: vi.fn(),
    fillPoints: vi.fn(),
    strokePoints: vi.fn(),
  };
}

function createMockScene() {
  return {
    add: {
      graphics: vi.fn(() => createMockGraphics()),
      particles: vi.fn(() => ({
        setParticleTint: vi.fn(),
        setEmitterAngle: vi.fn(),
        explode: vi.fn(),
        destroy: vi.fn(),
      })),
      circle: vi.fn(() => ({
        setDepth: vi.fn(),
        x: 0,
        y: 0,
        destroy: vi.fn(),
      })),
    },
    tweens: {
      add: vi.fn(() => ({ stop: vi.fn() })),
    },
    time: {
      delayedCall: vi.fn(),
    },
  };
}

import { ParticleManager, GRAPHICS_POOL_MAX } from '../src/effects/ParticleManager';

describe('ParticleManager graphics pool', () => {
  let pm: ParticleManager;
  let mockScene: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    mockScene = createMockScene();
    pm = new ParticleManager(mockScene as never);
  });

  describe('acquireGraphics', () => {
    it('creates a new Graphics via scene.add.graphics when pool is empty', () => {
      // scene.add.graphics is called during createEmitters (particles),
      // but acquireGraphics should call it for a new Graphics object
      const callsBefore = mockScene.add.graphics.mock.calls.length;
      const g = pm.acquireGraphics();
      expect(mockScene.add.graphics).toHaveBeenCalledTimes(callsBefore + 1);
      expect(g).toBeDefined();
    });

    it('reuses a pooled Graphics object instead of creating a new one', () => {
      const g1 = pm.acquireGraphics();
      pm.releaseGraphics(g1);

      const callsBefore = mockScene.add.graphics.mock.calls.length;
      const g2 = pm.acquireGraphics();

      // No new graphics created -- same object reused
      expect(mockScene.add.graphics).toHaveBeenCalledTimes(callsBefore);
      expect(g2).toBe(g1);
    });

    it('makes the reused Graphics visible', () => {
      const g = pm.acquireGraphics();
      pm.releaseGraphics(g);
      pm.acquireGraphics();
      expect(g.setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('releaseGraphics', () => {
    it('clears drawing and resets transform/alpha/scale/rotation/depth/blendMode', () => {
      const g = pm.acquireGraphics();
      pm.releaseGraphics(g);

      expect(g.clear).toHaveBeenCalled();
      expect(g.setPosition).toHaveBeenCalledWith(0, 0);
      expect(g.setAlpha).toHaveBeenCalledWith(1);
      expect(g.setScale).toHaveBeenCalledWith(1, 1);
      expect(g.setRotation).toHaveBeenCalledWith(0);
      expect(g.setDepth).toHaveBeenCalledWith(0);
      expect(g.setBlendMode).toHaveBeenCalledWith(0); // NORMAL = 0
      expect(g.setVisible).toHaveBeenCalledWith(false);
    });

    it('does not destroy the Graphics object (it stays in pool)', () => {
      const g = pm.acquireGraphics();
      pm.releaseGraphics(g);
      expect(g.destroy).not.toHaveBeenCalled();
    });

    it('skips inactive (already destroyed) Graphics objects', () => {
      const g = pm.acquireGraphics();
      g.active = false;
      pm.releaseGraphics(g);

      // Should not call clear or any reset methods
      expect(g.clear).not.toHaveBeenCalled();
    });

    it('destroys Graphics when pool is at max capacity', () => {
      // Acquire GRAPHICS_POOL_MAX + 1 objects, then release them all.
      // The last release should overflow and cause a destroy.
      const objects = [];
      for (let i = 0; i < GRAPHICS_POOL_MAX + 1; i++) {
        const g = pm.acquireGraphics();
        objects.push(g);
      }

      // Release all -- first GRAPHICS_POOL_MAX fit in pool, the last one overflows
      for (const g of objects) {
        pm.releaseGraphics(g);
      }

      // The last released object should have been destroyed
      const lastObject = objects[objects.length - 1];
      expect(lastObject.destroy).toHaveBeenCalled();

      // The first GRAPHICS_POOL_MAX objects should NOT have been destroyed
      for (let i = 0; i < GRAPHICS_POOL_MAX; i++) {
        expect(objects[i].destroy).not.toHaveBeenCalled();
      }
    });
  });

  describe('pool reuse across effect methods', () => {
    it('pool grows as effects release graphics and shrinks as effects acquire them', () => {
      // Acquire 3 graphics, release them all
      const g1 = pm.acquireGraphics();
      const g2 = pm.acquireGraphics();
      const g3 = pm.acquireGraphics();

      pm.releaseGraphics(g1);
      pm.releaseGraphics(g2);
      pm.releaseGraphics(g3);

      const callsBefore = mockScene.add.graphics.mock.calls.length;

      // Next 3 acquires should reuse from pool (LIFO order)
      const r1 = pm.acquireGraphics();
      const r2 = pm.acquireGraphics();
      const r3 = pm.acquireGraphics();

      expect(mockScene.add.graphics).toHaveBeenCalledTimes(callsBefore);
      expect(r1).toBe(g3); // LIFO
      expect(r2).toBe(g2);
      expect(r3).toBe(g1);
    });
  });

  describe('destroy', () => {
    it('destroys all pooled Graphics objects and empties the pool', () => {
      const g1 = pm.acquireGraphics();
      const g2 = pm.acquireGraphics();
      pm.releaseGraphics(g1);
      pm.releaseGraphics(g2);

      pm.destroy();

      expect(g1.destroy).toHaveBeenCalled();
      expect(g2.destroy).toHaveBeenCalled();

      // After destroy, acquiring should create new objects
      const callsBefore = mockScene.add.graphics.mock.calls.length;
      // Re-create PM since destroy clears emitters too
      const pm2 = new ParticleManager(mockScene as never);
      pm2.acquireGraphics();
      expect(mockScene.add.graphics.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
