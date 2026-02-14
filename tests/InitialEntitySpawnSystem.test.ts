import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InitialEntitySpawnSystem } from '../src/plugins/builtin/systems/InitialEntitySpawnSystem';
import { PluginRegistry } from '../src/plugins/PluginRegistry';
import type { EntityTypePlugin } from '../src/plugins/types/EntityTypePlugin';
import type { World } from '../src/world';

function createMockWorld(): World {
  return {} as World;
}

function createMockEntityType(
  typeId: string,
  spawn?: EntityTypePlugin['spawn'],
): EntityTypePlugin {
  return { typeId, spawn } as unknown as EntityTypePlugin;
}

describe('InitialEntitySpawnSystem', () => {
  beforeEach(() => {
    PluginRegistry.resetInstance();
  });

  afterEach(() => {
    PluginRegistry.resetInstance();
  });

  it('start()에서 등록된 엔티티 타입의 spawn()을 호출해야 함', () => {
    const world = createMockWorld();
    const spawnA = vi.fn();
    const spawnB = vi.fn();

    PluginRegistry.getInstance().registerEntityType(createMockEntityType('a', spawnA));
    PluginRegistry.getInstance().registerEntityType(createMockEntityType('b', spawnB));

    const system = new InitialEntitySpawnSystem(world, ['a', 'b']);
    system.start();

    expect(spawnA).toHaveBeenCalledWith(world);
    expect(spawnB).toHaveBeenCalledWith(world);
  });

  it('entityTypeIds 순서대로 spawn()을 호출해야 함', () => {
    const world = createMockWorld();
    const order: string[] = [];

    PluginRegistry.getInstance().registerEntityType(
      createMockEntityType('x', () => { order.push('x'); return 0; }),
    );
    PluginRegistry.getInstance().registerEntityType(
      createMockEntityType('y', () => { order.push('y'); return 0; }),
    );
    PluginRegistry.getInstance().registerEntityType(
      createMockEntityType('z', () => { order.push('z'); return 0; }),
    );

    const system = new InitialEntitySpawnSystem(world, ['z', 'x', 'y']);
    system.start();

    expect(order).toEqual(['z', 'x', 'y']);
  });

  it('미등록 엔티티 타입이면 Error를 throw해야 함', () => {
    const world = createMockWorld();
    const system = new InitialEntitySpawnSystem(world, ['nonexistent']);

    expect(() => system.start()).toThrowError('entity type "nonexistent" not registered');
  });

  it('spawn()이 없는 엔티티 타입이면 Error를 throw해야 함', () => {
    const world = createMockWorld();
    PluginRegistry.getInstance().registerEntityType(createMockEntityType('no_spawn'));

    const system = new InitialEntitySpawnSystem(world, ['no_spawn']);

    expect(() => system.start()).toThrowError('entity type "no_spawn" has no spawn()');
  });

  it('tick()은 no-op이어야 함', () => {
    const world = createMockWorld();
    const system = new InitialEntitySpawnSystem(world, []);

    expect(() => system.tick(16)).not.toThrow();
  });

  it('빈 entityTypeIds에서 start()는 아무것도 호출하지 않아야 함', () => {
    const world = createMockWorld();
    const system = new InitialEntitySpawnSystem(world, []);

    expect(() => system.start()).not.toThrow();
  });

  it('id가 "core:initial_spawn"이어야 함', () => {
    const world = createMockWorld();
    const system = new InitialEntitySpawnSystem(world, []);

    expect(system.id).toBe('core:initial_spawn');
  });

  it('enabled 기본값이 true여야 함', () => {
    const world = createMockWorld();
    const system = new InitialEntitySpawnSystem(world, []);

    expect(system.enabled).toBe(true);
  });
});
