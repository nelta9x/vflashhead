import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DishLifecycleController } from '../src/scenes/game/DishLifecycleController';
import type { EntitySnapshot } from '../src/entities/EntitySnapshot';

vi.mock('phaser', () => ({
  default: {
    Math: {
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
  CURSOR_HITBOX: { BASE_RADIUS: 24 },
  MAGNET: { MIN_PULL_DISTANCE: 5 },
  COLORS: {
    CYAN: 0x00ffff,
    YELLOW: 0xffff00,
  },
}));

const dishDataByType: Record<string, { playerDamage: number; resetCombo: boolean; bombWarning?: { duration: number; radius: number; blinkInterval: number } }> = {
  bomb: { playerDamage: 2, resetCombo: true, bombWarning: { duration: 500, radius: 50, blinkInterval: 100 } },
  basic: { playerDamage: 1, resetCombo: false },
  amber: { playerDamage: 1, resetCombo: false },
};

vi.mock('../src/data/DataManager', () => ({
  Data: {
    getDishData: (type: string) => dishDataByType[type] ?? null,
    gameConfig: {
      monsterAttack: {
        laser: {
          bonus: { comboAmount: 3 },
        },
      },
    },
    t: (key: string) => {
      if (key === 'feedback.bomb_removed') return 'REMOVED!';
      if (key === 'feedback.laser_bonus') return 'LASER BONUS!';
      return key;
    },
  },
}));

function makeSnapshot(overrides: Partial<EntitySnapshot> = {}): EntitySnapshot {
  return {
    entityId: 1,
    x: 100,
    y: 200,
    entityType: 'basic',
    dangerous: false,
    color: 0xffffff,
    size: 30,
    currentHp: 10,
    maxHp: 10,
    hpRatio: 1,
    ...overrides,
  };
}

describe('DishLifecycleController', () => {
  let isGameOver = false;
  const healthSystem = {
    takeDamage: vi.fn(),
  };
  const comboSystem = {
    increment: vi.fn(),
    reset: vi.fn(),
    getCombo: vi.fn(() => 7),
  };
  const dishPool = {
    forEach: vi.fn(),
    acquire: vi.fn(),
    release: vi.fn(),
  };
  const dishes = {
    add: vi.fn(),
    remove: vi.fn(),
  };
  const feedbackSystem = {
    onBombExploded: vi.fn(),
    onDishDestroyed: vi.fn(),
    onDishDamaged: vi.fn(),
    onCriticalHit: vi.fn(),
    onDishMissed: vi.fn(),
    onElectricShock: vi.fn(),
  };
  const showBombWarning = vi.fn();
  const damageService = {
    applyUpgradeDamage: vi.fn(),
    setBeingPulled: vi.fn(),
  };

  // World store mocks — supports phaserNode, dishProps, dishTag, transform, and query()
  const phaserNodeStore = new Map<number, { container: unknown }>();
  const dishPropsStore = new Map<number, { dangerous: boolean }>();
  const dishTagStore = new Map<number, Record<string, never>>();
  const transformStore = new Map<number, { x: number; y: number }>();
  const activeEntities = new Set<number>();

  const world = {
    phaserNode: {
      get: (id: number) => phaserNodeStore.get(id),
    },
    dishProps: {
      get: (id: number) => dishPropsStore.get(id),
      has: (id: number) => dishPropsStore.has(id),
      size: () => dishPropsStore.size,
      entries: () => dishPropsStore.entries(),
    },
    dishTag: {
      get: (id: number) => dishTagStore.get(id),
      has: (id: number) => dishTagStore.has(id),
      size: () => dishTagStore.size,
      entries: () => dishTagStore.entries(),
    },
    transform: {
      get: (id: number) => transformStore.get(id),
      has: (id: number) => transformStore.has(id),
      size: () => transformStore.size,
      entries: () => transformStore.entries(),
    },
    isActive: (id: number) => activeEntities.has(id),
    query: vi.fn(function () {
      return (function* () {
        for (const [entityId] of dishTagStore) {
          if (!activeEntities.has(entityId)) continue;
          const dp = dishPropsStore.get(entityId);
          const t = transformStore.get(entityId);
          if (!dp || !t) continue;
          yield [entityId, dishTagStore.get(entityId), dp, t];
        }
      })();
    }),
  };

  /** Add a dish entity to the World stores for query-based iteration */
  function addDishToWorld(id: number, x: number, y: number, dangerous: boolean): void {
    activeEntities.add(id);
    dishTagStore.set(id, {} as Record<string, never>);
    dishPropsStore.set(id, { dangerous });
    transformStore.set(id, { x, y });
  }

  function createController(overrides?: {
    upgradeSystem?: Partial<{
      getElectricShockLevel: () => number;
      getElectricShockRadius: () => number;
      getElectricShockDamage: () => number;
      getCursorSizeBonus: () => number;
      getCursorDamageBonus: () => number;
      getCriticalChanceBonus: () => number;
      getMagnetLevel: () => number;
      getMagnetRadius: () => number;
      getMagnetForce: () => number;
    }>;
  }): DishLifecycleController {
    const defaultUpgradeSystem = {
      getElectricShockLevel: () => 0,
      getElectricShockRadius: () => 50,
      getElectricShockDamage: () => 2,
      getCursorSizeBonus: () => 0,
      getCursorDamageBonus: () => 0,
      getCriticalChanceBonus: () => 0,
      getMagnetLevel: () => 0,
      getMagnetRadius: () => 100,
      getMagnetForce: () => 100,
    };

    return new DishLifecycleController({
      world: world as never,
      dishPool: dishPool as never,
      dishes: dishes as never,
      healthSystem: healthSystem as never,
      comboSystem: comboSystem as never,
      upgradeSystem: { ...defaultUpgradeSystem, ...overrides?.upgradeSystem } as never,
      feedbackSystem: feedbackSystem as never,
      soundSystem: {
        playBossImpactSound: vi.fn(),
      } as never,
      damageText: {
        showText: vi.fn(),
      } as never,
      damageService: damageService as never,
      getPlayerAttackRenderer: () =>
        ({
          showBombWarning,
        }) as never,
      isAnyLaserFiring: () => false,
      isGameOver: () => isGameOver,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    isGameOver = false;
    phaserNodeStore.clear();
    dishPropsStore.clear();
    dishTagStore.clear();
    transformStore.clear();
    activeEntities.clear();
  });

  it('handles dangerous dish destruction with penalty and release', () => {
    const controller = createController();
    const bombEntity = { getDishType: () => 'bomb' };
    phaserNodeStore.set(10, { container: bombEntity });

    controller.onDishDestroyed({
      snapshot: makeSnapshot({ entityId: 10, entityType: 'bomb', dangerous: true }),
      x: 100,
      y: 200,
    });

    expect(healthSystem.takeDamage).toHaveBeenCalledWith(2);
    expect(comboSystem.reset).toHaveBeenCalledTimes(1);
    expect(feedbackSystem.onBombExploded).toHaveBeenCalledWith(100, 200, false);
    expect(dishes.remove).toHaveBeenCalledWith(bombEntity);
    expect(dishPool.release).toHaveBeenCalledWith(bombEntity);
  });

  it('applies electric shock only to normal dishes within radius on cursor hit', () => {
    const controller = createController({
      upgradeSystem: {
        getElectricShockLevel: () => 1,
        getElectricShockRadius: () => 60,
        getElectricShockDamage: () => 5,
      },
    });

    // Set up entities in the World stores for query-based iteration
    addDishToWorld(100, 100, 100, false);
    addDishToWorld(101, 110, 120, false);
    addDishToWorld(102, 115, 115, true);
    addDishToWorld(103, 500, 500, false);

    controller.onDishDamaged({
      snapshot: makeSnapshot({ entityId: 100, entityType: 'basic' }),
      x: 100,
      y: 100,
      type: 'basic',
      damage: 10,
      currentHp: 5,
      maxHp: 10,
      hpRatio: 0.5,
      isFirstHit: false,
      byAbility: false,
    });

    expect(damageService.applyUpgradeDamage).toHaveBeenCalledWith(101, 5, 0, 0);
    expect(damageService.applyUpgradeDamage).not.toHaveBeenCalledWith(102, expect.anything(), expect.anything(), expect.anything());
    expect(damageService.applyUpgradeDamage).not.toHaveBeenCalledWith(103, expect.anything(), expect.anything(), expect.anything());
    expect(feedbackSystem.onElectricShock).toHaveBeenCalledWith(100, 100, [{ x: 110, y: 120 }]);
  });

  it('does not trigger electric shock for ability-sourced damage', () => {
    const controller = createController({
      upgradeSystem: {
        getElectricShockLevel: () => 1,
        getElectricShockRadius: () => 60,
        getElectricShockDamage: () => 5,
      },
    });

    controller.onDishDamaged({
      snapshot: makeSnapshot({ entityId: 200, entityType: 'basic' }),
      x: 100,
      y: 100,
      type: 'basic',
      damage: 4,
      currentHp: 6,
      maxHp: 10,
      hpRatio: 0.6,
      isFirstHit: false,
      byAbility: true,
    });

    expect(damageService.applyUpgradeDamage).not.toHaveBeenCalled();
    expect(feedbackSystem.onElectricShock).not.toHaveBeenCalled();
  });

  it('triggers electric shock on every direct hit tick', () => {
    const controller = createController({
      upgradeSystem: {
        getElectricShockLevel: () => 1,
        getElectricShockRadius: () => 60,
        getElectricShockDamage: () => 5,
      },
    });

    // Set up entities in the World stores for query-based iteration
    addDishToWorld(300, 100, 100, false);
    addDishToWorld(301, 110, 120, false);

    const snap = makeSnapshot({ entityId: 300, entityType: 'basic' });
    controller.onDishDamaged({
      snapshot: snap, x: 100, y: 100, type: 'basic',
      damage: 3, currentHp: 7, maxHp: 10, hpRatio: 0.7, isFirstHit: false, byAbility: false,
    });
    controller.onDishDamaged({
      snapshot: snap, x: 100, y: 100, type: 'basic',
      damage: 3, currentHp: 4, maxHp: 10, hpRatio: 0.4, isFirstHit: false, byAbility: false,
    });

    expect(damageService.applyUpgradeDamage).toHaveBeenCalledTimes(2);
    expect(feedbackSystem.onElectricShock).toHaveBeenCalledTimes(2);
  });

  it('does not trigger electric shock on dish destroyed events', () => {
    const controller = createController({
      upgradeSystem: {
        getElectricShockLevel: () => 1,
        getElectricShockRadius: () => 60,
        getElectricShockDamage: () => 5,
      },
    });

    phaserNodeStore.set(1, { container: {} });

    controller.onDishDestroyed({
      snapshot: makeSnapshot({ entityId: 1, entityType: 'basic' }),
      x: 100,
      y: 100,
      byAbility: false,
    });

    expect(feedbackSystem.onElectricShock).not.toHaveBeenCalled();
  });

  it('calls onCriticalHit and returns on critical damage (no laser cancel)', () => {
    const controller = createController();

    controller.onDishDamaged({
      snapshot: makeSnapshot({ entityId: 1, entityType: 'amber', color: 0xffffff }),
      x: 100,
      y: 100,
      type: 'amber',
      damage: 10,
      currentHp: 1,
      maxHp: 2,
      hpRatio: 0.5,
      isFirstHit: false,
      isCritical: true,
    });

    expect(feedbackSystem.onCriticalHit).toHaveBeenCalledWith(100, 100, 10, 7);
    // Should not call onDishDamaged (returns early)
    expect(feedbackSystem.onDishDamaged).not.toHaveBeenCalled();
  });

  it('skips bomb spawn when warning callback resolves after game over', () => {
    const controller = createController();
    const warningCallbackRef: { current: (() => void) | null } = { current: null };
    showBombWarning.mockImplementation(
      (
        _x: number,
        _y: number,
        _config: { duration: number; radius: number; blinkInterval: number },
        onComplete: () => void
      ) => {
        warningCallbackRef.current = onComplete;
      }
    );

    controller.spawnDish('bomb', 120, 140, 1);
    isGameOver = true;
    warningCallbackRef.current?.();

    expect(dishPool.acquire).not.toHaveBeenCalled();
    expect(dishes.add).not.toHaveBeenCalled();
  });
});
