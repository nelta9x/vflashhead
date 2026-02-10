import { describe, it, expect, vi, beforeEach } from 'vitest';
import Phaser from 'phaser';

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

import { FallingBombSystem } from '../src/systems/FallingBombSystem';
import { GameEvents } from '../src/utils/EventBus';

vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 800,
  FALLING_BOMB: {
    COOLDOWN: 12000,
    MAX_ACTIVE: 2,
    BASE_SPAWN_CHANCE: 0.06,
    CHECK_INTERVAL: 4000,
    MIN_WAVE: 5,
  },
}));

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
    FALLING_BOMB_SPAWNED: 'fallingBomb:spawned',
    FALLING_BOMB_DESTROYED: 'fallingBomb:destroyed',
    FALLING_BOMB_MISSED: 'fallingBomb:missed',
  },
}));

const mockBomb = {
  spawn: vi.fn(),
  update: vi.fn(),
  active: false,
  isFullySpawned: vi.fn(() => true),
  getRadius: vi.fn(() => 30),
  x: 100,
  y: 100,
  forceDestroy: vi.fn(),
};

vi.mock('../src/entities/FallingBomb', () => {
  return {
    FallingBomb: vi.fn(() => mockBomb),
  };
});

const mockAcquire = vi.fn(() => mockBomb);
const mockRelease = vi.fn();
const mockForEach = vi.fn();
const mockGetActiveCount = vi.fn(() => 0);
const mockClear = vi.fn();
const mockGetActiveObjects = vi.fn(() => []);

vi.mock('../src/utils/ObjectPool', () => {
  return {
    ObjectPool: vi.fn().mockImplementation(() => ({
      acquire: mockAcquire,
      release: mockRelease,
      forEach: mockForEach,
      getActiveCount: mockGetActiveCount,
      getActiveObjects: mockGetActiveObjects,
      clear: mockClear,
    })),
  };
});

describe('FallingBombSystem', () => {
  let system: FallingBombSystem;
  let mockScene: Phaser.Scene;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = {} as Phaser.Scene;
    system = new FallingBombSystem(mockScene);
  });

  describe('Initialization', () => {
    it('should subscribe to destroyed and missed events', () => {
      expect(mockOn).toHaveBeenCalledWith(GameEvents.FALLING_BOMB_DESTROYED, expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith(GameEvents.FALLING_BOMB_MISSED, expect.any(Function));
    });
  });

  describe('Spawn Logic', () => {
    it('should not spawn before minWave', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      system.update(5000, 20000, 2);
      expect(mockAcquire).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should not spawn if check interval not reached', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      mockAcquire.mockClear();
      system.update(3900, 20000, 5);
      expect(mockAcquire).not.toHaveBeenCalled();

      system.update(100, 20100, 5);
      expect(mockAcquire).toHaveBeenCalledTimes(1);

      Math.random = originalRandom;
    });

    it('should not spawn if cooldown active', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);

      mockAcquire.mockClear();
      system.update(4100, 20000, 5);
      expect(mockAcquire).toHaveBeenCalledTimes(1);

      mockAcquire.mockClear();
      system.update(4100, 24000, 5);
      expect(mockAcquire).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should not spawn if max active reached', () => {
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.01);
      mockGetActiveCount.mockReturnValue(2);

      mockAcquire.mockClear();
      system.update(4100, 20000, 5);
      expect(mockAcquire).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('checkCursorCollision', () => {
    it('should call forceDestroy(false) when cursor overlaps a fully spawned bomb', () => {
      const mockBombForCollision = {
        active: true,
        x: 100,
        y: 100,
        isFullySpawned: vi.fn(() => true),
        getRadius: vi.fn(() => 20),
        forceDestroy: vi.fn(),
      };

      mockForEach.mockImplementation((callback: (b: typeof mockBombForCollision) => void) => {
        callback(mockBombForCollision);
      });

      // distance = 60 > hitDistance = 50 -> out of range
      system.checkCursorCollision(100, 160, 30);
      expect(mockBombForCollision.forceDestroy).not.toHaveBeenCalled();

      system.checkCursorCollision(100, 140, 30);
      expect(mockBombForCollision.forceDestroy).toHaveBeenCalledWith(false);
    });

    it('should not destroy a bomb that is not fully spawned', () => {
      const mockBombNotSpawned = {
        active: true,
        x: 100,
        y: 100,
        isFullySpawned: vi.fn(() => false),
        getRadius: vi.fn(() => 20),
        forceDestroy: vi.fn(),
      };

      mockForEach.mockImplementation((callback: (b: typeof mockBombNotSpawned) => void) => {
        callback(mockBombNotSpawned);
      });

      system.checkCursorCollision(100, 100, 30);
      expect(mockBombNotSpawned.forceDestroy).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should release bomb on destroyed', () => {
      const callback = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === GameEvents.FALLING_BOMB_DESTROYED
      )?.[1] as ((...args: unknown[]) => void) | undefined;
      if (callback) {
        const bomb = {};
        callback({ bomb });
        expect(mockRelease).toHaveBeenCalledWith(bomb);
      }
    });

    it('should release bomb on missed', () => {
      const callback = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === GameEvents.FALLING_BOMB_MISSED
      )?.[1] as ((...args: unknown[]) => void) | undefined;
      if (callback) {
        const bomb = {};
        callback({ bomb });
        expect(mockRelease).toHaveBeenCalledWith(bomb);
      }
    });
  });

  describe('getPool', () => {
    it('should return the internal pool', () => {
      const pool = system.getPool();
      expect(pool).toBeDefined();
    });
  });
});
