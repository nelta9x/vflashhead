import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { OrbSystem } from '../src/systems/OrbSystem';

describe('OrbSystem', () => {
  let system: OrbSystem;
  let mockUpgradeSystem: any;
  let mockDishPool: any;
  let mockDishes: any[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUpgradeSystem = {
      getOrbitingOrbLevel: vi.fn(),
      getOrbitingOrbData: vi.fn(),
      getMagnetLevel: vi.fn().mockReturnValue(0),
    };

    mockDishes = [];
    mockDishPool = {
      forEach: vi.fn((callback) => {
        mockDishes.forEach((dish) => callback(dish));
      }),
    };

    system = new OrbSystem(mockUpgradeSystem);
  });

  it('should not spawn orbs if level is 0', () => {
    mockUpgradeSystem.getOrbitingOrbLevel.mockReturnValue(0);

    system.update(100, 0, 0, 0, mockDishPool);

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

    system.update(100, 0, 0, 0, mockDishPool);

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
    const mockDish = {
      active: true,
      x: 100,
      y: 0,
      getSize: () => 10,
      isDangerous: () => false,
      applyDamage: vi.fn(),
    };
    mockDishes.push(mockDish);

    system.update(100, 1000, 0, 0, mockDishPool);

    expect(mockDish.applyDamage).toHaveBeenCalledWith(10);
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

    const mockDish = {
      active: true,
      x: 100,
      y: 0,
      getSize: () => 10,
      isDangerous: () => false,
      applyDamage: vi.fn(),
    };
    mockDishes.push(mockDish);

    // First hit
    system.update(100, 1000, 0, 0, mockDishPool);
    expect(mockDish.applyDamage).toHaveBeenCalledTimes(1);

    // Second update (immediate) - Should fail cooldown
    mockDish.applyDamage.mockClear();
    system.update(100, 1100, 0, 0, mockDishPool); // +100ms
    expect(mockDish.applyDamage).not.toHaveBeenCalled();

    // Third update (after cooldown 300ms)
    system.update(100, 1400, 0, 0, mockDishPool); // +400ms from start
    expect(mockDish.applyDamage).toHaveBeenCalledTimes(1);
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

    system.update(100, 0, 0, 0, mockDishPool);

    const orb = system.getOrbs()[0];
    // Base 10. Magnet 5 * 0.2 = +100% -> 2.0x -> 20.
    expect(orb.size).toBe(20);
  });
});
