import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpgradeSystem } from '../src/plugins/builtin/services/UpgradeSystem';

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

import { OrbSystem } from '../src/plugins/builtin/systems/OrbSystem';
import {
  createMockWorldStores,
  createMockWorldApi,
  addDishToWorld as addDish,
  addBombToWorld as addBomb,
  resetEntityIdCounter,
} from './helpers/mockWorldFactory';

describe('OrbSystem', () => {
  let system: OrbSystem;
  let mockUpgradeSystem: {
    getOrbitingOrbLevel: ReturnType<typeof vi.fn>;
    getOrbitingOrbData: ReturnType<typeof vi.fn>;
    getMagnetLevel: ReturnType<typeof vi.fn>;
    getCriticalChanceBonus: ReturnType<typeof vi.fn>;
    getSystemUpgrade: ReturnType<typeof vi.fn>;
  };

  let mockWorld: ReturnType<typeof createMockWorldApi>;
  let mockStores: ReturnType<typeof createMockWorldStores>;

  // DamageService mock
  let mockDamageService: {
    forceDestroy: ReturnType<typeof vi.fn>;
    applyUpgradeDamage: ReturnType<typeof vi.fn>;
  };

  const addDishToWorld = (x: number, y: number, opts: { size?: number } = {}): string => {
    return addDish(mockStores, x, y, opts);
  };

  const addBombToWorld = (x: number, y: number, opts: { size?: number; spawnDuration?: number; elapsedTime?: number } = {}): string => {
    return addBomb(mockStores, x, y, opts);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetEntityIdCounter();

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

    mockStores = createMockWorldStores();
    mockWorld = createMockWorldApi(mockStores);
    mockDamageService = {
      forceDestroy: vi.fn(),
      applyUpgradeDamage: vi.fn(),
    };

    const mockBcc = {
      getAliveVisibleBossSnapshotsWithRadius: () => [],
      damageBoss: vi.fn(),
    };
    system = new OrbSystem(
      mockUpgradeSystem as unknown as UpgradeSystem,
      mockWorld as never,
      mockDamageService as never,
      mockBcc as never,
      { render: vi.fn() } as never,
    );
    // Simulate start() with a mock FallingBombSystem
    system.start({
      services: {
        get: () => ({ tryDestroyBomb: vi.fn(), forceDestroy: vi.fn() }),
      } as never,
    });
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

  it('should hit bombs only when fully spawned', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });

    // Bomb with spawn tracking via lifetime store
    const bombId = addBombToWorld(100, 0, { size: 10, spawnDuration: 500, elapsedTime: 100 });

    // Case 1: NOT fully spawned (elapsedTime < spawnDuration)
    system.update(100, 1000, 0, 0);
    expect(mockDamageService.forceDestroy).not.toHaveBeenCalled();

    // Case 2: Fully spawned but TOO FAR
    mockStores.lifetimeStore.set(bombId, { elapsedTime: 9999, spawnDuration: 500 });
    mockStores.transformStore.set(bombId, { x: 200, y: 0 }); // Orb is at x=100. Distance = 100. (10+10)*1.5 = 30.
    system.update(100, 2000, 0, 0);
    expect(mockDamageService.forceDestroy).not.toHaveBeenCalled();

    // Case 3: Within 1.5x range
    mockStores.transformStore.set(bombId, { x: 125, y: 0 }); // Distance = 25. <= 30.
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

    addDishToWorld(0, 100, { size: 10 });

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

    const bombId = addBombToWorld(0, 100, { size: 10, spawnDuration: 0, elapsedTime: 9999 });
    mockDamageService.forceDestroy.mockImplementation(() => {
      // Simulate destruction by removing from active entities
      mockStores.activeEntities.delete(bombId);
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
      const id = addBombToWorld(x, y, { size: 10, spawnDuration: 0, elapsedTime: 9999 });
      mockDamageService.forceDestroy.mockImplementationOnce(() => {
        mockStores.activeEntities.delete(id);
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

  it('should skip falling bombs that are not fully spawned', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(1);
    mockUpgradeSystem.getOrbitingOrbData.mockReturnValue({
      count: 1,
      damage: 10,
      speed: 0,
      radius: 100,
      size: 10,
    });

    // Falling bomb that is NOT fully spawned — should be skipped by OrbSystem bomb loop
    const bombId = addBombToWorld(100, 0, { size: 10, spawnDuration: 500, elapsedTime: 9999 });
    mockStores.fallingBombStore.set(bombId, { fullySpawned: false });

    system.update(100, 1000, 0, 0);
    expect(mockDamageService.forceDestroy).not.toHaveBeenCalled();
  });
});
