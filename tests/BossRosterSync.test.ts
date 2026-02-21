import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BossRosterSync } from '../src/plugins/builtin/services/boss/BossRosterSync';

const { mockInitializeEntitySpawn, mockGetEntityType } = vi.hoisted(() => ({
  mockInitializeEntitySpawn: vi.fn(),
  mockGetEntityType: vi.fn(),
}));

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (min: number, _max: number) => min,
      Distance: {
        Between: () => 9999,
      },
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    },
  },
}));

vi.mock('../src/entities/Entity', () => ({
  Entity: class {
    active = false;
    visible = false;
    x = 0;
    y = 0;
    private entityId = '';

    constructor(_scene?: unknown) {}

    setEntityId(id: string): void {
      this.entityId = id;
    }

    getEntityId(): string {
      return this.entityId;
    }
  },
}));

vi.mock('../src/entities/EntitySpawnInitializer', () => ({
  initializeEntitySpawn: mockInitializeEntitySpawn,
}));

vi.mock('../src/entities/EntityLifecycle', () => ({
  deactivateEntity: vi.fn(),
}));

vi.mock('../src/plugins/PluginRegistry', () => ({
  PluginRegistry: {
    getInstance: () => ({
      getEntityType: mockGetEntityType,
    }),
  },
}));

describe('BossRosterSync', () => {
  const createBossConfig = (id: string, entityTypeId: string) => ({
    id,
    entityTypeId,
    hpWeight: 1,
    spawnRange: { minX: 100, maxX: 100, minY: 80, maxY: 80 },
    laser: { maxCount: 1, minInterval: 1000, maxInterval: 1000 },
  });

  const createSync = (bossConfigs: ReturnType<typeof createBossConfig>[]) => {
    const bosses = new Map();
    const laserNextTimeByBossId = new Map<string, number>();
    const bossOverlapLastHitTimeByBossId = new Map<string, number>();

    const waveSystem = {
      getCurrentWaveBosses: () => bossConfigs,
      getCurrentWaveBossSpawnMinDistance: () => 100,
    };

    const monsterSystem = {
      getMaxHp: vi.fn(() => 100),
      publishBossHpSnapshot: vi.fn(),
    };

    const laserRenderer = {
      clear: vi.fn(),
    };

    const sync = new BossRosterSync({
      scene: {} as never,
      waveSystem: waveSystem as never,
      monsterSystem: monsterSystem as never,
      laserRenderer: laserRenderer as never,
      bosses,
      laserNextTimeByBossId,
      bossOverlapLastHitTimeByBossId,
      getActiveLasers: () => [],
      setActiveLasers: vi.fn(),
      setNextLaserTime: vi.fn(),
      getCurrentGameTime: () => 0,
      damageService: { unfreeze: vi.fn() } as never,
      world: {} as never,
      statusEffectManager: {} as never,
      initBossAttackTimers: vi.fn(),
    });

    return { sync, monsterSystem };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('looks up plugins by each boss entityTypeId and spawns with matching entityType', () => {
    mockGetEntityType.mockImplementation((typeId: string) => ({ typeId }));
    const bossConfigs = [
      createBossConfig('boss_left', 'gatekeeper_spaceship'),
      createBossConfig('boss_right', 'gatekeeper_spaceship'),
    ];
    const { sync, monsterSystem } = createSync(bossConfigs);

    sync.syncBossesForCurrentWave();

    expect(mockGetEntityType).toHaveBeenCalledWith('gatekeeper_spaceship');
    expect(mockInitializeEntitySpawn).toHaveBeenCalledTimes(2);
    expect(mockInitializeEntitySpawn.mock.calls[0][2]).toEqual(
      expect.objectContaining({ entityType: 'gatekeeper_spaceship', bossDataId: 'boss_left' })
    );
    expect(mockInitializeEntitySpawn.mock.calls[1][2]).toEqual(
      expect.objectContaining({ entityType: 'gatekeeper_spaceship', bossDataId: 'boss_right' })
    );
    expect(monsterSystem.publishBossHpSnapshot).toHaveBeenCalledWith('boss_left');
    expect(monsterSystem.publishBossHpSnapshot).toHaveBeenCalledWith('boss_right');
  });

  it('throws immediately when boss entityType plugin is missing', () => {
    mockGetEntityType.mockReturnValue(undefined);
    const { sync } = createSync([createBossConfig('boss_center', 'boss_missing')]);

    expect(() => sync.syncBossesForCurrentWave()).toThrow(
      'Missing boss entity plugin for boss "boss_center" (entityTypeId="boss_missing")'
    );
    expect(mockInitializeEntitySpawn).not.toHaveBeenCalled();
  });
});
