import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonsterSystem } from '../src/systems/MonsterSystem';
import { GameEvents } from '../src/utils/EventBus';

const mockEmit = vi.fn();
const mockOn = vi.fn();

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
      on: mockOn,
      off: vi.fn(),
    }),
  },
  GameEvents: {
    WAVE_STARTED: 'wave_started',
    MONSTER_DIED: 'monster_died',
    MONSTER_HP_CHANGED: 'monster_hp_changed',
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    gameConfig: {
      screen: { width: 1280, height: 720 },
    },
    boss: {
      spawn: { y: 100 },
    },
    spawn: {
      minBossDistance: 150,
    },
    waves: {
      waves: [
        {
          bossTotalHp: 100,
          bosses: [
            {
              id: 'boss_center',
              hpWeight: 1,
              spawnRange: { minX: 640, maxX: 640, minY: 100, maxY: 100 },
              laser: { maxCount: 0, minInterval: 999999, maxInterval: 999999 },
            },
          ],
        },
        {
          bossTotalHp: 300,
          bosses: [
            {
              id: 'boss_left',
              hpWeight: 1,
              spawnRange: { minX: 320, maxX: 400, minY: 100, maxY: 120 },
              laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 },
            },
            {
              id: 'boss_right',
              hpWeight: 2,
              spawnRange: { minX: 880, maxX: 960, minY: 100, maxY: 120 },
              laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 },
            },
          ],
        },
      ],
      infiniteScaling: {
        spawnIntervalReduction: 0,
        minSpawnInterval: 1000,
        bombWeightIncrease: 0,
        maxBombWeight: 1,
        goldenWeightDecrease: 0,
        minGoldenWeight: 0,
        bossTotalHpIncrease: 80,
        bossHpIncrease: 50,
        infiniteBossCount: 2,
        minDishCountIncrease: 0,
        maxMinDishCount: 10,
        amberStartWaveOffset: 1,
        amberStartWeight: 0,
        amberWeightIncrease: 0,
        maxAmberWeight: 0.3,
      },
    },
  },
}));

describe('MonsterSystem', () => {
  let monsterSystem: MonsterSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    monsterSystem = new MonsterSystem();
  });

  it('subscribes to WAVE_STARTED', () => {
    expect(mockOn).toHaveBeenCalledWith(GameEvents.WAVE_STARTED, expect.any(Function));
  });

  it('resets with per-boss HP and emits hp events for each boss', () => {
    monsterSystem.reset(2);

    expect(monsterSystem.getMaxHp('boss_left')).toBe(100);
    expect(monsterSystem.getMaxHp('boss_right')).toBe(200);
    expect(monsterSystem.getCurrentHp('boss_left')).toBe(100);
    expect(monsterSystem.getCurrentHp('boss_right')).toBe(200);

    expect(mockEmit).toHaveBeenCalledWith(GameEvents.MONSTER_HP_CHANGED, {
      bossId: 'boss_left',
      current: 100,
      max: 100,
      ratio: 1,
      sourceX: undefined,
      sourceY: undefined,
    });
    expect(mockEmit).toHaveBeenCalledWith(GameEvents.MONSTER_HP_CHANGED, {
      bossId: 'boss_right',
      current: 200,
      max: 200,
      ratio: 1,
      sourceX: undefined,
      sourceY: undefined,
    });
  });

  it('uses bossTotalHpIncrease for infinite waves', () => {
    // Wave 3 => base(300) + 80 = 380, weights 1:2 => 126 / 254
    monsterSystem.reset(3);

    expect(monsterSystem.getMaxHp('boss_left')).toBe(126);
    expect(monsterSystem.getMaxHp('boss_right')).toBe(254);
    expect(monsterSystem.getMaxHp()).toBe(380);
  });

  it('damages only the targeted boss and keeps others intact', () => {
    monsterSystem.reset(2);
    mockEmit.mockClear();

    monsterSystem.takeDamage('boss_left', 30, 100, 200);

    expect(monsterSystem.getCurrentHp('boss_left')).toBe(70);
    expect(monsterSystem.getCurrentHp('boss_right')).toBe(200);
    expect(mockEmit).toHaveBeenCalledWith(GameEvents.MONSTER_HP_CHANGED, {
      bossId: 'boss_left',
      current: 70,
      max: 100,
      ratio: 0.7,
      sourceX: 100,
      sourceY: 200,
    });
  });

  it('emits MONSTER_DIED with bossId when a boss dies', () => {
    monsterSystem.reset(2);
    mockEmit.mockClear();

    monsterSystem.takeDamage('boss_left', 100);

    expect(monsterSystem.isAlive('boss_left')).toBe(false);
    expect(mockEmit).toHaveBeenCalledWith(GameEvents.MONSTER_DIED, { bossId: 'boss_left' });
  });

  it('reports all-dead state only when every boss is dead', () => {
    monsterSystem.reset(2);

    monsterSystem.takeDamage('boss_left', 100);
    expect(monsterSystem.areAllDead()).toBe(false);

    monsterSystem.takeDamage('boss_right', 200);
    expect(monsterSystem.areAllDead()).toBe(true);
  });

  it('returns only alive boss ids', () => {
    monsterSystem.reset(2);
    monsterSystem.takeDamage('boss_left', 100);

    expect(monsterSystem.getAliveBossIds()).toEqual(['boss_right']);
  });
});
