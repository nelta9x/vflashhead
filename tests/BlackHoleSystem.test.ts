import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dish } from '../src/entities/Dish';
import type { UpgradeSystem } from '../src/systems/UpgradeSystem';
import type { BlackHoleLevelData } from '../src/data/types';
import type { ObjectPool } from '../src/utils/ObjectPool';

const { mockFloatBetween } = vi.hoisted(() => ({
  mockFloatBetween: vi.fn((min: number, max: number) => (min + max) / 2),
}));

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
      FloatBetween: mockFloatBetween,
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
      },
      Angle: {
        Between: (x1: number, y1: number, x2: number, y2: number) => Math.atan2(y2 - y1, x2 - x1),
      },
    },
  },
}));

vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    dishes: {
      damage: {
        criticalChance: 0,
        criticalMultiplier: 1.5,
      },
    },
  },
}));

const mockEmit = vi.fn();
vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
    }),
  },
  GameEvents: {
    BLACK_HOLE_CONSUMED: 'blackHole:consumed',
  },
}));

import { BlackHoleSystem } from '../src/systems/BlackHoleSystem';

interface MockDish {
  active: boolean;
  x: number;
  y: number;
  isDangerous: () => boolean;
  applyDamageWithUpgrades: (
    baseDamage: number,
    damageBonus: number,
    criticalChanceBonus: number
  ) => void;
  setBeingPulled: (pulled: boolean) => void;
  forceDestroy: (byAbility?: boolean) => void;
}

describe('BlackHoleSystem', () => {
  let blackHoleLevel = 0;
  let blackHoleData: BlackHoleLevelData | null = null;
  let criticalChanceBonus = 0;
  let dishes: MockDish[];
  let bosses: Array<{ id: string; x: number; y: number; radius: number }>;
  let damageBoss: ReturnType<typeof vi.fn>;
  let system: BlackHoleSystem;

  const createDishPool = (): ObjectPool<Dish> =>
    ({
      getActiveObjects: () => dishes as unknown as Dish[],
    }) as unknown as ObjectPool<Dish>;

  const setupSystem = (): void => {
    const upgradeSystem = {
      getBlackHoleLevel: () => blackHoleLevel,
      getBlackHoleData: () => blackHoleData,
      getCriticalChanceBonus: () => criticalChanceBonus,
    } as unknown as UpgradeSystem;

    damageBoss = vi.fn();
    system = new BlackHoleSystem(
      upgradeSystem,
      () => createDishPool(),
      () => bosses,
      damageBoss
    );
  };

  beforeEach(() => {
    blackHoleLevel = 0;
    blackHoleData = null;
    criticalChanceBonus = 0;
    dishes = [];
    bosses = [];
    damageBoss = vi.fn();
    mockFloatBetween.mockReset();
    mockFloatBetween.mockImplementation((min: number, max: number) => (min + max) / 2);
    mockEmit.mockReset();
    setupSystem();
  });

  it('has no active black holes at level 0', () => {
    system.update(16, 16);
    expect(system.getBlackHoles()).toHaveLength(0);
  });

  it('spawns immediately when black hole level is gained', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 1200,
      damage: 1,
      force: 260,
      spawnInterval: 7600,
      duration: 7600,
      spawnCount: 1,
      radius: 130,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };

    system.update(16, 16);

    const holes = system.getBlackHoles();
    expect(holes).toHaveLength(1);
    expect(holes[0].radius).toBe(130);
  });

  it('expires old holes and spawns new ones per spawn interval', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 1200,
      damage: 1,
      force: 260,
      spawnInterval: 1000,
      duration: 1000,
      spawnCount: 1,
      radius: 130,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween
      .mockReturnValueOnce(300)
      .mockReturnValueOnce(220)
      .mockReturnValueOnce(760)
      .mockReturnValueOnce(480);

    system.update(16, 16);
    const firstSpawn = system.getBlackHoles();
    system.update(1000, 1016);
    const secondSpawn = system.getBlackHoles();

    expect(firstSpawn).toHaveLength(1);
    expect(secondSpawn).toHaveLength(1);
    expect(firstSpawn[0].x).not.toBe(secondSpawn[0].x);
    expect(firstSpawn[0].y).not.toBe(secondSpawn[0].y);
  });

  it('accumulates holes when duration exceeds spawn interval', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 260,
      spawnInterval: 1000,
      duration: 3000,
      spawnCount: 1,
      radius: 130,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };

    system.update(16, 16);
    expect(system.getBlackHoles()).toHaveLength(1);

    system.update(1000, 1016);
    expect(system.getBlackHoles()).toHaveLength(2);

    system.update(1000, 2016);
    expect(system.getBlackHoles()).toHaveLength(3);
  });

  it('removes expired holes after duration elapses', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 260,
      spawnInterval: 9999,
      duration: 500,
      spawnCount: 1,
      radius: 130,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };

    system.update(16, 16);
    expect(system.getBlackHoles()).toHaveLength(1);

    system.update(400, 416);
    expect(system.getBlackHoles()).toHaveLength(1);

    system.update(100, 516);
    expect(system.getBlackHoles()).toHaveLength(0);
  });

  it('spawns configured count each cycle', () => {
    blackHoleLevel = 2;
    blackHoleData = {
      damageInterval: 1000,
      damage: 2,
      force: 300,
      spawnInterval: 7000,
      duration: 7000,
      spawnCount: 2,
      radius: 180,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };

    system.update(16, 16);
    expect(system.getBlackHoles()).toHaveLength(2);
  });

  it('keeps all holes fully inside map bounds including radius', () => {
    blackHoleLevel = 2;
    blackHoleData = {
      damageInterval: 1000,
      damage: 2,
      force: 300,
      spawnInterval: 7000,
      duration: 7000,
      spawnCount: 2,
      radius: 200,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };

    system.update(16, 16);

    for (const hole of system.getBlackHoles()) {
      expect(hole.x).toBeGreaterThanOrEqual(hole.radius);
      expect(hole.x).toBeLessThanOrEqual(1280 - hole.radius);
      expect(hole.y).toBeGreaterThanOrEqual(hole.radius);
      expect(hole.y).toBeLessThanOrEqual(720 - hole.radius);
    }
  });

  it('pulls both normal dishes and bombs', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 400,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 250,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const normalDish: MockDish = {
      active: true,
      x: 420,
      y: 360,
      isDangerous: vi.fn(() => false),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    const bombDish: MockDish = {
      active: true,
      x: 460,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(normalDish, bombDish);

    system.update(100, 100);

    expect(normalDish.x).toBeGreaterThan(420);
    expect(bombDish.x).toBeGreaterThan(460);
    expect(normalDish.setBeingPulled).toHaveBeenCalledWith(true);
    expect(bombDish.setBeingPulled).toHaveBeenCalledWith(true);
    expect(bombDish.forceDestroy).not.toHaveBeenCalled();
  });

  it('force destroys bomb when it reaches black hole consume radius', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 250,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const bombDish: MockDish = {
      active: true,
      x: 650,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(bombDish);

    system.update(16, 16);

    expect(bombDish.forceDestroy).toHaveBeenCalledWith(true);
    expect(bombDish.setBeingPulled).not.toHaveBeenCalled();
  });

  it('does not force destroy normal dishes even inside black hole center radius', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 250,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const normalDish: MockDish = {
      active: true,
      x: 650,
      y: 360,
      isDangerous: vi.fn(() => false),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(normalDish);

    system.update(16, 16);

    expect(normalDish.forceDestroy).not.toHaveBeenCalled();
    expect(normalDish.setBeingPulled).toHaveBeenCalledWith(true);
  });

  it('keeps pulling bombs outside center consume radius without destroying immediately', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 250,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const bombDish: MockDish = {
      active: true,
      x: 540,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(bombDish);

    system.update(16, 16);

    expect(bombDish.forceDestroy).not.toHaveBeenCalled();
    expect(bombDish.setBeingPulled).toHaveBeenCalledWith(true);
    expect(bombDish.x).toBeGreaterThan(540);
  });

  it('force destroys bomb when pull moves it into center consume radius in same frame', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 400,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 250,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const bombDish: MockDish = {
      active: true,
      x: 560,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(bombDish);

    system.update(100, 100);

    expect(bombDish.setBeingPulled).toHaveBeenCalledWith(true);
    expect(bombDish.forceDestroy).toHaveBeenCalledWith(true);
  });

  it('grows black hole radius by ratio + flat when bomb is consumed', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 2,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 100,
      bombConsumeRadiusRatio: 1,
      consumeRadiusGrowthRatio: 0.1,
      consumeRadiusGrowthFlat: 5,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const bombDish: MockDish = {
      active: true,
      x: 640,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(() => {
        bombDish.active = false;
      }),
    };
    dishes.push(bombDish);

    system.update(16, 16);

    const holes = system.getBlackHoles();
    expect(holes).toHaveLength(1);
    expect(holes[0].radius).toBeCloseTo(115);
    expect(bombDish.forceDestroy).toHaveBeenCalledWith(true);
    expect(mockEmit).toHaveBeenCalledWith('blackHole:consumed', { x: 640, y: 360 });
  });

  it('increases boss tick damage after bomb consume growth in the same frame', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 10,
      damage: 2,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 120,
      bombConsumeRadiusRatio: 1,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 5,
      consumeDamageGrowth: 1,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);
    bosses = [{ id: 'boss_1', x: 680, y: 360, radius: 40 }];

    const bombDish: MockDish = {
      active: true,
      x: 640,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(() => {
        bombDish.active = false;
      }),
    };
    dishes.push(bombDish);

    system.update(16, 16);

    expect(damageBoss).toHaveBeenCalledTimes(1);
    expect(damageBoss).toHaveBeenCalledWith('boss_1', 3, 640, 360, false);
  });

  it('grows radius and damage when a normal dish is destroyed by black hole tick', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 100,
      damage: 2,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 100,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 5,
      consumeDamageGrowth: 3,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);
    bosses = [{ id: 'boss_1', x: 700, y: 360, radius: 40 }];

    const normalDish: MockDish = {
      active: true,
      x: 640,
      y: 360,
      isDangerous: vi.fn(() => false),
      applyDamageWithUpgrades: vi.fn(() => {
        normalDish.active = false;
      }),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(normalDish);

    system.update(100, 100);

    expect(normalDish.applyDamageWithUpgrades).toHaveBeenCalledWith(2, 0, 0);
    expect(system.getBlackHoles()[0].radius).toBe(105);
    expect(damageBoss).toHaveBeenCalledWith('boss_1', 5, 640, 360, false);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('new spawns have fresh stats while old holes keep grown values', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 1000,
      damage: 2,
      force: 200,
      spawnInterval: 2000,
      duration: 3000,
      spawnCount: 1,
      radius: 100,
      bombConsumeRadiusRatio: 1,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 5,
      consumeDamageGrowth: 3,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween
      .mockReturnValueOnce(640)
      .mockReturnValueOnce(360)
      .mockReturnValueOnce(400)
      .mockReturnValueOnce(200);
    bosses = [];

    const bombDish: MockDish = {
      active: true,
      x: 640,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(() => {
        bombDish.active = false;
      }),
    };
    dishes.push(bombDish);

    system.update(16, 16);
    expect(system.getBlackHoles()[0].radius).toBe(105);

    dishes = [];
    system.update(2000, 2016);

    const holes = system.getBlackHoles();
    expect(holes).toHaveLength(2);

    const grownHole = holes.find((h) => h.radius === 105);
    const freshHole = holes.find((h) => h.radius === 100);
    expect(grownHole).toBeDefined();
    expect(freshHole).toBeDefined();
  });

  it('extends duration when bomb/dish is consumed', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 9999,
      damage: 1,
      force: 200,
      spawnInterval: 9999,
      duration: 500,
      spawnCount: 1,
      radius: 100,
      bombConsumeRadiusRatio: 1,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 600,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);

    const bombDish: MockDish = {
      active: true,
      x: 640,
      y: 360,
      isDangerous: vi.fn(() => true),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(() => {
        bombDish.active = false;
      }),
    };
    dishes.push(bombDish);

    system.update(16, 16);
    expect(system.getBlackHoles()).toHaveLength(1);

    dishes = [];
    system.update(800, 816);
    expect(system.getBlackHoles()).toHaveLength(1);

    system.update(300, 1116);
    expect(system.getBlackHoles()).toHaveLength(0);
  });

  it('applies periodic damage only at damage interval', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 500,
      damage: 2,
      force: 300,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 180,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(600).mockReturnValueOnce(360);

    const normalDish: MockDish = {
      active: true,
      x: 600,
      y: 360,
      isDangerous: vi.fn(() => false),
      applyDamageWithUpgrades: vi.fn(),
      setBeingPulled: vi.fn(),
      forceDestroy: vi.fn(),
    };
    dishes.push(normalDish);

    system.update(16, 16);
    system.update(400, 416);
    expect(normalDish.applyDamageWithUpgrades).not.toHaveBeenCalled();

    system.update(120, 536);
    expect(normalDish.applyDamageWithUpgrades).toHaveBeenCalledTimes(1);
    expect(normalDish.applyDamageWithUpgrades).toHaveBeenCalledWith(2, 0, 0);

    system.update(300, 836);
    expect(normalDish.applyDamageWithUpgrades).toHaveBeenCalledTimes(1);
  });

  it('damages boss when black hole overlaps boss radius', () => {
    blackHoleLevel = 1;
    blackHoleData = {
      damageInterval: 100,
      damage: 3,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 120,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);
    bosses = [{ id: 'boss_1', x: 680, y: 360, radius: 50 }];

    system.update(16, 16);
    system.update(100, 116);

    expect(damageBoss).toHaveBeenCalledTimes(1);
    expect(damageBoss).toHaveBeenCalledWith('boss_1', 3, 640, 360, false);
  });

  it('applies critical multiplier to boss damage tick when critical chance bonus guarantees crit', () => {
    blackHoleLevel = 1;
    criticalChanceBonus = 1;
    blackHoleData = {
      damageInterval: 100,
      damage: 4,
      force: 200,
      spawnInterval: 9999,
      duration: 9999,
      spawnCount: 1,
      radius: 120,
      bombConsumeRadiusRatio: 0.3,
      consumeRadiusGrowthRatio: 0,
      consumeRadiusGrowthFlat: 0,
      consumeDamageGrowth: 0,
      consumeDurationGrowth: 0,
    };
    mockFloatBetween.mockReturnValueOnce(640).mockReturnValueOnce(360);
    bosses = [{ id: 'boss_1', x: 680, y: 360, radius: 50 }];
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.2);

    system.update(16, 16);
    system.update(100, 116);

    expect(damageBoss).toHaveBeenCalledWith('boss_1', 6, 640, 360, true);
    randomSpy.mockRestore();
  });
});
