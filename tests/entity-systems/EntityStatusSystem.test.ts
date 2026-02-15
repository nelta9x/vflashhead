import { describe, expect, it, vi } from 'vitest';
import { World } from '../../src/world/World';
import { EntityStatusSystem } from '../../src/systems/entity-systems/EntityStatusSystem';

function createMockSEM() {
  return {
    hasEffect: vi.fn().mockReturnValue(false),
    getEffectsByType: vi.fn().mockReturnValue([]),
    getMinEffectData: vi.fn().mockReturnValue(1.0),
    applyEffect: vi.fn(),
    removeEffect: vi.fn(),
    clearEntity: vi.fn(),
    clear: vi.fn(),
    tick: vi.fn(),
    getActiveEffects: vi.fn().mockReturnValue([]),
  };
}

describe('EntityStatusSystem', () => {
  it('has correct id', () => {
    const world = new World();
    const sem = createMockSEM();
    const system = new EntityStatusSystem(world, sem as never);
    expect(system.id).toBe('core:entity_status');
  });

  it('is enabled by default', () => {
    const world = new World();
    const sem = createMockSEM();
    const system = new EntityStatusSystem(world, sem as never);
    expect(system.enabled).toBe(true);
  });

  it('updates statusCache from SEM for active entities', () => {
    const world = new World();
    const sem = createMockSEM();
    sem.hasEffect.mockImplementation((_id: number, type: string) => type === 'freeze');
    sem.getMinEffectData.mockReturnValue(0.5);
    const system = new EntityStatusSystem(world, sem as never);

    const e1 = world.createEntity();
    world.statusCache.set(e1, { isFrozen: false, slowFactor: 1.0, isShielded: false });

    system.tick(16);

    const status = world.statusCache.getRequired(e1);
    expect(status.isFrozen).toBe(true);
    expect(status.slowFactor).toBe(0.5);
  });

  it('sets slowFactor to 1.0 when no slow effects', () => {
    const world = new World();
    const sem = createMockSEM();
    const system = new EntityStatusSystem(world, sem as never);

    const e1 = world.createEntity();
    world.statusCache.set(e1, { isFrozen: false, slowFactor: 0.3, isShielded: false });

    system.tick(16);

    expect(world.statusCache.getRequired(e1).slowFactor).toBe(1.0);
  });

  it('skips inactive entities', () => {
    const world = new World();
    const sem = createMockSEM();
    const system = new EntityStatusSystem(world, sem as never);

    // Set statusCache but don't create entity (not active)
    const fakeId = 999;
    world.statusCache.set(fakeId, { isFrozen: false, slowFactor: 1.0, isShielded: false });

    system.tick(16);

    expect(sem.hasEffect).not.toHaveBeenCalled();
  });

  it('handles player entity (no skip)', () => {
    const world = new World();
    const sem = createMockSEM();
    sem.hasEffect.mockReturnValue(true);
    sem.getMinEffectData.mockReturnValue(0.5);
    const system = new EntityStatusSystem(world, sem as never);

    const player = world.createEntity();
    world.statusCache.set(player, { isFrozen: false, slowFactor: 1.0, isShielded: false });

    system.tick(16);

    expect(world.statusCache.getRequired(player).isFrozen).toBe(true);
  });

  it('handles empty world', () => {
    const world = new World();
    const sem = createMockSEM();
    const system = new EntityStatusSystem(world, sem as never);
    expect(() => system.tick(16)).not.toThrow();
  });
});
