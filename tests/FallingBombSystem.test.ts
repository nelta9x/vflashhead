import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => {
  return {
    default: {
      Scene: class {},
      Math: {
        Between: vi.fn((min: number, _max: number) => min),
        Distance: {
          Between: vi.fn((x1: number, y1: number, x2: number, y2: number) => {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          }),
        },
      },
    },
  };
});

import { FallingBombSystem } from '../src/systems/FallingBombSystem';
import { GameEvents } from '../src/utils/EventBus';

vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 800,
  FALLING_BOMB: {
    COOLDOWN: 12000,
    MAX_ACTIVE: 2,
    BASE_SPAWN_CHANCE: 0.06,
    CHECK_INTERVAL: 4000,
    MIN_WAVE: 5,
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    fallingBomb: {
      moveSpeed: 120,
      visualSize: 25,
      hitboxSize: 30,
      spawnMargin: 40,
    },
    gameConfig: {
      screen: { height: 720 },
    },
  },
}));

const mockEmit = vi.fn();
vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
      on: vi.fn(),
      off: vi.fn(),
    }),
  },
  GameEvents: {
    FALLING_BOMB_SPAWNED: 'fallingBomb:spawned',
    FALLING_BOMB_DESTROYED: 'fallingBomb:destroyed',
    FALLING_BOMB_MISSED: 'fallingBomb:missed',
  },
}));

vi.mock('../src/effects/DishRenderer', () => ({
  DishRenderer: {
    renderDangerDish: vi.fn(),
  },
}));

// Create a minimal World mock
function createWorldMock() {
  const stores = new Map<string, Map<number, unknown>>();
  const activeEntities = new Set<number>();
  let nextId = 1;

  function getStore(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  const world = {
    isActive: (id: number) => activeEntities.has(id),
    createEntity: () => {
      const id = nextId++;
      activeEntities.add(id);
      return id;
    },
    destroyEntity: (id: number) => {
      activeEntities.delete(id);
      stores.forEach(s => s.delete(id));
    },
    archetypeRegistry: {
      getRequired: () => ({
        id: 'fallingBomb',
        components: [
          { name: 'fallingBomb' },
          { name: 'transform' },
          { name: 'phaserNode' },
        ],
      }),
    },
    spawnFromArchetype: vi.fn((_arch: unknown, values: Record<string, unknown>) => {
      const entityId = nextId++;
      activeEntities.add(entityId);
      for (const [name, value] of Object.entries(values)) {
        getStore(name).set(entityId, value);
      }
      return entityId;
    }),
    getStoreByName: (name: string) => {
      const s = getStore(name);
      return {
        get: (id: number) => s.get(id),
        has: (id: number) => s.has(id),
        set: (id: number, val: unknown) => s.set(id, val),
        delete: (id: number) => s.delete(id),
        size: () => s.size,
        entries: () => s.entries(),
      };
    },
    fallingBomb: {
      get: (id: number) => getStore('fallingBomb').get(id),
    },
    transform: {
      get: (id: number) => getStore('transform').get(id),
    },
    phaserNode: {
      get: (id: number) => getStore('phaserNode').get(id),
    },
    query: vi.fn(function* () {
      const fbStore = getStore('fallingBomb');
      for (const [entityId] of fbStore) {
        if (!activeEntities.has(entityId)) continue;
        const fb = fbStore.get(entityId);
        const t = getStore('transform').get(entityId);
        if (!fb || !t) continue;
        yield [entityId, fb, t];
      }
    }),
  };

  return { world, activeEntities, stores };
}

describe('FallingBombSystem', () => {
  let system: FallingBombSystem;
  let worldMock: ReturnType<typeof createWorldMock>;

  const mockGraphics = {};
  const mockEntity = {
    setEntityId: vi.fn(),
    setPosition: vi.fn(),
    reset: vi.fn(),
    getGraphics: vi.fn(() => mockGraphics),
    setScale: vi.fn(),
    setAlpha: vi.fn(),
    setVisible: vi.fn(),
    setActive: vi.fn(),
    x: 0,
    y: 0,
  };

  const mockPoolManager = {
    acquire: vi.fn(() => mockEntity),
    release: vi.fn(),
  };

  const mockScene = {
    tweens: {
      add: vi.fn((config: { onComplete?: () => void }) => {
        // Immediately call onComplete for spawn animation
        if (config.onComplete) config.onComplete();
        return { stop: vi.fn() };
      }),
    },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolManager.acquire.mockReturnValue(mockEntity);
    worldMock = createWorldMock();
    system = new FallingBombSystem(mockScene, worldMock.world as never, mockPoolManager as never);
  });

  describe('EntitySystem interface', () => {
    it('should have correct id', () => {
      expect(system.id).toBe('core:falling_bomb');
    });

    it('should be enabled by default', () => {
      expect(system.enabled).toBe(true);
    });
  });

  describe('Spawn Logic', () => {
    it('should not spawn before minWave', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      system.setContext(20000, 2); // wave 2 < MIN_WAVE 5
      system.tick(5000);
      expect(worldMock.world.spawnFromArchetype).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should spawn after minWave when conditions are met', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      system.setContext(20000, 5); // wave 5 >= MIN_WAVE 5
      system.tick(4100); // > CHECK_INTERVAL (4000)
      expect(worldMock.world.spawnFromArchetype).toHaveBeenCalledTimes(1);

      Math.random = originalRandom;
    });

    it('should not spawn if check interval not reached', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      system.setContext(20000, 5);
      system.tick(3900); // < CHECK_INTERVAL (4000)
      expect(worldMock.world.spawnFromArchetype).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('checkCursorCollision', () => {
    it('should forceDestroy when cursor overlaps a fully spawned bomb', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      // Spawn a bomb
      system.setContext(20000, 5);
      system.tick(4100);

      // Refresh the query mock for the collision check
      worldMock.world.query = vi.fn(function* () {
        const fbStore = worldMock.stores.get('fallingBomb')!;
        for (const [entityId] of fbStore) {
          if (!worldMock.activeEntities.has(entityId)) continue;
          const fb = fbStore.get(entityId);
          const t = worldMock.stores.get('transform')!.get(entityId);
          if (!fb || !t) continue;
          yield [entityId, fb, t];
        }
      }) as never;

      // Cursor at bomb position with large enough radius
      const bombTransform = worldMock.stores.get('transform')?.values().next().value as { x: number; y: number } | undefined;
      if (bombTransform) {
        system.checkCursorCollision(bombTransform.x, bombTransform.y, 50);
        expect(mockEmit).toHaveBeenCalledWith(
          GameEvents.FALLING_BOMB_DESTROYED,
          expect.objectContaining({ byAbility: false })
        );
      }

      Math.random = originalRandom;
    });

    it('should not destroy a bomb that is not fully spawned', () => {
      // Manually add a bomb entity that's not fully spawned
      const entityId = 99;
      worldMock.activeEntities.add(entityId);
      worldMock.stores.set('fallingBomb', new Map([[entityId, {
        moveSpeed: 120,
        blinkPhase: 0,
        fullySpawned: false,
      }]]));
      worldMock.stores.set('transform', new Map([[entityId, { x: 100, y: 100 }]]));

      worldMock.world.query = vi.fn(function* () {
        yield [entityId, worldMock.stores.get('fallingBomb')!.get(entityId), worldMock.stores.get('transform')!.get(entityId)];
      }) as never;

      system.checkCursorCollision(100, 100, 50);
      expect(mockEmit).not.toHaveBeenCalledWith(
        GameEvents.FALLING_BOMB_DESTROYED,
        expect.anything()
      );
    });
  });

  describe('forceDestroy', () => {
    it('should emit FALLING_BOMB_DESTROYED and remove entity', () => {
      const entityId = 50;
      worldMock.activeEntities.add(entityId);
      worldMock.stores.set('transform', new Map([[entityId, { x: 200, y: 300 }]]));
      worldMock.stores.set('phaserNode', new Map([[entityId, {
        container: { setVisible: vi.fn(), setActive: vi.fn() },
        spawnTween: null,
      }]]));

      system.forceDestroy(entityId, true);

      expect(mockEmit).toHaveBeenCalledWith(
        GameEvents.FALLING_BOMB_DESTROYED,
        { x: 200, y: 300, byAbility: true }
      );
    });
  });

  describe('clear', () => {
    it('should remove all bomb entities', () => {
      // Add some entities
      const ids = [71, 72];
      for (const id of ids) {
        worldMock.activeEntities.add(id);
        if (!worldMock.stores.has('phaserNode')) worldMock.stores.set('phaserNode', new Map());
        worldMock.stores.get('phaserNode')!.set(id, {
          container: { setVisible: vi.fn(), setActive: vi.fn() },
          spawnTween: null,
        });
      }

      worldMock.world.query = vi.fn(function* () {
        for (const id of ids) {
          if (worldMock.activeEntities.has(id)) {
            yield [id, {}];
          }
        }
      }) as never;

      system.clear();
      expect(worldMock.activeEntities.size).toBe(0);
    });
  });
});
