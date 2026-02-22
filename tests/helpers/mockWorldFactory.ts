import { vi } from 'vitest';

export interface MockWorldStores {
  dishTagStore: Map<string, Record<string, never>>;
  dishPropsStore: Map<string, { size: number; color?: number; interactiveRadius?: number; upgradeOptions?: unknown; destroyedByAbility?: boolean }>;
  bombPropsStore: Map<string, { size: number; color?: number; playerDamage?: number; resetCombo?: boolean; destroyedByAbility?: boolean }>;
  transformStore: Map<string, { x: number; y: number; baseX?: number; baseY?: number; alpha?: number; scaleX?: number; scaleY?: number }>;
  lifetimeStore: Map<string, { elapsedTime: number; spawnDuration: number; movementTime?: number; lifetime?: number | null; globalSlowPercent?: number } | null>;
  fallingBombStore: Map<string, { fullySpawned: boolean }>;
  phaserNodeStore: Map<string, { container: { x: number; y: number } }>;
  activeEntities: Set<string>;
}

export function createMockWorldStores(): MockWorldStores {
  return {
    dishTagStore: new Map(),
    dishPropsStore: new Map(),
    bombPropsStore: new Map(),
    transformStore: new Map(),
    lifetimeStore: new Map(),
    fallingBombStore: new Map(),
    phaserNodeStore: new Map(),
    activeEntities: new Set(),
  };
}

export function createMockWorldApi(stores: MockWorldStores) {
  const world = {
    dishTag: {
      get: (id: string) => stores.dishTagStore.get(id),
      has: (id: string) => stores.dishTagStore.has(id),
      set: (id: string, val: Record<string, never>) => stores.dishTagStore.set(id, val),
      size: () => stores.dishTagStore.size,
      entries: () => stores.dishTagStore.entries(),
    },
    dishProps: {
      get: (id: string) => stores.dishPropsStore.get(id),
      has: (id: string) => stores.dishPropsStore.has(id),
      set: (id: string, val: { size: number }) => stores.dishPropsStore.set(id, val),
      size: () => stores.dishPropsStore.size,
      entries: () => stores.dishPropsStore.entries(),
    },
    bombProps: {
      get: (id: string) => stores.bombPropsStore.get(id),
      has: (id: string) => stores.bombPropsStore.has(id),
      set: (id: string, val: { size: number }) => stores.bombPropsStore.set(id, val),
      size: () => stores.bombPropsStore.size,
      entries: () => stores.bombPropsStore.entries(),
    },
    transform: {
      get: (id: string) => stores.transformStore.get(id),
      has: (id: string) => stores.transformStore.has(id),
      set: (id: string, val: { x: number; y: number }) => stores.transformStore.set(id, val),
      size: () => stores.transformStore.size,
      entries: () => stores.transformStore.entries(),
    },
    lifetime: {
      get: (id: string) => stores.lifetimeStore.get(id) ?? null,
      has: (id: string) => stores.lifetimeStore.has(id),
      set: (id: string, val: { elapsedTime: number; spawnDuration: number }) => stores.lifetimeStore.set(id, val),
      size: () => stores.lifetimeStore.size,
      entries: () => stores.lifetimeStore.entries(),
    },
    fallingBomb: {
      get: (id: string) => stores.fallingBombStore.get(id),
      has: (id: string) => stores.fallingBombStore.has(id),
    },
    phaserNode: {
      get: (id: string) => stores.phaserNodeStore.get(id),
      has: (id: string) => stores.phaserNodeStore.has(id),
      set: (id: string, val: { container: { x: number; y: number } }) => stores.phaserNodeStore.set(id, val),
    },
    createEntity: (id: string) => stores.activeEntities.add(id),
    isActive: (id: string) => stores.activeEntities.has(id),
    query: vi.fn(),
    _stores: stores,
  };

  // Query dispatches based on first component def name
  world.query = vi.fn(function (...defs: Array<{ name?: string }>) {
    const firstName = defs[0]?.name;
    if (firstName === 'dishTag') {
      return (function* () {
        for (const [entityId] of stores.dishTagStore) {
          if (!stores.activeEntities.has(entityId)) continue;
          const dp = stores.dishPropsStore.get(entityId);
          const t = stores.transformStore.get(entityId);
          if (!dp || !t) continue;
          yield [entityId, stores.dishTagStore.get(entityId), dp, t];
        }
      })();
    }
    if (firstName === 'bombProps') {
      return (function* () {
        for (const [entityId] of stores.bombPropsStore) {
          if (!stores.activeEntities.has(entityId)) continue;
          const bp = stores.bombPropsStore.get(entityId);
          const t = stores.transformStore.get(entityId);
          if (!bp || !t) continue;
          yield [entityId, bp, t];
        }
      })();
    }
    return (function* () {})();
  });

  return world;
}

let _entityIdCounter = 0;

export function resetEntityIdCounter(): void {
  _entityIdCounter = 0;
}

export function addDishToWorld(
  stores: MockWorldStores,
  x: number,
  y: number,
  opts: { size?: number; phaserNode?: boolean } = {},
): string {
  const id = `dish_${_entityIdCounter++}`;
  stores.activeEntities.add(id);
  stores.dishTagStore.set(id, {} as Record<string, never>);
  stores.dishPropsStore.set(id, { size: opts.size ?? 10 });
  stores.transformStore.set(id, { x, y });
  if (opts.phaserNode) {
    stores.phaserNodeStore.set(id, { container: { x, y } });
  }
  return id;
}

export function addBombToWorld(
  stores: MockWorldStores,
  x: number,
  y: number,
  opts: { size?: number; spawnDuration?: number; elapsedTime?: number; phaserNode?: boolean; fallingBomb?: { fullySpawned: boolean } } = {},
): string {
  const id = `bomb_${_entityIdCounter++}`;
  stores.activeEntities.add(id);
  stores.bombPropsStore.set(id, { size: opts.size ?? 10 });
  stores.transformStore.set(id, { x, y });
  if (opts.spawnDuration !== undefined || opts.elapsedTime !== undefined) {
    stores.lifetimeStore.set(id, {
      elapsedTime: opts.elapsedTime ?? 9999,
      spawnDuration: opts.spawnDuration ?? 0,
    });
  }
  if (opts.phaserNode) {
    stores.phaserNodeStore.set(id, { container: { x, y } });
  }
  if (opts.fallingBomb) {
    stores.fallingBombStore.set(id, opts.fallingBomb);
  }
  return id;
}

/**
 * 테스트용 SpatialIndex mock. 모든 활성 엔티티를 반환하여
 * 시스템의 정밀 거리 체크 로직을 그대로 테스트할 수 있게 한다.
 */
export function createMockSpatialIndex(stores: MockWorldStores) {
  return {
    dishGrid: {
      forEachInRadius: (_cx: number, _cy: number, _r: number, cb: (id: string) => void) => {
        for (const [id] of stores.dishTagStore) {
          if (stores.activeEntities.has(id)) cb(id);
        }
      },
      forEachEntity: (cb: (id: string) => void) => {
        for (const [id] of stores.dishTagStore) {
          if (stores.activeEntities.has(id)) cb(id);
        }
      },
    },
    bombGrid: {
      forEachInRadius: (_cx: number, _cy: number, _r: number, cb: (id: string) => void) => {
        for (const [id] of stores.bombPropsStore) {
          if (stores.activeEntities.has(id)) cb(id);
        }
      },
      forEachEntity: (cb: (id: string) => void) => {
        for (const [id] of stores.bombPropsStore) {
          if (stores.activeEntities.has(id)) cb(id);
        }
      },
    },
    rebuild: vi.fn(),
    clear: vi.fn(),
  };
}
