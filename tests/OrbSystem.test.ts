import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpgradeSystem } from '../src/systems/UpgradeSystem';

// Mock Phaser
vi.mock('phaser', () => {
  return {
    default: {
      Math: {
        Distance: {
          Between: (x1: number, y1: number, x2: number, y2: number) => {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          },
        },
        DegToRad: (deg: number) => deg * (Math.PI / 180),
      },
    },
  };
});

// Mock EventBus
const mockEmit = vi.fn();
vi.mock('../src/utils/EventBus', async () => {
  const actual = await vi.importActual('../src/utils/EventBus');
  return {
    ...actual,
    EventBus: {
      getInstance: () => ({
        emit: mockEmit,
      }),
    },
  };
});

import { OrbSystem } from '../src/systems/OrbSystem';

let entityIdCounter = 0;

// Helper: minimal mock World that supports query() for tests
function createMockWorld() {
  const dishTagStore = new Map<string, Record<string, never>>();
  const dishPropsStore = new Map<string, { dangerous: boolean; size: number; invulnerable?: boolean; color?: number; interactiveRadius?: number; upgradeOptions?: unknown; destroyedByAbility?: boolean }>();
  const transformStore = new Map<string, { x: number; y: number; baseX?: number; baseY?: number; alpha?: number; scaleX?: number; scaleY?: number }>();
  const lifetimeStore = new Map<string, { elapsedTime: number; spawnDuration: number; movementTime?: number; lifetime?: number | null; globalSlowPercent?: number }>();
  const activeEntities = new Set<string>();

  const world = {
    dishTag: {
      get: (id: string) => dishTagStore.get(id),
      has: (id: string) => dishTagStore.has(id),
      set: (id: string, val: Record<string, never>) => dishTagStore.set(id, val),
      size: () => dishTagStore.size,
      entries: () => dishTagStore.entries(),
    },
    dishProps: {
      get: (id: string) => dishPropsStore.get(id),
      has: (id: string) => dishPropsStore.has(id),
      set: (id: string, val: { dangerous: boolean; size: number }) => dishPropsStore.set(id, val),
      size: () => dishPropsStore.size,
      entries: () => dishPropsStore.entries(),
    },
    transform: {
      get: (id: string) => transformStore.get(id),
      has: (id: string) => transformStore.has(id),
      set: (id: string, val: { x: number; y: number }) => transformStore.set(id, val),
      size: () => transformStore.size,
      entries: () => transformStore.entries(),
    },
    lifetime: {
      get: (id: string) => lifetimeStore.get(id),
      has: (id: string) => lifetimeStore.has(id),
      set: (id: string, val: { elapsedTime: number; spawnDuration: number }) => lifetimeStore.set(id, val),
      size: () => lifetimeStore.size,
      entries: () => lifetimeStore.entries(),
    },
    createEntity: (id: string) => activeEntities.add(id),
    isActive: (id: string) => activeEntities.has(id),
    query: vi.fn(function* (..._defs: unknown[]) {
      // Iterate over dishTag as pivot, yield tuples matching query(C_DishTag, C_DishProps, C_Transform, C_Lifetime)
      for (const [entityId] of dishTagStore) {
        if (!activeEntities.has(entityId)) continue;
        const dp = dishPropsStore.get(entityId);
        const t = transformStore.get(entityId);
        const lt = lifetimeStore.get(entityId);
        if (!dp || !t || !lt) continue;
        yield [entityId, dishTagStore.get(entityId), dp, t, lt];
      }
    }),
    _stores: { dishTagStore, dishPropsStore, transformStore, lifetimeStore, activeEntities },
  };

  // Re-implement query as a function that returns a fresh generator each call
  world.query = vi.fn(function () {
    return (function* () {
      for (const [entityId] of dishTagStore) {
        if (!activeEntities.has(entityId)) continue;
        const dp = dishPropsStore.get(entityId);
        const t = transformStore.get(entityId);
        const lt = lifetimeStore.get(entityId);
        if (!dp || !t || !lt) continue;
        yield [entityId, dishTagStore.get(entityId), dp, t, lt];
      }
    })();
  });

  return world;
}

describe('OrbSystem', () => {
  let system: OrbSystem;
  let mockUpgradeSystem: {
    getOrbitingOrbLevel: ReturnType<typeof vi.fn>;
    getOrbitingOrbData: ReturnType<typeof vi.fn>;
    getMagnetLevel: ReturnType<typeof vi.fn>;
    getCriticalChanceBonus: ReturnType<typeof vi.fn>;
    getSystemUpgrade: ReturnType<typeof vi.fn>;
  };

  let mockWorld: ReturnType<typeof createMockWorld>;

  // DamageService mock
  let mockDamageService: {
    forceDestroy: ReturnType<typeof vi.fn>;
    applyUpgradeDamage: ReturnType<typeof vi.fn>;
  };

  const addDishToWorld = (x: number, y: number, opts: { dangerous?: boolean; size?: number; spawnDuration?: number; elapsedTime?: number } = {}): string => {
    const id = `dish_${entityIdCounter++}`;
    const stores = mockWorld._stores;
    stores.activeEntities.add(id);
    stores.dishTagStore.set(id, {} as Record<string, never>);
    stores.dishPropsStore.set(id, { dangerous: opts.dangerous ?? false, size: opts.size ?? 10 });
    stores.transformStore.set(id, { x, y });
    stores.lifetimeStore.set(id, {
      elapsedTime: opts.elapsedTime ?? 9999,
      spawnDuration: opts.spawnDuration ?? 0,
    });
    return id;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    entityIdCounter = 0;

    mockUpgradeSystem = {
      getOrbitingOrbLevel: vi.fn(),
      getOrbitingOrbData: vi.fn(),
      getMagnetLevel: vi.fn().mockReturnValue(0),
      getCriticalChanceBonus: vi.fn().mockReturnValue(0),
      getSystemUpgrade: vi.fn().mockReturnValue({
        hitInterval: 300,
        overclockDurationMs: 0,
        overclockSpeedMultiplier: 1,
        overclockMaxStacks: 0,
      }),
    };

    mockWorld = createMockWorld();
    mockDamageService = {
      forceDestroy: vi.fn(),
      applyUpgradeDamage: vi.fn(),
    };

    system = new OrbSystem(
      mockUpgradeSystem as unknown as UpgradeSystem,
      mockWorld as never,
      mockDamageService as never,
      () => [],
      vi.fn(),
      { render: vi.fn() } as never
    );
  });

  it('should not spawn orbs if level is 0', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(0);

    system.update(100, 0, 0, 0);

    expect(system.getOrbs()).toHaveLength(0);
  });

  it('should spawn orbs if level > 0', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 2,
      damage: 10,
      speed: 100,
      radius: 100,
      size: 10,
    });

    system.update(100, 0, 0, 0);

    const orbs = system.getOrbs();
    expect(orbs).toHaveLength(2);
    // Initial angle 0 + speed update.
    // For simiplicity, just check radius
    const orb = orbs[0];
    const dist = Math.sqrt(orb.x * orb.x + orb.y * orb.y);
    expect(dist).toBeCloseTo(100);
  });

  it('should apply damage to dishes in range', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0, // Stop rotation for easy calc
      radius: 100,
      size: 10,
    });

    // Player at 0,0. Orb at 100,0. Size 10.
    const dishId = addDishToWorld(100, 0);

    system.update(100, 1000, 0, 0);

    expect(mockDamageService.applyUpgradeDamage).toHaveBeenCalledWith(dishId, 10, 0, 0);
  });

  it('should respect hit cooldown', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });

    const dishId = addDishToWorld(100, 0);

    // First hit
    system.update(100, 1000, 0, 0);
    expect(mockDamageService.applyUpgradeDamage).toHaveBeenCalledTimes(1);

    // Second update (immediate) - Should fail cooldown
    mockDamageService.applyUpgradeDamage.mockClear();
    system.update(100, 1100, 0, 0); // +100ms
    expect(mockDamageService.applyUpgradeDamage).not.toHaveBeenCalled();

    // Third update (after cooldown 300ms)
    system.update(100, 1400, 0, 0); // +400ms from start
    expect(mockDamageService.applyUpgradeDamage).toHaveBeenCalledTimes(1);

    // Suppress unused variable warning
    void dishId;
  });

  it('should use hitInterval from upgrade data (orbiting_orb) for cooldown', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });
    mockUpgradeSystem.getSystemUpgrade.mockReturnValue({ hitInterval: 900 });

    const dishId = addDishToWorld(100, 0);

    // First hit at t=1000
    system.update(100, 1000, 0, 0);
    expect(mockDamageService.applyUpgradeDamage).toHaveBeenCalledTimes(1);

    // 800ms later: still in cooldown when hitInterval=900
    mockDamageService.applyUpgradeDamage.mockClear();
    system.update(100, 1800, 0, 0);
    expect(mockDamageService.applyUpgradeDamage).not.toHaveBeenCalled();

    // 900ms later: cooldown expired
    system.update(100, 1900, 0, 0);
    expect(mockDamageService.applyUpgradeDamage).toHaveBeenCalledTimes(1);

    void dishId;
  });

  it('should forward critical chance bonus to dish damage calculation', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });
    mockUpgradeSystem.getCriticalChanceBonus.mockReturnValue(0.35);

    const dishId = addDishToWorld(100, 0);

    system.update(100, 1000, 0, 0);

    expect(mockDamageService.applyUpgradeDamage).toHaveBeenCalledWith(dishId, 10, 0, 0.35);
  });

  it('should apply magnet synergy to size', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });
    mockUpgradeSystem.getMagnetLevel.mockReturnValue(5); // Level 5 Magnet

    system.update(100, 0, 0, 0);

    const orb = system.getOrbs()[0];
    // Base 10. Magnet 5 * 0.2 = +100% -> 2.0x -> 20.
    expect(orb.size).toBe(20);
  });

  it('should hit dangerous dishes only when fully spawned', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });

    // Dangerous bomb dish with spawn tracking via lifetime store
    const bombId = addDishToWorld(100, 0, { dangerous: true, size: 10, spawnDuration: 500, elapsedTime: 100 });

    // Case 1: Dangerous and NOT fully spawned (elapsedTime < spawnDuration)
    system.update(100, 1000, 0, 0);
    expect(mockDamageService.forceDestroy).not.toHaveBeenCalled();

    // Case 2: Dangerous and fully spawned but TOO FAR
    // Update lifetime to be fully spawned
    mockWorld._stores.lifetimeStore.set(bombId, { elapsedTime: 9999, spawnDuration: 500 });
    mockWorld._stores.transformStore.set(bombId, { x: 200, y: 0 }); // Orb is at x=100. Distance = 100. (10+10)*1.5 = 30.
    system.update(100, 2000, 0, 0);
    expect(mockDamageService.forceDestroy).not.toHaveBeenCalled();

    // Case 3: Within 1.5x range
    mockWorld._stores.transformStore.set(bombId, { x: 125, y: 0 }); // Distance = 25. <= 30.
    system.update(100, 3000, 0, 0);
    expect(mockDamageService.forceDestroy).toHaveBeenCalledWith(bombId, true);
  });

  it('should trigger overclock only when bomb is destroyed by orb', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 90,
      radius: 100,
      size: 10,
    });
    mockUpgradeSystem.getSystemUpgrade.mockReturnValue({
      hitInterval: 300,
      overclockDurationMs: 3000,
      overclockSpeedMultiplier: 2,
      overclockMaxStacks: 3,
    });

    addDishToWorld(0, 100);

    system.update(1000, 1000, 0, 0);
    system.update(1000, 2000, 0, 0);

    const orb = system.getOrbs()[0];
    expect(orb.x).toBeCloseTo(-100, 3);
    expect(orb.y).toBeCloseTo(0, 3);
  });

  it('should apply overclock speed boost after bomb destroy and expire after duration', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 90,
      radius: 100,
      size: 10,
    });
    mockUpgradeSystem.getSystemUpgrade.mockReturnValue({
      hitInterval: 300,
      overclockDurationMs: 3000,
      overclockSpeedMultiplier: 2,
      overclockMaxStacks: 3,
    });

    const bombId = addDishToWorld(0, 100, { dangerous: true, size: 10, spawnDuration: 0, elapsedTime: 9999 });
    mockDamageService.forceDestroy.mockImplementation(() => {
      // Simulate destruction by removing from active entities
      mockWorld._stores.activeEntities.delete(bombId);
    });

    system.update(1000, 1000, 0, 0); // stack 1
    system.update(1000, 2000, 0, 0); // boosted

    const boostedOrb = system.getOrbs()[0];
    expect(boostedOrb.x).toBeCloseTo(0, 3);
    expect(boostedOrb.y).toBeCloseTo(-100, 3);

    system.update(1000, 5000, 0, 0); // expired
    const expiredOrb = system.getOrbs()[0];
    expect(expiredOrb.x).toBeCloseTo(100, 3);
    expect(expiredOrb.y).toBeCloseTo(0, 3);
  });

  it('should stack overclock up to max stacks and clamp additional bomb kills', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 60,
      radius: 100,
      size: 10,
    });
    mockUpgradeSystem.getSystemUpgrade.mockReturnValue({
      hitInterval: 300,
      overclockDurationMs: 3000,
      overclockSpeedMultiplier: 2,
      overclockMaxStacks: 3,
    });

    const makeBombInWorld = (x: number, y: number) => {
      const id = addDishToWorld(x, y, { dangerous: true, size: 10, spawnDuration: 0, elapsedTime: 9999 });
      mockDamageService.forceDestroy.mockImplementationOnce(() => {
        mockWorld._stores.activeEntities.delete(id);
      });
      return id;
    };

    makeBombInWorld(50, 86.6025403784); // angle 60, stack 1
    system.update(1000, 1000, 0, 0);

    makeBombInWorld(-100, 0); // angle 180, stack 2
    system.update(1000, 2000, 0, 0);

    makeBombInWorld(100, 0); // angle 0, stack 3
    system.update(1000, 3000, 0, 0);

    makeBombInWorld(-50, -86.6025403784); // angle 240, tries stack 4 but clamped to 3
    system.update(1000, 4000, 0, 0);

    system.update(1000, 5000, 0, 0);
    const orb = system.getOrbs()[0];

    // stack 3 유지 시 최종 각도 120도
    expect(orb.x).toBeCloseTo(-50, 2);
    expect(orb.y).toBeCloseTo(86.6, 2);
  });

  it('should deal damage to boss on orb collision', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 25,
      speed: 0,
      radius: 100,
      size: 10,
    });

    const onBossDamage = vi.fn();
    const getBossSnapshots = () => [{ id: 'boss1', x: 100, y: 0, radius: 20 }];

    system.update(
      100, 1000, 0, 0,
      getBossSnapshots,
      onBossDamage
    );

    expect(onBossDamage).toHaveBeenCalledWith('boss1', 25, expect.closeTo(100, 0), expect.closeTo(0, 0));
  });

  it('should respect boss hit cooldown', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 25,
      speed: 0,
      radius: 100,
      size: 10,
    });

    const onBossDamage = vi.fn();
    const getBossSnapshots = () => [{ id: 'boss1', x: 100, y: 0, radius: 20 }];

    // First hit at t=1000
    system.update(100, 1000, 0, 0, getBossSnapshots, onBossDamage);
    expect(onBossDamage).toHaveBeenCalledTimes(1);

    // Too soon: t=1100, cooldown 300ms not elapsed
    onBossDamage.mockClear();
    system.update(100, 1100, 0, 0, getBossSnapshots, onBossDamage);
    expect(onBossDamage).not.toHaveBeenCalled();

    // After cooldown: t=1300 (1000 + 300)
    system.update(100, 1300, 0, 0, getBossSnapshots, onBossDamage);
    expect(onBossDamage).toHaveBeenCalledTimes(1);
  });

  it('should not hit boss when orb is out of range', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 25,
      speed: 0,
      radius: 100,
      size: 10,
    });

    const onBossDamage = vi.fn();
    // Boss far away: orb at ~(100,0), boss at (300,0). dist=200 > 10+20=30
    const getBossSnapshots = () => [{ id: 'boss1', x: 300, y: 0, radius: 20 }];

    system.update(
      100, 1000, 0, 0,
      getBossSnapshots,
      onBossDamage
    );

    expect(onBossDamage).not.toHaveBeenCalled();
  });
});
