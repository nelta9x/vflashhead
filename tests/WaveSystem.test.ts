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

import { WaveSystem } from '../src/plugins/builtin/services/WaveSystem';
import { GameEvents } from '../src/utils/EventBus';
import Phaser from 'phaser'; // Import mocked Phaser to manipulate mocks
import type { ObjectPool } from '../src/utils/ObjectPool';
import type { Entity } from '../src/entities/Entity';

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
          bossTotalHp: 100,
          bosses: [
            {
              id: 'boss_center',
              hpWeight: 1,
              spawnRange: { minX: 400, maxX: 400, minY: 100, maxY: 100 },
              laser: { maxCount: 0, minInterval: 999999, maxInterval: 999999 },
            },
          ],
          bossSpawnMinDistance: 200,
        },
        {
          dishCount: 4,
          spawnInterval: 1500,
          dishTypes: [
            { type: 'basic', weight: 0.8 },
            { type: 'golden', weight: 0.2, maxActive: 1 },
          ],
          bossTotalHp: 200,
          bosses: [
            {
              id: 'boss_left',
              hpWeight: 1,
              spawnRange: { minX: 250, maxX: 320, minY: 100, maxY: 120 },
              laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 },
            },
            {
              id: 'boss_right',
              hpWeight: 1,
              spawnRange: { minX: 500, maxX: 600, minY: 100, maxY: 120 },
              laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 },
            },
          ],
          bossSpawnMinDistance: 200,
        },
      ],
      infiniteScaling: {
        minSpawnInterval: 500,
        spawnIntervalReduction: 100,
        maxBombWeight: 0.5,
        bombWeightIncrease: 0.05,
        minGoldenWeight: 0.1,
        goldenWeightDecrease: 0.05,
        bossTotalHpIncrease: 50,
        infiniteBossCount: 2,
        minDishCountIncrease: 1,
        maxMinDishCount: 20,
        amberStartWaveOffset: 1,
        amberStartWeight: 0.02,
        amberWeightIncrease: 0.02,
        maxAmberWeight: 0.2,
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
  let mockScene: { spawnDish: ReturnType<typeof vi.fn> };
  let mockDishPool: {
    getActiveCount: ReturnType<typeof vi.fn>;
    getActiveObjects: ReturnType<typeof vi.fn>;
  };
  let mockGetMaxSpawnY: () => number;
  let mockGetBoss: ReturnType<typeof vi.fn>;

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
    mockGetBoss = vi.fn().mockReturnValue([]);

    waveSystem = new WaveSystem(
      mockScene as unknown as Phaser.Scene,
      () => mockDishPool as unknown as ObjectPool<Entity>,
      mockGetMaxSpawnY,
      mockGetBoss as () => Array<{ id: string; x: number; y: number; visible: boolean }>
    );
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

    it('emits each countdown boundary tick exactly once even with large deltas', () => {
      waveSystem.startCountdown(1);

      // Jump over two boundaries at once: should emit 2 and 1 in order.
      waveSystem.update(2500);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_COUNTDOWN_TICK, 2);
      expect(mockEmit).toHaveBeenCalledWith(GameEvents.WAVE_COUNTDOWN_TICK, 1);

      // Final boundary should emit 0 once and then ready/start.
      waveSystem.update(500);
      const zeroTickCalls = mockEmit.mock.calls.filter(
        ([event, value]) => event === GameEvents.WAVE_COUNTDOWN_TICK && value === 0
      );
      expect(zeroTickCalls).toHaveLength(1);
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

    it('checks distance against all visible bosses', () => {
      waveSystem.startWave(2);

      mockGetBoss.mockReturnValue([
        { id: 'boss_left', x: 100, y: 100, visible: true },
        { id: 'boss_right', x: 700, y: 100, visible: true },
      ]);

      const originalDistance = Phaser.Math.Distance.Between;
      Phaser.Math.Distance.Between = vi.fn(() => 0);

      waveSystem.update(2000);

      expect(mockScene.spawnDish).not.toHaveBeenCalled();

      Phaser.Math.Distance.Between = originalDistance;
    });

    it('validates both boss and dish distance constraints before spawning', () => {
      waveSystem.startWave(1);
      mockGetBoss.mockReturnValue([{ id: 'boss_center', x: 100, y: 100, visible: true }]);
      mockDishPool.getActiveObjects.mockReturnValue([{ x: 200, y: 200 }]);

      const originalDistance = Phaser.Math.Distance.Between;
      const distanceSpy = vi.fn(() => 1000);
      Phaser.Math.Distance.Between = distanceSpy;

      waveSystem.update(2000);

      expect(distanceSpy).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(distanceSpy).toHaveBeenCalledWith(0, 0, 200, 200);
      expect(mockScene.spawnDish).toHaveBeenCalled();

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

  describe('maxActive', () => {
    let mockSpawnDelegate: { spawnDish: ReturnType<typeof vi.fn> };
    let mockGetActiveCountByType: ReturnType<typeof vi.fn>;

    function createWaveSystemWithMaxActive() {
      mockSpawnDelegate = { spawnDish: vi.fn() };
      mockGetActiveCountByType = vi.fn().mockReturnValue(0);

      return new WaveSystem(
        {} as Phaser.Scene,
        () => mockDishPool as unknown as ObjectPool<Entity>,
        mockGetMaxSpawnY,
        mockGetBoss as () => Array<{ id: string; x: number; y: number; visible: boolean }>,
        mockSpawnDelegate,
        mockGetActiveCountByType as (type: string) => number,
      );
    }

    it('should exclude type that reached maxActive cap', () => {
      // Wave 2: basic (0.8, no cap), golden (0.2, maxActive: 1)
      const ws = createWaveSystemWithMaxActive();
      ws.startWave(2);

      // golden has 1 active, which equals maxActive(1) → excluded
      mockGetActiveCountByType.mockImplementation((type: string) => (type === 'golden' ? 1 : 0));

      // Force Math.random to pick golden range (high value) to confirm it's excluded
      const originalRandom = Math.random;
      Math.random = () => 0.99;

      ws.update(1500);

      // Should have spawned, but only basic type is eligible
      expect(mockSpawnDelegate.spawnDish).toHaveBeenCalled();
      const spawnedType = mockSpawnDelegate.spawnDish.mock.calls[0][0];
      expect(spawnedType).toBe('basic');

      Math.random = originalRandom;
    });

    it('should spawn type without maxActive regardless of active count', () => {
      const ws = createWaveSystemWithMaxActive();
      ws.startWave(2);

      // basic has no maxActive, golden has maxActive: 1
      // Even with many basics active, basic should still spawn
      mockGetActiveCountByType.mockImplementation((type: string) => (type === 'basic' ? 100 : 0));

      ws.update(1500);

      expect(mockSpawnDelegate.spawnDish).toHaveBeenCalled();
    });

    it('should preserve existing behavior when getActiveCountByType is not provided', () => {
      // Use default waveSystem (no getActiveCountByType)
      waveSystem.startWave(2);

      // golden has maxActive: 1 in mock data, but no counter → no filtering
      waveSystem.update(1500);

      expect(mockScene.spawnDish).toHaveBeenCalled();
    });
  });
});
