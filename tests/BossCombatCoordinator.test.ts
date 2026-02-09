import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BossCombatCoordinator } from '../src/scenes/game/BossCombatCoordinator';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (min: number, _max: number) => min,
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
      },
    },
  },
}));

vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  CURSOR_HITBOX: { BASE_RADIUS: 24 },
  COLORS: {
    CYAN: 0x00ffff,
    WHITE: 0xffffff,
    YELLOW: 0xffff00,
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    gameConfig: {
      monsterAttack: {
        laser: {
          width: 20,
          warningDuration: 1000,
          fireDuration: 500,
          trajectory: { spawnPadding: 10 },
          bonus: {
            comboAmount: 3,
            invincibilityDuration: 300,
          },
        },
      },
    },
    boss: {
      spawn: { y: 120 },
      depth: 50,
      visual: {
        core: { radius: 20 },
        armor: { radius: 30 },
      },
    },
    dishes: {
      damage: {
        playerDamage: 1,
        criticalChance: 0,
        criticalMultiplier: 2,
        damageInterval: 100,
      },
    },
    t: (key: string) => {
      if (key === 'feedback.interrupted') return 'INTERRUPTED!';
      return key;
    },
  },
}));

vi.mock('../src/entities/Boss', () => ({
  Boss: class {
    public x: number;
    public y: number;
    public scaleX = 1;
    public scaleY = 1;
    public visible = false;
    private readonly id: string;

    public readonly setDepth = vi.fn().mockReturnThis();
    public readonly freeze = vi.fn();
    public readonly unfreeze = vi.fn();
    public readonly update = vi.fn();
    public readonly deactivate = vi.fn(() => {
      this.visible = false;
    });
    public readonly destroy = vi.fn();

    constructor(_scene: unknown, x: number, y: number, id: string) {
      this.x = x;
      this.y = y;
      this.id = id;
    }

    public spawnAt(x: number, y: number): void {
      this.x = x;
      this.y = y;
      this.visible = true;
    }

    public getBossId(): string {
      return this.id;
    }
  },
}));

interface WaveBossConfigStub {
  id: string;
  spawnRange: { minX: number; maxX: number; minY: number; maxY: number };
  laser: { maxCount: number; minInterval: number; maxInterval: number };
}

describe('BossCombatCoordinator', () => {
  let waveBosses: WaveBossConfigStub[];
  let aliveBossIds: Set<string>;
  let currentWave: number;
  let isGameOver = false;
  let isPaused = false;
  let delayedCallbacks: Array<() => void>;

  const laserRenderer = {
    render: vi.fn(),
    clear: vi.fn(),
  };
  const healthSystem = {
    takeDamage: vi.fn(),
  };
  const monsterSystem = {
    isAlive: vi.fn((bossId: string) => aliveBossIds.has(bossId)),
    getAliveBossIds: vi.fn(() => Array.from(aliveBossIds)),
    takeDamage: vi.fn(),
    publishBossHpSnapshot: vi.fn(),
  };

  function createCoordinator(): BossCombatCoordinator {
    delayedCallbacks = [];
    return new BossCombatCoordinator({
      scene: {
        time: {
          delayedCall: vi.fn((_delay: number, cb: () => void) => {
            delayedCallbacks.push(cb);
          }),
        },
        cameras: {
          main: {
            shake: vi.fn(),
          },
        },
      } as never,
      waveSystem: {
        getCurrentWaveBosses: () => waveBosses as never,
        getCurrentWaveBossSpawnMinDistance: () => 100,
        getCurrentWave: () => currentWave,
      } as never,
      monsterSystem: monsterSystem as never,
      feedbackSystem: {
        onBossContactDamaged: vi.fn(),
        onHpLost: vi.fn(),
      } as never,
      soundSystem: {
        playBossChargeSound: vi.fn(),
        playBossFireSound: vi.fn(),
        playBossImpactSound: vi.fn(),
      } as never,
      damageText: {
        showText: vi.fn(),
      } as never,
      laserRenderer: laserRenderer as never,
      healthSystem: healthSystem as never,
      upgradeSystem: {
        getCursorSizeBonus: () => 0,
        getCursorDamageBonus: () => 0,
        getCriticalChanceBonus: () => 0,
      } as never,
      isGameOver: () => isGameOver,
      isPaused: () => isPaused,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    waveBosses = [
      {
        id: 'boss_left',
        spawnRange: { minX: 300, maxX: 320, minY: 100, maxY: 120 },
        laser: { maxCount: 1, minInterval: 0, maxInterval: 0 },
      },
      {
        id: 'boss_right',
        spawnRange: { minX: 900, maxX: 920, minY: 100, maxY: 120 },
        laser: { maxCount: 1, minInterval: 0, maxInterval: 0 },
      },
    ];
    aliveBossIds = new Set(['boss_left', 'boss_right']);
    currentWave = 1;
    isGameOver = false;
    isPaused = false;
    delayedCallbacks = [];
  });

  it('cleans stale bosses, timers, and lasers when syncing a new wave', () => {
    const coordinator = createCoordinator();
    coordinator.syncBossesForCurrentWave();

    const internal = coordinator as unknown as {
      activeLasers: Array<{ bossId: string; isWarning: boolean; isFiring: boolean }>;
      laserNextTimeByBossId: Map<string, number>;
    };

    internal.activeLasers = [
      { bossId: 'boss_left', isWarning: true, isFiring: false },
      { bossId: 'legacy', isWarning: true, isFiring: false },
    ];
    internal.laserNextTimeByBossId.set('boss_left', 1000);
    internal.laserNextTimeByBossId.set('legacy', 1000);

    waveBosses = [
      {
        id: 'boss_right',
        spawnRange: { minX: 900, maxX: 920, minY: 100, maxY: 120 },
        laser: { maxCount: 1, minInterval: 0, maxInterval: 0 },
      },
    ];

    coordinator.syncBossesForCurrentWave();
    coordinator.update(16, 10, { x: 700, y: 400 });

    const snapshots = coordinator.getVisibleBossSnapshots();
    expect(snapshots).toEqual([
      expect.objectContaining({
        id: 'boss_right',
        visible: true,
      }),
    ]);
    expect(internal.activeLasers.some((laser) => laser.bossId === 'legacy')).toBe(false);
    expect(internal.laserNextTimeByBossId.has('legacy')).toBe(false);
  });

  it('cancels only warning lasers of the targeted boss', () => {
    const coordinator = createCoordinator();
    coordinator.syncBossesForCurrentWave();

    const internal = coordinator as unknown as {
      activeLasers: Array<{ bossId: string; isWarning: boolean; isFiring: boolean }>;
      bosses: Map<string, { unfreeze: () => void }>;
      damageText: { showText: (...args: unknown[]) => void };
    };

    internal.activeLasers = [
      { bossId: 'boss_left', isWarning: true, isFiring: false },
      { bossId: 'boss_left', isWarning: false, isFiring: true },
      { bossId: 'boss_right', isWarning: true, isFiring: false },
    ];

    coordinator.cancelChargingLasers('boss_left');

    expect(internal.activeLasers).toEqual([
      { bossId: 'boss_left', isWarning: false, isFiring: true },
      { bossId: 'boss_right', isWarning: true, isFiring: false },
    ]);
    expect(internal.bosses.get('boss_left')?.unfreeze).toHaveBeenCalledTimes(1);
    expect(internal.damageText.showText).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      'INTERRUPTED!',
      expect.any(Number)
    );
  });

  it('removes pending laser when delayed warning callback runs after wave changed', () => {
    waveBosses = [
      {
        id: 'boss_left',
        spawnRange: { minX: 300, maxX: 320, minY: 100, maxY: 120 },
        laser: { maxCount: 1, minInterval: 0, maxInterval: 0 },
      },
    ];
    aliveBossIds = new Set(['boss_left']);

    const coordinator = createCoordinator();
    coordinator.syncBossesForCurrentWave();

    const internal = coordinator as unknown as {
      activeLasers: Array<{ bossId: string; isWarning: boolean; isFiring: boolean }>;
      laserNextTimeByBossId: Map<string, number>;
      bosses: Map<string, { unfreeze: () => void }>;
    };

    internal.laserNextTimeByBossId.set('boss_left', 0);
    coordinator.update(16, 10, { x: 700, y: 400 });
    expect(internal.activeLasers.length).toBe(1);
    expect(delayedCallbacks.length).toBeGreaterThan(0);

    currentWave = 2;
    delayedCallbacks[0]();

    expect(internal.activeLasers.length).toBe(0);
    expect(internal.bosses.get('boss_left')?.unfreeze).toHaveBeenCalled();
    expect(laserRenderer.clear).toHaveBeenCalled();
  });

  it('applies laser hit damage only once within invincibility window', () => {
    const coordinator = createCoordinator();
    const internal = coordinator as unknown as {
      activeLasers: Array<{
        bossId: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        isFiring: boolean;
        isWarning: boolean;
        startTime: number;
      }>;
      checkLaserCollisions: (delta: number, gameTime: number, cursor: { x: number; y: number }) => void;
    };

    internal.activeLasers = [
      {
        bossId: 'boss_left',
        x1: -100,
        y1: 0,
        x2: 100,
        y2: 0,
        isFiring: true,
        isWarning: false,
        startTime: 0,
      },
    ];

    internal.checkLaserCollisions(16, 400, { x: 0, y: 0 });
    internal.checkLaserCollisions(16, 500, { x: 0, y: 0 });

    expect(healthSystem.takeDamage).toHaveBeenCalledTimes(1);
  });
});
