import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonsterSystem } from '../src/systems/MonsterSystem';
import { GameEvents } from '../src/utils/EventBus';

// Mock EventBus
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

// Mock Data
vi.mock('../src/data/DataManager', () => ({
  Data: {
    waves: {
      waves: [{ bossHp: 100 }, { bossHp: 200 }],
      infiniteScaling: {
        bossHpIncrease: 50,
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

  describe('Initialization', () => {
    it('should subscribe to WAVE_STARTED', () => {
      expect(mockOn).toHaveBeenCalledWith(GameEvents.WAVE_STARTED, expect.any(Function));
    });
  });

  describe('Wave Scaling', () => {
    it('should set correct HP for normal waves', () => {
      monsterSystem.reset(1);
      expect(monsterSystem.getMaxHp()).toBe(100);
      expect(monsterSystem.getCurrentHp()).toBe(100);

      monsterSystem.reset(2);
      expect(monsterSystem.getMaxHp()).toBe(200);
    });

    it('should scale HP for infinite waves', () => {
      // Defined waves are length 2.
      // Wave 3 -> 1 level beyond.
      // Base is last wave (200) + 1 * 50 = 250.
      monsterSystem.reset(3);
      expect(monsterSystem.getMaxHp()).toBe(250);

      // Wave 4 -> 2 levels beyond.
      // 200 + 2 * 50 = 300.
      monsterSystem.reset(4);
      expect(monsterSystem.getMaxHp()).toBe(300);
    });
  });

  describe('Damage Logic', () => {
    beforeEach(() => {
      monsterSystem.reset(1); // HP 100
    });

    it('should reduce HP and emit change event', () => {
      monsterSystem.takeDamage(10);
      expect(monsterSystem.getCurrentHp()).toBe(90);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.MONSTER_HP_CHANGED, {
        current: 90,
        max: 100,
        ratio: 0.9,
      });
    });

    it('should clamp HP to 0', () => {
      monsterSystem.takeDamage(200);
      expect(monsterSystem.getCurrentHp()).toBe(0);
    });

    it('should emit death event when HP reaches 0', () => {
      monsterSystem.takeDamage(100);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.MONSTER_DIED);
      expect(monsterSystem.isAlive()).toBe(false);
    });

    it('should not take damage if dead', () => {
      monsterSystem.takeDamage(100); // Dies
      mockEmit.mockClear();

      monsterSystem.takeDamage(10);
      expect(mockEmit).not.toHaveBeenCalled();
      expect(monsterSystem.getCurrentHp()).toBe(0);
    });
  });
});
