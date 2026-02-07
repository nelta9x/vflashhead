import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DataManager before everything
vi.mock('../src/data/DataManager', () => ({
  Data: {
    t: vi.fn((key) => key),
    formatTemplate: vi.fn((key) => key),
    getColor: vi.fn((key) => {
      if (key === 'red') return 0xff0000;
      if (key === 'green') return 0x00ff00;
      return 0xffffff;
    }),
    getColorHex: vi.fn((key) => {
      if (key === 'green') return '#00ff00';
      if (key === 'brightGreen') return '#44ff88';
      if (key === 'cyan') return '#00ffff';
      if (key === 'yellow') return '#ffff00';
      if (key === 'white') return '#ffffff';
      return '#ffffff';
    }),
    gameConfig: {
      gameGrid: { speed: 100 },
      render: { pixelArt: true, antialias: false },
      textSettings: {
        resolution: 2,
        upgradeUI: { nameSize: 16, descSize: 12 },
        hud: {
          waveSize: 16,
          timerSize: 24,
          feverSize: 32,
          completeSize: 36,
          strokeThickness: 1.5,
          timerStrokeThickness: 2,
        },
      },
      hud: {
        waveTimerDisplay: {
          rightMargin: 20,
          bottomMargin: 20,
          spacing: 26,
          virtualBarWidthRatio: 0.5,
          dockPauseHoldDurationMs: 1200,
          dockPauseGauge: {
            height: 6,
            insetX: 18,
            bottomInset: 8,
            cornerRadius: 3,
            bgColor: 'darkBg',
            bgAlpha: 0.45,
            fillColor: 'cyan',
            fillAlpha: 0.95,
            borderColor: 'darkCyan',
            borderAlpha: 0.9,
            borderWidth: 1,
          },
          dockOverlay: {
            cornerRadius: 12,
            bgColor: 'darkBg',
            bgAlpha: 0.58,
            borderColor: 'cyan',
            borderAlpha: 0.45,
            borderWidth: 1.5,
            highlightColor: 'white',
            highlightAlpha: 0.12,
            highlightHeight: 10,
            resumeHintFontSize: 14,
            resumeHintColor: 'cyan',
            resumeHintStrokeColor: 'darkBg',
            resumeHintStrokeThickness: 3,
            resumeHintAlpha: 0.95,
            resumeHintOffsetY: 12,
          },
        },
        timerColors: {
          default: 'green',
          mid: 'brightGreen',
          high: 'cyan',
          ultra: 'yellow',
        },
        timerThresholds: {
          mid: 60000,
          high: 120000,
          ultra: 180000,
        },
        hpDisplay: {
          startX: 20,
          startY: 25,
          spacing: 35,
          heartSize: 12,
          filledColor: 'red',
          emptyColor: '#333333',
        },
      },
    },
    upgrades: {
      system: [],
    },
    feedback: {
      particles: {
        basic: { count: 10 },
        golden: { count: 10 },
        crystal: { count: 10 },
        bomb: { count: 10 },
      },
      upgradeAbsorption: {
        particleCount: 10,
        duration: 100,
        particleSizeMin: 1,
        particleSizeMax: 2,
        startSpread: 10,
        spreadDuration: 100,
        spreadEase: 'Linear',
        suctionEase: 'Linear',
        suctionDelayMax: 10,
        impactRingSize: 10,
        impactRingScale: 1,
        impactGlowSize: 10,
        impactGlowScale: 1,
      },
    },
  },
}));

// Mock constants
vi.mock('../src/data/constants', () => ({
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,
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
    visible: true,
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn(function (this: { visible: boolean }, value: boolean) {
      this.visible = value;
      return this;
    }),
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

  it('should not render top HP graphics after moving HP to cursor ring', () => {
    // HUD constructor should not draw HP hearts anymore.
    expect(mockScene.add.graphics).toHaveBeenCalledTimes(0);
  });

  it('should update safely when maxHp increases', () => {
    healthSystem.setMaxHp(7);
    hud.update(0, { cursorX: 0, cursorY: 0, isUpgradeSelectionVisible: false }, 0);

    // HP is rendered by cursor ring now, so no top-heart graphics are created.
    expect(mockScene.add.graphics).toHaveBeenCalledTimes(0);
  });

  it('should update safely when maxHp decreases', () => {
    healthSystem.setMaxHp(3);
    hud.update(0, { cursorX: 0, cursorY: 0, isUpgradeSelectionVisible: false }, 0);

    expect(mockScene.add.graphics).toHaveBeenCalledTimes(0);
  });
});
