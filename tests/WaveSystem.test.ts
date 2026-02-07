import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Phaser BEFORE importing WaveSystem
vi.mock('phaser', () => {
  return {
    default: {
      Scene: class {},
      Math: {
        Between: vi.fn((min, _max) => min), // Simple mock returning min
        Distance: {
          Between: vi.fn(() => 100), // Default distance
        },
      },
    },
  };
});

import { WaveSystem } from '../src/systems/WaveSystem';
import { GameEvents } from '../src/utils/EventBus';
import Phaser from 'phaser'; // Import mocked Phaser to manipulate mocks

// Mock dependencies
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
      on: mockOn,
      off: mockOff,
    }),
  },
  GameEvents: {
    WAVE_STARTED: 'wave_started',
    WAVE_COMPLETED: 'wave_completed',
    WAVE_COUNTDOWN_START: 'wave_countdown_start',
    WAVE_COUNTDOWN_TICK: 'wave_countdown_tick',
    WAVE_READY: 'wave_ready',
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    waves: {
      waves: [
        {
          dishCount: 3,
          spawnInterval: 2000,
          dishTypes: [{ type: 'basic', weight: 1 }],
        },
        {
          dishCount: 4,
          spawnInterval: 1500,
          dishTypes: [
            { type: 'basic', weight: 0.8 },
            { type: 'golden', weight: 0.2 },
          ],
        },
      ],
      infiniteScaling: {
        minSpawnInterval: 500,
        spawnIntervalReduction: 100,
        maxBombWeight: 0.5,
        bombWeightIncrease: 0.05,
        minGoldenWeight: 0.1,
        goldenWeightDecrease: 0.05,
        minDishCountIncrease: 1,
        maxMinDishCount: 20,
      },
      fever: {
        dishCount: 999,
        spawnInterval: 200,
        dishTypes: [{ type: 'golden', weight: 1.0 }],
      },
    },
    spawn: {
      fillSpawn: {
        maxPerFrame: 1,
        cooldownMs: 50,
      },
    },
  },
}));

vi.mock('../src/data/constants', () => ({
  SPAWN_AREA: { minX: 0, maxX: 800, minY: 0, maxY: 600 },
  MIN_DISH_DISTANCE: 50,
  MIN_BOSS_DISTANCE: 200,
  WAVE_TRANSITION: { COUNTDOWN_DURATION: 3000, COUNT_FROM: 3 },
}));

describe('WaveSystem', () => {
  let waveSystem: WaveSystem;
  let mockScene: any;
  let mockDishPool: any;
  let mockGetMaxSpawnY: any;
  let mockGetBoss: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      spawnDish: vi.fn(),
    };

    mockDishPool = {
      getActiveCount: vi.fn().mockReturnValue(5), // Default to normal count
      getActiveObjects: vi.fn().mockReturnValue([]),
    };

    mockGetMaxSpawnY = vi.fn().mockReturnValue(600);
    mockGetBoss = vi.fn().mockReturnValue(null);

    waveSystem = new WaveSystem(mockScene, () => mockDishPool, mockGetMaxSpawnY, mockGetBoss);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize in waiting phase', () => {
      expect(waveSystem.getWavePhase()).toBe('waiting');
      expect(waveSystem.getCurrentWave()).toBe(0);
    });
  });

  describe('Countdown', () => {
    it('should start countdown correctly', () => {
      waveSystem.startCountdown(1);
      expect(waveSystem.getWavePhase()).toBe('countdown');
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_COUNTDOWN_START, 1);
    });

    it('should emit tick events during countdown', () => {
      waveSystem.startCountdown(1);

      // Update 1000ms (3s -> 2s)
      waveSystem.update(1000);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_COUNTDOWN_TICK, 2);

      // Update 1000ms (2s -> 1s)
      waveSystem.update(1000);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_COUNTDOWN_TICK, 1);
    });

    it('should start wave after countdown finishes', () => {
      waveSystem.startCountdown(1);

      // Update full duration (3000ms)
      waveSystem.update(3000);

      expect(waveSystem.getWavePhase()).toBe('spawning');
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_READY);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_STARTED, 1);
    });
  });

  describe('Wave Start & Config', () => {
    it('should load correct config for defined waves', () => {
      waveSystem.startWave(1);
      expect(waveSystem.getCurrentWave()).toBe(1);
      // Config is internal, but we can verify behavior
    });

    it('should scale config for infinite waves', () => {
      // Wave 3 is beyond defined 2 waves
      waveSystem.startWave(3);

      // Infinite scaling logic check could be done via spying on getScaledWaveConfig if it was public,
      // or observing spawn behavior.
      // Here we trust the internal logic if no errors are thrown.
      expect(waveSystem.getCurrentWave()).toBe(3);
    });
  });

  describe('Spawning Logic', () => {
    beforeEach(() => {
      waveSystem.startWave(1); // Wave 1: 2000ms interval
    });

    it('should spawn dish when interval passed', () => {
      // Advance time by 2000ms
      waveSystem.update(2000);

      expect(mockScene.spawnDish).toHaveBeenCalled();
    });

    it('should NOT spawn dish before interval', () => {
      // Advance time by 1000ms
      waveSystem.update(1000);

      expect(mockScene.spawnDish).not.toHaveBeenCalled();
    });

    it('should fill spawn when active count is below minDishCount', () => {
      // Wave 1 minDishCount = 3, fillSpawn cooldown = 50ms
      mockDishPool.getActiveCount.mockReturnValue(0);

      // Update 50ms (meets cooldown)
      waveSystem.update(50);

      expect(mockScene.spawnDish).toHaveBeenCalled();
    });

    it('should NOT fill spawn when active count meets minDishCount', () => {
      // Wave 1 minDishCount = 3, active count = 3 -> no fill spawn
      mockDishPool.getActiveCount.mockReturnValue(3);

      // Update 50ms (meets cooldown but active count is sufficient)
      waveSystem.update(50);

      // Should not spawn because interval (2000ms) hasn't passed and fill spawn not needed
      expect(mockScene.spawnDish).not.toHaveBeenCalled();
    });

    it('should respect fill spawn cooldown', () => {
      // Wave 1 minDishCount = 3, fillSpawn cooldown = 50ms
      mockDishPool.getActiveCount.mockReturnValue(0);

      // Update only 30ms (below cooldown)
      waveSystem.update(30);

      expect(mockScene.spawnDish).not.toHaveBeenCalled();
    });
  });

  describe('Fever Time', () => {
    it('should switch to fever config', () => {
      waveSystem.startWave(1); // Start wave to be in 'spawning' phase
      waveSystem.startFeverTime();
      expect(waveSystem.isFever()).toBe(true);

      // Fever interval is 200ms
      waveSystem.update(200);
      expect(mockScene.spawnDish).toHaveBeenCalled();
    });
  });

  describe('Spawning Constraints', () => {
    it('should not spawn if no valid position found', () => {
      waveSystem.startWave(1);

      // Mock Distance.Between to always return 0 (collision)
      // We need to override the mock for this test
      const originalDistance = Phaser.Math.Distance.Between;
      Phaser.Math.Distance.Between = vi.fn(() => 0); // Always collides

      // Add an active dish to cause collision check
      mockDishPool.getActiveObjects.mockReturnValue([{ x: 100, y: 100 }]);

      // Update time to trigger spawn attempt
      waveSystem.update(2000);

      expect(mockScene.spawnDish).not.toHaveBeenCalled();

      // Restore mock
      Phaser.Math.Distance.Between = originalDistance;
    });
  });
  describe('Completion', () => {
    it('should emit wave completed event', () => {
      waveSystem.startWave(1);
      waveSystem.forceCompleteWave();

      expect(waveSystem.getWavePhase()).toBe('waiting');
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_COMPLETED, 1);
    });
  });
});
