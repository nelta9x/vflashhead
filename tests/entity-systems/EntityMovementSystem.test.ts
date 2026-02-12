import { describe, expect, it, vi } from 'vitest';
import { World } from '../../src/world/World';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    },
  },
}));

describe('EntityMovementSystem', () => {
  async function loadSystem() {
    const mod = await import('../../src/systems/entity-systems/EntityMovementSystem');
    return mod.EntityMovementSystem;
  }

  function makeDrift(overrides: Record<string, unknown> = {}) {
    return {
      type: 'drift' as const,
      homeX: 100,
      homeY: 200,
      movementTime: 0,
      drift: {
        xAmplitude: 50,
        xFrequency: 0.001,
        yAmplitude: 30,
        yFrequency: 0.002,
        phaseX: 0,
        phaseY: 0,
        bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 },
      },
      ...overrides,
    };
  }

  function makeTransform(overrides: Record<string, unknown> = {}) {
    return { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1, ...overrides };
  }

  function makeVisualState() {
    return { hitFlashPhase: 0, wobblePhase: 0, blinkPhase: 0, isBeingPulled: false, pullPhase: 0 };
  }

  it('drift type: computes sine-wave position and updates transform', async () => {
    const EntityMovementSystem = await loadSystem();
    const world = new World();
    const system = new EntityMovementSystem(world);

    const e1 = world.createEntity();
    const mov = makeDrift();
    world.movement.set(e1, mov);
    world.statusCache.set(e1, { isFrozen: false, slowFactor: 1.0, isShielded: false });
    world.transform.set(e1, makeTransform());
    world.visualState.set(e1, makeVisualState());

    const delta = 16;
    system.tick(delta);

    // movementTime should have advanced
    expect(mov.movementTime).toBe(delta);

    // Compute expected sine-wave position
    const d = mov.drift!;
    const expectedBaseX = 100 + Math.sin(delta * d.xFrequency + d.phaseX) * d.xAmplitude;
    const expectedBaseY = 200 + Math.sin(delta * d.yFrequency + d.phaseY) * d.yAmplitude;

    const t = world.transform.getRequired(e1);
    expect(t.baseX).toBeCloseTo(expectedBaseX, 5);
    expect(t.baseY).toBeCloseTo(expectedBaseY, 5);
    expect(t.x).toBeCloseTo(expectedBaseX, 5);
    expect(t.y).toBeCloseTo(expectedBaseY, 5);
  });

  it('drift type with boss offsets: includes shake/push', async () => {
    const EntityMovementSystem = await loadSystem();
    const world = new World();
    const system = new EntityMovementSystem(world);

    const e1 = world.createEntity();
    const mov = makeDrift();
    world.movement.set(e1, mov);
    world.statusCache.set(e1, { isFrozen: false, slowFactor: 1.0, isShielded: false });
    world.transform.set(e1, makeTransform());
    world.bossState.set(e1, {
      defaultArmorPieces: 0,
      armorPieceCount: 0,
      currentArmorCount: 0,
      filledHpSlotCount: 0,
      shakeOffsetX: 5,
      shakeOffsetY: 3,
      pushOffsetX: 2,
      pushOffsetY: 1,
      isHitStunned: false,
      pendingDamageReaction: false,
      damageSourceX: 0,
      damageSourceY: 0,
      pendingDeathAnimation: false,
      deathAnimationPlaying: false,
      reactionTweens: [],
      deathTween: null,
    });

    const delta = 16;
    system.tick(delta);

    const d = mov.drift!;
    const expectedBaseX = 100 + Math.sin(delta * d.xFrequency + d.phaseX) * d.xAmplitude;
    const expectedBaseY = 200 + Math.sin(delta * d.yFrequency + d.phaseY) * d.yAmplitude;

    const t = world.transform.getRequired(e1);
    expect(t.baseX).toBeCloseTo(expectedBaseX, 5);
    expect(t.baseY).toBeCloseTo(expectedBaseY, 5);
    expect(t.x).toBeCloseTo(expectedBaseX + 5 + 2, 5);
    expect(t.y).toBeCloseTo(expectedBaseY + 3 + 1, 5);
  });

  it('drift type when frozen: does not advance movement', async () => {
    const EntityMovementSystem = await loadSystem();
    const world = new World();
    const system = new EntityMovementSystem(world);

    const e1 = world.createEntity();
    const mov = makeDrift();
    world.movement.set(e1, mov);
    world.statusCache.set(e1, { isFrozen: true, slowFactor: 0.5, isShielded: false });
    world.transform.set(e1, makeTransform({ x: 10, y: 20, baseX: 10, baseY: 20 }));
    world.visualState.set(e1, makeVisualState());

    system.tick(16);

    // movementTime should not have advanced
    expect(mov.movementTime).toBe(0);

    // Transform should remain unchanged
    const t = world.transform.getRequired(e1);
    expect(t.baseX).toBe(10);
    expect(t.baseY).toBe(20);
    expect(t.x).toBe(10);
    expect(t.y).toBe(20);
  });

  it('none type: increments wobblePhase', async () => {
    const EntityMovementSystem = await loadSystem();
    const world = new World();
    const system = new EntityMovementSystem(world);

    const e1 = world.createEntity();
    world.movement.set(e1, { type: 'none', homeX: 0, homeY: 0, movementTime: 0, drift: null });
    world.statusCache.set(e1, { isFrozen: false, slowFactor: 0.5, isShielded: false });
    world.transform.set(e1, makeTransform());
    world.visualState.set(e1, makeVisualState());

    system.tick(16);

    expect(world.visualState.getRequired(e1).wobblePhase).toBeCloseTo(0.1 * 0.5, 5);
  });

  it('skips player entity', async () => {
    const EntityMovementSystem = await loadSystem();
    const world = new World();
    const system = new EntityMovementSystem(world);

    const player = world.createEntity();
    world.playerInput.set(player, { targetX: 0, targetY: 0, smoothingConfig: {} } as never);
    const mov = makeDrift();
    world.movement.set(player, mov);
    world.statusCache.set(player, { isFrozen: false, slowFactor: 1.0, isShielded: false });
    world.transform.set(player, makeTransform());

    system.tick(16);

    // movementTime should not advance for player
    expect(mov.movementTime).toBe(0);
  });

  it('skips inactive entities', async () => {
    const EntityMovementSystem = await loadSystem();
    const world = new World();
    const system = new EntityMovementSystem(world);

    // Set movement without calling createEntity (entity not active)
    const fakeId = 999;
    const mov = makeDrift();
    world.movement.set(fakeId, mov);
    world.transform.set(fakeId, makeTransform());

    system.tick(16);

    // movementTime should not advance for inactive entity
    expect(mov.movementTime).toBe(0);
  });
});
