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
      Geom: {
        Circle: class {
          constructor(public x: number, public y: number, public radius: number) {}
          static Contains = vi.fn(() => true);
        },
      },
    },
  };
});

import { HealthPackSystem } from '../src/plugins/builtin/systems/HealthPackSystem';
import { GameEvents } from '../src/utils/EventBus';
import type { UpgradeSystem } from '../src/plugins/builtin/services/UpgradeSystem';

vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 800,
  HEAL_PACK: {
    COOLDOWN: 5000,
    MAX_ACTIVE: 1,
    BASE_SPAWN_CHANCE: 0.04,
    CHECK_INTERVAL: 5000,
  },
  CURSOR_HITBOX: {
    BASE_RADIUS: 20,
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    healthPack: {
      moveSpeed: 80,
      visualSize: 20,
      hitboxSize: 25,
      spawnMargin: 40,
      preMissWarningDistance: 100,
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
    HEALTH_PACK_SPAWNED: 'healthPack:spawned',
    HEALTH_PACK_COLLECTED: 'healthPack:collected',
    HEALTH_PACK_MISSED: 'healthPack:missed',
    HEALTH_PACK_PASSING: 'healthPack:passing',
  },
}));

vi.mock('../src/plugins/builtin/abilities/HealthPackRenderer', () => ({
  HealthPackRenderer: {
    render: vi.fn(),
  },
}));

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
        id: 'healthPack',
        components: [
          { name: 'healthPack' },
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
    healthPack: {
      get: (id: number) => getStore('healthPack').get(id),
    },
    transform: {
      get: (id: number) => getStore('transform').get(id),
    },
    phaserNode: {
      get: (id: number) => getStore('phaserNode').get(id),
    },
    context: { gameTime: 0, currentWave: 1, playerId: 0 },
    query: vi.fn(function* () {
      const hpStore = getStore('healthPack');
      for (const [entityId] of hpStore) {
        if (!activeEntities.has(entityId)) continue;
        const hp = hpStore.get(entityId);
        const t = getStore('transform').get(entityId);
        if (!hp || !t) continue;
        yield [entityId, hp, t];
      }
    }),
  };

  return { world, activeEntities, stores };
}

const mockGetLevelData = vi.fn((): unknown => null);
const mockUpgradeSystem = {
  getUpgradeStack: vi.fn(() => 0),
  getLevelData: mockGetLevelData,
  getSystemUpgrade: vi.fn(() => undefined),
  getAllUpgradeStacks: vi.fn(() => new Map()),
} as unknown as UpgradeSystem;

describe('HealthPackSystem', () => {
  let system: HealthPackSystem;
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
    setInteractive: vi.fn(),
    disableInteractive: vi.fn(),
    removeAllListeners: vi.fn(),
    on: vi.fn(),
    x: 0,
    y: 0,
  };

  const mockPoolManager = {
    acquire: vi.fn(() => mockEntity),
    release: vi.fn(),
  };

  const mockScene = {
    tweens: {
      add: vi.fn(),
    },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLevelData.mockReturnValue(null);
    mockPoolManager.acquire.mockReturnValue(mockEntity);
    worldMock = createWorldMock();
    system = new HealthPackSystem(mockScene, mockUpgradeSystem, worldMock.world as never, mockPoolManager as never);
  });

  describe('EntitySystem interface', () => {
    it('should have correct id', () => {
      expect(system.id).toBe('core:health_pack');
    });

    it('should be enabled by default', () => {
      expect(system.enabled).toBe(true);
    });
  });

  describe('Spawn Logic', () => {
    it('should use fixed base spawn chance', () => {
      expect(system.getSpawnChance()).toBe(0.04);
    });

    it('should include upgrade bonus in spawn chance', () => {
      mockGetLevelData.mockReturnValue({ dropChanceBonus: 0.02 });
      expect(system.getSpawnChance()).toBe(0.06);
    });

    it('should not spawn if check interval not reached', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      worldMock.world.context = { gameTime: 10000, currentWave: 1, playerId: 0 };
      system.tick(4900); // < CHECK_INTERVAL (5000)
      expect(worldMock.world.spawnFromArchetype).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should spawn when check interval reached and roll succeeds', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      worldMock.world.context = { gameTime: 10000, currentWave: 1, playerId: 0 };
      system.tick(5100); // > CHECK_INTERVAL (5000)
      expect(worldMock.world.spawnFromArchetype).toHaveBeenCalledTimes(1);

      Math.random = originalRandom;
    });

    it('should not spawn if cooldown active', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      // First spawn
      worldMock.world.context = { gameTime: 10000, currentWave: 1, playerId: 0 };
      system.tick(5100);
      expect(worldMock.world.spawnFromArchetype).toHaveBeenCalledTimes(1);

      // Reset query mock for second tick
      worldMock.world.query = vi.fn(function* () {
        const hpStore = worldMock.stores.get('healthPack')!;
        for (const [entityId] of hpStore) {
          if (!worldMock.activeEntities.has(entityId)) continue;
          const hp = hpStore.get(entityId);
          const t = worldMock.stores.get('transform')!.get(entityId);
          if (!hp || !t) continue;
          yield [entityId, hp, t];
        }
      }) as never;

      // Second tick during cooldown (gameTime 14000 < lastSpawn 10000 + 5000)
      worldMock.world.context = { gameTime: 14000, currentWave: 1, playerId: 0 };
      system.tick(5100);
      expect(worldMock.world.spawnFromArchetype).toHaveBeenCalledTimes(1); // still 1

      Math.random = originalRandom;
    });
  });

  describe('checkCollection', () => {
    it('should collect pack if cursor is in range', () => {
      const entityId = 99;
      worldMock.activeEntities.add(entityId);
      if (!worldMock.stores.has('healthPack')) worldMock.stores.set('healthPack', new Map());
      worldMock.stores.get('healthPack')!.set(entityId, {
        moveSpeed: 80,
        pulsePhase: 0,
        hasPreMissWarningEmitted: false,
      });
      if (!worldMock.stores.has('transform')) worldMock.stores.set('transform', new Map());
      worldMock.stores.get('transform')!.set(entityId, { x: 100, y: 100 });
      if (!worldMock.stores.has('phaserNode')) worldMock.stores.set('phaserNode', new Map());
      worldMock.stores.get('phaserNode')!.set(entityId, {
        container: {
          disableInteractive: vi.fn(),
          removeAllListeners: vi.fn(),
          setVisible: vi.fn(),
          setActive: vi.fn(),
        },
        spawnTween: null,
      });

      worldMock.world.query = vi.fn(function* () {
        yield [entityId, worldMock.stores.get('healthPack')!.get(entityId), worldMock.stores.get('transform')!.get(entityId)];
      }) as never;

      // Out of range (distance 60 > hitDistance 55)
      system.checkCollection(100, 160, 30);
      expect(mockEmit).not.toHaveBeenCalledWith(GameEvents.HEALTH_PACK_COLLECTED, expect.anything());

      // In range (distance 40 < hitDistance 55)
      system.checkCollection(100, 140, 30);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.HEALTH_PACK_COLLECTED, expect.objectContaining({ x: 100, y: 100 }));
    });
  });

  describe('clear', () => {
    it('should remove all health pack entities', () => {
      const ids = [71, 72];
      for (const id of ids) {
        worldMock.activeEntities.add(id);
        if (!worldMock.stores.has('phaserNode')) worldMock.stores.set('phaserNode', new Map());
        worldMock.stores.get('phaserNode')!.set(id, {
          container: {
            setVisible: vi.fn(),
            setActive: vi.fn(),
            disableInteractive: vi.fn(),
            removeAllListeners: vi.fn(),
          },
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
