import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BossCombatCoordinator } from '../src/plugins/builtin/services/BossCombatCoordinator';

vi.mock('phaser', () => {
  class MockContainer {
    x = 0;
    y = 0;
    visible = true;
    active = false;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    body: Record<string, unknown> | null = null;
    add() { return this; }
    setVisible(v: boolean) { this.visible = v; return this; }
    setActive(v: boolean) { this.active = v; return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    setDepth() { return this; }
    setScale() { return this; }
    setAlpha() { return this; }
    setInteractive() { return this; }
    disableInteractive() { return this; }
    removeAllListeners() { return this; }
    destroy() {}
  }
  class MockGraphics {
    clear() { return this; }
    fillStyle() { return this; }
    lineStyle() { return this; }
    fillCircle() { return this; }
    strokeCircle() { return this; }
    beginPath() { return this; }
    closePath() { return this; }
    arc() { return this; }
    lineTo() { return this; }
    moveTo() { return this; }
    fillPath() { return this; }
    strokePath() { return this; }
    fillRect() { return this; }
    strokeRect() { return this; }
    setBlendMode() { return this; }
  }
  class MockArc {
    setAlpha() { return this; }
    setScale() { return this; }
    setFillStyle() { return this; }
  }
  return {
    default: {
      Math: {
        Between: (min: number, _max: number) => min,
        Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
        Distance: {
          Between: (x1: number, y1: number, x2: number, y2: number) =>
            Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
        },
        Angle: {
          Between: (_x1: number, _y1: number, _x2: number, _y2: number) => 0,
        },
        DegToRad: (deg: number) => deg * (Math.PI / 180),
        FloatBetween: (min: number, _max: number) => min,
      },
      GameObjects: {
        Container: MockContainer,
        Graphics: MockGraphics,
        Arc: MockArc,
      },
      Physics: {
        Arcade: {
          Body: class { enable = true; setCircle() {} setOffset() {} setVelocity() {} },
        },
      },
      Geom: {
        Circle: class { constructor() {} static Contains() { return false; } },
      },
      BlendModes: { ADD: 1 },
      Display: {
        Color: { HexStringToColor: () => ({ color: 0xffffff }) },
      },
    },
  };
});

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
      depths: { laser: 100 },
    },
    bossAttacks: {
      bulletSpread: {
        warningDuration: 1000, projectileCount: 8, projectileSpeed: 280,
        projectileSize: 6, spreadAngleDeg: 360, projectileLifetime: 3000,
        damage: 1, hitboxRadius: 8, invincibilityDuration: 300,
        warningColor: '#ff4444', projectileColor: '#ff4444', projectileCoreColor: '#ffffff',
      },
      dangerZone: {
        warningDuration: 1200, zoneCount: { min: 2, max: 3 }, zoneRadius: { min: 80, max: 120 },
        explosionDuration: 300, damage: 1, invincibilityDuration: 300, spawnPadding: 60,
        warningColor: '#ff2244', explosionColor: '#ff4444', explosionCoreColor: '#ffffff',
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

vi.mock('../src/entities/Entity', () => ({
  Entity: class {
    public x = 0;
    public y = 0;
    public scaleX = 1;
    public scaleY = 1;
    public visible = false;
    public active = false;
    private id = '';

    public readonly setDepth = vi.fn().mockReturnThis();
    public readonly destroy = vi.fn();
    public readonly setVisible = vi.fn();
    public readonly setActive = vi.fn();
    public readonly disableInteractive = vi.fn();
    public readonly removeAllListeners = vi.fn();
    public readonly getGraphics = vi.fn(() => ({}));
    public body = null;

    constructor(_scene?: unknown) {}

    public setEntityId(entityId: string): void {
      this.id = entityId;
    }

    public getEntityId(): string {
      return this.id;
    }

    public reset(): void {
      this.visible = true;
      this.active = true;
    }
  },
}));

vi.mock('../src/entities/EntitySpawnInitializer', () => ({
  initializeEntitySpawn: vi.fn(
    (entity: { x: number; y: number; visible: boolean; active: boolean }, _world: unknown, _config: unknown, _plugin: unknown, x: number, y: number) => {
      entity.x = x;
      entity.y = y;
      entity.visible = true;
      entity.active = true;
    }
  ),
  setSpawnDamageServiceGetter: vi.fn(),
}));

vi.mock('../src/entities/EntityLifecycle', () => ({
  deactivateEntity: vi.fn(
    (entity: { visible: boolean; active: boolean }) => {
      entity.visible = false;
      entity.active = false;
    }
  ),
}));

vi.mock('../src/plugins/PluginRegistry', () => ({
  PluginRegistry: {
    getInstance: () => ({
      getEntityType: () => ({
        typeId: 'gatekeeper_spaceship',
        config: { spawnCategory: 'pooled', poolSize: 0, defaultLifetime: null, isGatekeeper: true, cursorInteraction: 'contact' },
        createMovementData: () => ({ type: 'none', homeX: 0, homeY: 0, movementTime: 0, drift: null }),
      }),
    }),
  },
}));

interface WaveBossConfigStub {
  id: string;
  entityTypeId: string;
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
    getMaxHp: vi.fn(() => 100),
  };

  function createCoordinator(): BossCombatCoordinator {
    delayedCallbacks = [];
    return new BossCombatCoordinator({
      scene: {
        add: {
          existing: vi.fn(),
          graphics: vi.fn(() => ({
            clear: vi.fn().mockReturnThis(),
            fillStyle: vi.fn().mockReturnThis(),
            lineStyle: vi.fn().mockReturnThis(),
            fillCircle: vi.fn().mockReturnThis(),
            strokeCircle: vi.fn().mockReturnThis(),
            fillRoundedRect: vi.fn().mockReturnThis(),
            strokeRoundedRect: vi.fn().mockReturnThis(),
            fillRect: vi.fn().mockReturnThis(),
            strokeRect: vi.fn().mockReturnThis(),
            beginPath: vi.fn().mockReturnThis(),
            closePath: vi.fn().mockReturnThis(),
            arc: vi.fn().mockReturnThis(),
            lineTo: vi.fn().mockReturnThis(),
            moveTo: vi.fn().mockReturnThis(),
            fillPath: vi.fn().mockReturnThis(),
            strokePath: vi.fn().mockReturnThis(),
            setBlendMode: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          arc: vi.fn(() => ({
            setAlpha: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            setFillStyle: vi.fn().mockReturnThis(),
          })),
        },
        physics: {
          add: {
            existing: vi.fn((obj: Record<string, unknown>) => {
              obj.body = {
                enable: true,
                setCircle: vi.fn(),
                setOffset: vi.fn(),
                setVelocity: vi.fn(),
              };
            }),
          },
        },
        time: {
          delayedCall: vi.fn((_delay: number, cb: () => void) => {
            delayedCallbacks.push(cb);
          }),
        },
        tweens: {
          add: vi.fn(() => ({
            stop: vi.fn(),
            remove: vi.fn(),
          })),
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
      abilityRuntimeQuery: {
        getEffectValueOrThrow: () => 0,
      } as never,
      damageService: { freeze: vi.fn(), unfreeze: vi.fn() } as never,
      world: {
        bossState: { get: vi.fn(() => null) },
        phaserNode: { get: vi.fn(() => null) },
        destroyEntity: vi.fn(),
      } as never,
      statusEffectManager: { clearEntity: vi.fn() } as never,
      gameEnv: { get isGameOver() { return isGameOver; }, get isPaused() { return isPaused; }, getCursorPosition: () => ({ x: 0, y: 0 }) } as never,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    waveBosses = [
      {
        id: 'boss_left',
        entityTypeId: 'gatekeeper_spaceship',
        spawnRange: { minX: 300, maxX: 320, minY: 100, maxY: 120 },
        laser: { maxCount: 1, minInterval: 0, maxInterval: 0 },
      },
      {
        id: 'boss_right',
        entityTypeId: 'gatekeeper_spaceship',
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
        entityTypeId: 'gatekeeper_spaceship',
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
        entityTypeId: 'gatekeeper_spaceship',
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
        entityTypeId: 'gatekeeper_spaceship',
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
