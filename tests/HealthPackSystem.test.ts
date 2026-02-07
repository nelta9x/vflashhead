import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  return {
    default: {
      Scene: class {},
      Math: {
        Between: vi.fn((min, _max) => min),
        Distance: {
          Between: vi.fn((x1, y1, x2, y2) => {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          }),
        },
      },
    },
  };
});

import { HealthPackSystem } from '../src/systems/HealthPackSystem';
import { GameEvents } from '../src/utils/EventBus';

// Mock constants
vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 800,
  HEAL_PACK: {
    COOLDOWN: 5000,
    MAX_ACTIVE: 1,
    BONUS_CHANCE_PER_COLLECTION: 0.05,
    BASE_SPAWN_CHANCE: 0.04,
    CHECK_INTERVAL: 5000,
  },
}));

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
    HP_CHANGED: 'hp_changed',
    HEALTH_PACK_COLLECTED: 'health_pack_collected',
    HEALTH_PACK_MISSED: 'health_pack_missed',
  },
}));

// Mock Entity and Pool
const mockPack = {
  spawn: vi.fn(),
  update: vi.fn(),
  active: false,
};

vi.mock('../src/entities/HealthPack', () => {
  return {
    HealthPack: vi.fn(() => mockPack),
  };
});

// We can mock ObjectPool properly or use a simple mock implementation
const mockAcquire = vi.fn(() => mockPack);
const mockRelease = vi.fn();
const mockForEach = vi.fn();
const mockGetActiveCount = vi.fn(() => 0);
const mockClear = vi.fn();

vi.mock('../src/utils/ObjectPool', () => {
  return {
    ObjectPool: vi.fn().mockImplementation(() => ({
      acquire: mockAcquire,
      release: mockRelease,
      forEach: mockForEach,
      getActiveCount: mockGetActiveCount,
      clear: mockClear,
    })),
  };
});

// Mock UpgradeSystem
const mockGetHealthPackDropBonus = vi.fn(() => 0);
const mockUpgradeSystem = {
  getHealthPackDropBonus: mockGetHealthPackDropBonus,
} as any;

describe('HealthPackSystem', () => {
  let system: HealthPackSystem;
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = {};
    mockGetHealthPackDropBonus.mockReturnValue(0);
    system = new HealthPackSystem(mockScene, mockUpgradeSystem);
  });

  describe('Initialization', () => {
    it('should subscribe to events', () => {
      expect(mockOn).toHaveBeenCalledWith(GameEvents.HEALTH_PACK_COLLECTED, expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith(GameEvents.HEALTH_PACK_MISSED, expect.any(Function));
    });
  });

  describe('Spawn Logic', () => {
    it('should use fixed base spawn chance', () => {
      expect(system.getSpawnChance()).toBe(0.04);
    });

    it('should include upgrade bonus in spawn chance', () => {
      mockGetHealthPackDropBonus.mockReturnValue(0.02);
      expect(system.getSpawnChance()).toBe(0.06);
    });

    it('should not spawn if check interval not reached', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01); // 성공 확률

      mockAcquire.mockClear();

      // 4.9초 업데이트 (5초 미만)
      system.update(4900, 10000);
      expect(mockAcquire).not.toHaveBeenCalled();

      // 추가 0.1초 업데이트 (총 5초)
      system.update(100, 10100);
      expect(mockAcquire).toHaveBeenCalledTimes(1);

      Math.random = originalRandom;
    });

    it('should not spawn if cooldown active', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      mockAcquire.mockClear();

      // 첫 번째 업데이트: 스폰
      system.update(5100, 10000);
      expect(mockAcquire).toHaveBeenCalledTimes(1);

      // 두 번째 업데이트: 5초 지났지만 쿨다운(5초) 중이라 안 됨
      // lastSpawnTime = 10000, 쿨다운 5000 -> 15000 이후 가능
      mockAcquire.mockClear();
      system.update(5100, 14000); // gameTime 14000 < 15000

      expect(mockAcquire).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('Event Handling', () => {
    it('should increase spawn chance on collected', () => {
      expect(system.getSpawnChance()).toBe(0.04);

      // 힐팩 수집
      const collectCallback = mockOn.mock.calls.find(
        (call) => call[0] === GameEvents.HEALTH_PACK_COLLECTED
      )?.[1];
      if (collectCallback) {
        collectCallback({ pack: {} });
      }

      // 0.04 + 0.05 = 0.09
      expect(system.getSpawnChance()).toBeCloseTo(0.09);
    });

    it('should release pack on collected', () => {
      const callback = mockOn.mock.calls.find(
        (call) => call[0] === GameEvents.HEALTH_PACK_COLLECTED
      )?.[1];
      if (callback) {
        const pack = {};
        callback({ pack });
        expect(mockRelease).toHaveBeenCalledWith(pack);
      }
    });

    it('should release pack on missed', () => {
      const callback = mockOn.mock.calls.find(
        (call) => call[0] === GameEvents.HEALTH_PACK_MISSED
      )?.[1];
      if (callback) {
        const pack = {};
        callback({ pack });
        expect(mockRelease).toHaveBeenCalledWith(pack);
      }
    });
  });

  describe('checkCollection', () => {
    it('should collect pack if cursor is in range', () => {
      const mockPackForCollection = {
        active: true,
        x: 100,
        y: 100,
        getRadius: vi.fn(() => 20),
        collect: vi.fn(),
      };

      mockForEach.mockImplementation((callback) => {
        callback(mockPackForCollection);
      });

      // 커서 반경 30, 팩 반경 20 -> 50 이내면 수집
      // 1. 범위 밖 (거리 60)
      system.checkCollection(100, 160, 30);
      expect(mockPackForCollection.collect).not.toHaveBeenCalled();

      // 2. 범위 안 (거리 40)
      system.checkCollection(100, 140, 30);
      expect(mockPackForCollection.collect).toHaveBeenCalledTimes(1);
    });
  });
});
