import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerAttackController } from '../src/scenes/game/PlayerAttackController';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (min: number, _max: number) => min,
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
      },
    },
    Display: {
      Color: {
        HexStringToColor: () => ({ color: 0xffffff }),
      },
    },
  },
}));

vi.mock('../src/data/constants', () => ({
  CURSOR_HITBOX: { BASE_RADIUS: 24 },
  COLORS: {
    YELLOW: 0xffff00,
    WHITE: 0xffffff,
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    feedback: {
      bossAttack: {
        mainColor: '#ffffff',
        accentColor: '#00ffff',
        innerTrailColor: '#00ffff',
        charge: {
          duration: 100,
        },
        fire: {
          missileInterval: 0,
          duration: 100,
          trackingOffset: { x: 10, y: 10 },
          preFireGlow: { color: '#ffffff' },
          trailWidthMultiplier: 1,
          trailAlpha: 1,
          trailLifespan: 100,
        },
        impact: {
          shakeDuration: 100,
          shakeIntensity: 0.01,
        },
      },
    },
    gameConfig: {
      playerAttack: {
        baseMissileCount: 1,
        baseMissileDamage: 20,
        criticalChance: 1,
        criticalMultiplier: 2,
      },
    },
  },
}));

describe('PlayerAttackController', () => {
  let wave = 10;
  let isGameOver = false;

  const monsterSystem = {
    takeDamage: vi.fn(),
  };
  const bossGateway = {
    findNearestAliveBoss: vi.fn(),
    getAliveBossTarget: vi.fn(),
    cancelChargingLasers: vi.fn(),
  };
  const dishPool = {
    forEach: vi.fn(),
  };

  function createController(): PlayerAttackController {
    return new PlayerAttackController({
      scene: {
        tweens: {
          add: vi.fn((config: { onUpdate?: (...args: unknown[]) => void; onComplete?: () => void }) => {
            config.onUpdate?.({}, { progress: 1 });
            config.onComplete?.();
          }),
        },
        time: {
          delayedCall: vi.fn((_delay: number, cb: () => void) => cb()),
        },
        cameras: {
          main: {
            shake: vi.fn(),
          },
        },
      } as never,
      upgradeSystem: {
        getMissileLevel: () => 0,
        getMissileCount: () => 1,
        getMissileDamage: () => 20,
        getCriticalChanceBonus: () => 0,
        getCursorMissileThicknessBonus: () => 0,
        getCursorSizeBonus: () => 0,
      } as never,
      waveSystem: {
        getCurrentWave: () => wave,
      } as never,
      monsterSystem: monsterSystem as never,
      feedbackSystem: {
        onBossDamaged: vi.fn(),
      } as never,
      soundSystem: {
        playBossFireSound: vi.fn(),
        playPlayerChargeSound: vi.fn(),
        playHitSound: vi.fn(),
      } as never,
      particleManager: {
        createSparkBurst: vi.fn(),
        createHitEffect: vi.fn(),
      } as never,
      dishPool: dishPool as never,
      getCursor: () => ({ x: 100, y: 100 }),
      getPlayerAttackRenderer: () =>
        ({
          createChargeVisual: () => ({
            update: vi.fn(),
            destroy: vi.fn(),
          }),
          showPreFireCursorGlow: vi.fn(),
          createMissile: (x: number, y: number) => ({
            x,
            y,
            displayWidth: 10,
          }),
          spawnMissileTrail: vi.fn(),
          destroyProjectile: vi.fn(),
        }) as never,
      bossGateway: bossGateway as never,
      isGameOver: () => isGameOver,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    wave = 10;
    isGameOver = false;
  });

  it('retargets missile to nearest alive boss when initial target is dead', () => {
    const controller = createController();

    // findNearestAliveBoss returns boss_left initially (during performPlayerAttack charge),
    // but getAliveBossTarget('boss_left') returns null during missile tween,
    // so retargeting via findNearestAliveBoss returns boss_right
    let findCallCount = 0;
    bossGateway.findNearestAliveBoss.mockImplementation(() => {
      findCallCount++;
      // First call: during performPlayerAttack to pick initial target
      if (findCallCount === 1) {
        return { id: 'boss_left', x: 300, y: 100 };
      }
      // Subsequent calls: retarget to boss_right
      return { id: 'boss_right', x: 500, y: 100 };
    });
    bossGateway.getAliveBossTarget.mockImplementation((bossId: string) => {
      // boss_left is dead during missile flight
      if (bossId === 'boss_left') return null;
      if (bossId === 'boss_right') return { id: 'boss_right', x: 500, y: 100 };
      return null;
    });

    controller.performPlayerAttack();

    expect(monsterSystem.takeDamage).toHaveBeenCalledWith(
      'boss_right',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('cancels charging lasers when missile hit is critical', () => {
    const controller = createController();

    bossGateway.getAliveBossTarget.mockReturnValue({ id: 'boss_left', x: 300, y: 120 });
    bossGateway.findNearestAliveBoss.mockReturnValue({ id: 'boss_left', x: 300, y: 120 });

    controller.performPlayerAttack();

    expect(bossGateway.cancelChargingLasers).toHaveBeenCalledWith('boss_left');
  });

  it('destroys dishes along missile path except not-fully-spawned dangerous dishes', () => {
    const controller = createController();

    // Boss at (200, 200) — missile starts near cursor (100,100) with offsets applied by Between(min)
    // Between returns min, so offsets are negative. Place dishes on the missile path
    // with generous getSize() to ensure they are within collision radius.
    bossGateway.getAliveBossTarget.mockReturnValue({ id: 'boss_a', x: 200, y: 200 });
    bossGateway.findNearestAliveBoss.mockReturnValue({ id: 'boss_a', x: 200, y: 200 });

    const dangerousNotSpawned = {
      active: true,
      x: 100,
      y: 100,
      getSize: () => 80,
      isDangerous: () => true,
      isFullySpawned: () => false,
      forceDestroy: vi.fn(),
    };
    const dangerousSpawned = {
      active: true,
      x: 100,
      y: 100,
      getSize: () => 80,
      isDangerous: () => true,
      isFullySpawned: () => true,
      forceDestroy: vi.fn(),
    };
    const normalDish = {
      active: true,
      x: 100,
      y: 100,
      getSize: () => 80,
      isDangerous: () => false,
      isFullySpawned: () => true,
      forceDestroy: vi.fn(),
    };

    dishPool.forEach.mockImplementation((callback: (dish: unknown) => void) => {
      callback(dangerousNotSpawned);
      callback(dangerousSpawned);
      callback(normalDish);
    });

    controller.performPlayerAttack();

    expect(dangerousNotSpawned.forceDestroy).not.toHaveBeenCalled();
    expect(dangerousSpawned.forceDestroy).toHaveBeenCalledWith(true);
    expect(normalDish.forceDestroy).toHaveBeenCalledWith(false);
  });
});
