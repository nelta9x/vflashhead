import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock DataManager before import
vi.mock('../../src/data/DataManager', () => ({
  Data: {
    boss: {
      feedback: { vibrationThreshold: 0.5, vibrationIntensity: 10 },
    },
  },
}));

import { World } from '../../src/world/World';
import { EntityVisualSystem } from '../../src/systems/entity-systems/EntityVisualSystem';

describe('EntityVisualSystem', () => {
  let world: World;
  let system: EntityVisualSystem;

  beforeEach(() => {
    world = new World();
    system = new EntityVisualSystem(world);
  });

  it('decrements hitFlashPhase', () => {
    const e1 = world.createEntity();
    world.visualState.set(e1, {
      hitFlashPhase: 1, wobblePhase: 0, blinkPhase: 0, isBeingPulled: false, pullPhase: 0,
    });

    system.tick(100);

    expect(world.visualState.getRequired(e1).hitFlashPhase).toBe(0);
  });

  it('blinks when near lifetime end', () => {
    const e1 = world.createEntity();
    world.visualState.set(e1, {
      hitFlashPhase: 0, wobblePhase: 0, blinkPhase: 0, isBeingPulled: false, pullPhase: 0,
    });
    world.lifetime.set(e1, {
      elapsedTime: 4000, movementTime: 0, lifetime: 5000, spawnDuration: 150, globalSlowPercent: 0,
    });
    world.transform.set(e1, { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });

    system.tick(16);

    // timeRatio = 1 - 4000/5000 = 0.2 < 0.3 → blink active
    expect(world.visualState.getRequired(e1).blinkPhase).toBeGreaterThan(0);
    expect(world.transform.getRequired(e1).alpha).not.toBe(1);
  });

  it('skips player entity', () => {
    const player = world.createEntity();
    world.playerInput.set(player, { targetX: 0, targetY: 0, smoothingConfig: {} } as never);
    world.visualState.set(player, {
      hitFlashPhase: 1, wobblePhase: 0, blinkPhase: 0, isBeingPulled: true, pullPhase: 0,
    });

    system.tick(16);

    const vs = world.visualState.getRequired(player);
    expect(vs.pullPhase).toBe(0); // not updated
    expect(vs.hitFlashPhase).toBe(1); // not decremented
  });

  it('skips inactive entities', () => {
    const fakeId = 999;
    world.visualState.set(fakeId, {
      hitFlashPhase: 1, wobblePhase: 0, blinkPhase: 0, isBeingPulled: true, pullPhase: 0,
    });

    system.tick(16);

    const vs = world.visualState.getRequired(fakeId);
    expect(vs.pullPhase).toBe(0);
  });
});
