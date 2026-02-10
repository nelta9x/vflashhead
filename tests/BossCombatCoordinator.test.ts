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
          fallbackCooldown: 5000,
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
  const feedbackSystem = {
    onBossContactDamaged: vi.fn(),
    onHpLost: vi.fn(),
  };
  const soundSystem = {
    playBossChargeSound: vi.fn(),
    playBossFireSound: vi.fn(),
    playBossImpactSound: vi.fn(),
  };
  const damageText = {
    showText: vi.fn(),
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
      feedbackSystem: feedbackSystem as never,
      soundSystem: soundSystem as never,
      damageText: damageText as never,
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

    // Trigger lasers for both bosses by calling update (laserNextTime set to 0 by sync)
    // The cursor is far enough from bosses to produce valid laser direction
    coordinator.update(16, 10, { x: 700, y: 400 });

    // Both bosses should have spawned lasers (warning phase)
    expect(soundSystem.playBossChargeSound).toHaveBeenCalledTimes(2);
    expect(laserRenderer.render).toHaveBeenCalled();

    // Now re-sync with only boss_right remaining in the wave config
    waveBosses = [
      {
        id: 'boss_right',
        spawnRange: { minX: 900, maxX: 920, minY: 100, maxY: 120 },
        laser: { maxCount: 1, minInterval: 0, maxInterval: 0 },
      },
    ];

    coordinator.syncBossesForCurrentWave();
    vi.clearAllMocks();
    coordinator.update(16, 20, { x: 700, y: 400 });

    // Only boss_right should be visible after sync
    const snapshots = coordinator.getVisibleBossSnapshots();
    expect(snapshots).toEqual([
      expect.objectContaining({
        id: 'boss_right',
        visible: true,
      }),
    ]);

    // laserRenderer.render should only receive lasers for boss_right (stale boss_left lasers cleaned)
    const lastRenderCall = laserRenderer.render.mock.calls[laserRenderer.render.mock.calls.length - 1];
    const renderedLasers = lastRenderCall[0] as Array<{ bossId: string }>;
    const hasLegacyLaser = renderedLasers.some((laser) => laser.bossId === 'boss_left');
    expect(hasLegacyLaser).toBe(false);
  });

  it('cancels only warning lasers of the targeted boss', () => {
    const coordinator = createCoordinator();
    coordinator.syncBossesForCurrentWave();

    // Trigger lasers for both bosses
    coordinator.update(16, 10, { x: 700, y: 400 });

    // Both bosses should have warning lasers
    expect(soundSystem.playBossChargeSound).toHaveBeenCalledTimes(2);

    // Promote boss_left's laser to firing by executing its warning callback
    delayedCallbacks[0]();
    expect(soundSystem.playBossFireSound).toHaveBeenCalledTimes(1);

    // Now we have: boss_left with 1 firing laser, boss_right with 1 warning laser
    // Also boss_left now has a second delayed callback (fire duration end)

    // Cancel charging lasers for boss_right (the one still in warning)
    coordinator.cancelChargingLasers('boss_right');

    // The boss_right warning laser should be cancelled -> unfreeze + interrupted text
    expect(damageText.showText).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      'INTERRUPTED!',
      expect.any(Number)
    );

    // boss_left's firing laser should still be active
    expect(coordinator.isAnyLaserFiring()).toBe(true);

    // Now cancel charging lasers for boss_left (which only has a firing laser, not warning)
    vi.clearAllMocks();
    coordinator.cancelChargingLasers('boss_left');

    // No warning lasers to cancel for boss_left, so no interrupted text
    expect(damageText.showText).not.toHaveBeenCalled();
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

    // Trigger a laser for boss_left
    coordinator.update(16, 10, { x: 700, y: 400 });
    expect(soundSystem.playBossChargeSound).toHaveBeenCalledTimes(1);
    expect(delayedCallbacks.length).toBeGreaterThan(0);

    // Change wave before the delayed callback fires
    currentWave = 2;
    delayedCallbacks[0]();

    // The laser should have been cleaned up: no firing state
    expect(coordinator.isAnyLaserFiring()).toBe(false);

    // Boss should be unfrozen after stale laser removal
    const snapshots = coordinator.getVisibleBossSnapshots();
    const bossSnapshot = snapshots.find((s) => s.id === 'boss_left');
    expect(bossSnapshot).toBeDefined();

    // laserRenderer.clear should have been called to clean up
    expect(laserRenderer.clear).toHaveBeenCalled();
  });

  it('applies laser hit damage only once within invincibility window', () => {
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

    // Trigger a laser for boss_left - cursor needs to be far enough for valid direction
    // but the laser will be aimed at cursor position
    const cursorOnLaserPath = { x: 700, y: 400 };
    coordinator.update(16, 10, cursorOnLaserPath);
    expect(soundSystem.playBossChargeSound).toHaveBeenCalledTimes(1);

    // Promote the warning laser to firing
    delayedCallbacks[0]();
    expect(soundSystem.playBossFireSound).toHaveBeenCalledTimes(1);
    expect(coordinator.isAnyLaserFiring()).toBe(true);

    // Now update with cursor on the laser path - the laser goes from boss position toward (700,400)
    // Boss is at ~(300, 100), laser aimed at cursor. The cursor is on that line.
    // First hit should deal damage
    coordinator.update(16, 400, cursorOnLaserPath);
    expect(healthSystem.takeDamage).toHaveBeenCalledTimes(1);

    // Second hit within invincibility window (300ms) should NOT deal damage
    coordinator.update(16, 500, cursorOnLaserPath);
    expect(healthSystem.takeDamage).toHaveBeenCalledTimes(1);
  });
});
