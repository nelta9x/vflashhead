import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DishLifecycleController } from '../src/scenes/game/DishLifecycleController';

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

const dishDataByType: Record<string, { playerDamage: number; resetCombo: boolean }> = {
  bomb: { playerDamage: 2, resetCombo: true },
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
  const bossGateway = {
    findNearestAliveBoss: vi.fn(),
    cancelChargingLasers: vi.fn(),
  };
  const feedbackSystem = {
    onBombExploded: vi.fn(),
    onDishDestroyed: vi.fn(),
    onDishDamaged: vi.fn(),
    onCriticalHit: vi.fn(),
    onDishMissed: vi.fn(),
    onElectricShock: vi.fn(),
  };

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
      particleManager: {
        createMagnetPullEffect: vi.fn(),
      } as never,
      getPlayerAttackRenderer: () =>
        ({
          showBombWarning: vi.fn(),
        }) as never,
      bossGateway: bossGateway as never,
      isAnyLaserFiring: () => false,
      getCursor: () => ({ x: 100, y: 100 }),
      isGameOver: () => isGameOver,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    isGameOver = false;
  });

  it('handles dangerous dish destruction with penalty and release', () => {
    const controller = createController();
    const bombDish = {
      getDishType: () => 'bomb',
      isDangerous: () => true,
      getColor: () => 0xffffff,
    };

    controller.onDishDestroyed({
      dish: bombDish as never,
      x: 100,
      y: 200,
    });

    expect(healthSystem.takeDamage).toHaveBeenCalledWith(2);
    expect(comboSystem.reset).toHaveBeenCalledTimes(1);
    expect(feedbackSystem.onBombExploded).toHaveBeenCalledWith(100, 200, false);
    expect(dishes.remove).toHaveBeenCalledWith(bombDish);
    expect(dishPool.release).toHaveBeenCalledWith(bombDish);
  });

  it('applies electric shock only to normal dishes within radius', () => {
    const controller = createController({
      upgradeSystem: {
        getElectricShockLevel: () => 1,
        getElectricShockRadius: () => 60,
        getElectricShockDamage: () => 5,
      },
    });

    const sourceDish = {
      getDishType: () => 'basic',
      isDangerous: () => false,
      getColor: () => 0xffffff,
    };
    const nearNormal = {
      active: true,
      x: 110,
      y: 120,
      isDangerous: () => false,
      applyDamage: vi.fn(),
    };
    const nearDangerous = {
      active: true,
      x: 115,
      y: 115,
      isDangerous: () => true,
      applyDamage: vi.fn(),
    };
    const farNormal = {
      active: true,
      x: 500,
      y: 500,
      isDangerous: () => false,
      applyDamage: vi.fn(),
    };

    dishPool.forEach.mockImplementation((callback: (dish: unknown) => void) => {
      callback(sourceDish);
      callback(nearNormal);
      callback(nearDangerous);
      callback(farNormal);
    });

    controller.onDishDestroyed({
      dish: sourceDish as never,
      x: 100,
      y: 100,
      byAbility: false,
    });

    expect(nearNormal.applyDamage).toHaveBeenCalledWith(5, true);
    expect(nearDangerous.applyDamage).not.toHaveBeenCalled();
    expect(farNormal.applyDamage).not.toHaveBeenCalled();
    expect(feedbackSystem.onElectricShock).toHaveBeenCalledWith(100, 100, [{ x: 110, y: 120 }]);
  });

  it('resets pulled state when magnet level is zero', () => {
    const controller = createController({
      upgradeSystem: {
        getMagnetLevel: () => 0,
      },
    });
    const activeDish = {
      active: true,
      setBeingPulled: vi.fn(),
    };

    dishPool.forEach.mockImplementation((callback: (dish: unknown) => void) => {
      callback(activeDish);
    });

    controller.updateMagnetEffect(16, { x: 300, y: 200 });
    expect(activeDish.setBeingPulled).toHaveBeenCalledWith(false);
  });

  it('cancels nearest boss charging lasers on amber critical damage', () => {
    const controller = createController();
    bossGateway.findNearestAliveBoss.mockReturnValue({ id: 'boss_left', x: 300, y: 100 });

    controller.onDishDamaged({
      dish: { getColor: () => 0xffffff } as never,
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

    expect(bossGateway.cancelChargingLasers).toHaveBeenCalledWith('boss_left');
  });
});
