import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DataManager before everything
vi.mock('../src/data/DataManager', () => ({
  Data: {
    t: vi.fn((key) => key),
    formatTemplate: vi.fn((key) => key),
    gameConfig: {
      gameGrid: { speed: 100 },
    },
    upgrades: {
      system: [],
    },
  },
}));

// Mock constants
vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 800,
  COLORS: { RED: 0xff0000 },
  COLORS_HEX: {
    WHITE: '#ffffff',
    GREEN: '#00ff00',
    YELLOW: '#ffff00',
    RED: '#ff0000',
    CYAN: '#00ffff',
  },
  INITIAL_HP: 5,
  FONTS: { MAIN: 'Arial' },
}));

// Mock Phaser with a more minimal structure that doesn't trigger OS.js detection
vi.mock('phaser', () => {
  return {
    default: {
      GameObjects: {
        Graphics: vi.fn(),
        Text: vi.fn(),
        Container: vi.fn(),
      },
      Scene: vi.fn(),
    },
  };
});

// Create mock graphics object
function createMockGraphics() {
  return {
    setPosition: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    fillTriangle: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    alpha: 1,
  };
}

// Create mock text object
function createMockText() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    visible: true,
  };
}

// Create mock container object
function createMockContainer() {
  return {
    add: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    setPosition: vi.fn().mockReturnThis(),
  };
}

import { HUD } from '../src/ui/HUD';
import { HealthSystem } from '../src/systems/HealthSystem';

describe('HUD', () => {
  let mockScene: any;
  let waveSystem: any;
  let healthSystem: HealthSystem;
  let hud: HUD;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockScene = {
      add: {
        text: vi.fn(() => createMockText()),
        graphics: vi.fn(() => createMockGraphics()),
        container: vi.fn(() => createMockContainer()),
      },
      tweens: {
        add: vi.fn(),
        isTweening: vi.fn(() => false),
      },
    };

    waveSystem = {
      getCurrentWave: vi.fn(() => 1),
      isFever: vi.fn(() => false),
    };
    healthSystem = new HealthSystem(5);
    hud = new HUD(mockScene as any, waveSystem as any, healthSystem);
  });

  it('should initialize with initial HP hearts', () => {
    // Initial maxHp is 5
    expect(mockScene.add.graphics).toHaveBeenCalledTimes(5);
  });

  it('should increase heart count when maxHp increases', () => {
    // Initial: 5 calls in constructor
    mockScene.add.graphics.mockClear();

    healthSystem.setMaxHp(7);
    hud.update(0);

    // syncHpHearts should have added 2 more hearts
    expect(mockScene.add.graphics).toHaveBeenCalledTimes(2);
  });

  it('should decrease heart count when maxHp decreases', () => {
    // Get the hearts created during initialization
    const initialGraphics = mockScene.add.graphics.mock.results.map((r: any) => r.value);

    healthSystem.setMaxHp(3);
    hud.update(0);

    // Should have called destroy on the last 2 hearts (index 3 and 4)
    expect(initialGraphics[4].destroy).toHaveBeenCalled();
    expect(initialGraphics[3].destroy).toHaveBeenCalled();
    expect(initialGraphics[2].destroy).not.toHaveBeenCalled();
  });
});
