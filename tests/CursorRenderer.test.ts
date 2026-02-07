import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Phaser with a more minimal structure that doesn't trigger OS.js detection
vi.mock('phaser', () => {
  return {
    default: {
      GameObjects: {
        Graphics: vi.fn(),
      },
      Scene: vi.fn(),
      Math: {
        Clamp: vi.fn((value: number, min: number, max: number) => Math.min(Math.max(value, min), max)),
        DegToRad: vi.fn((degrees: number) => (degrees * Math.PI) / 180),
        Linear: vi.fn((start: number, end: number, t: number) => start + (end - start) * t),
      },
      Display: {
        Color: {
          HexStringToColor: vi.fn(() => ({ color: 0xff0000 }))
        }
      }
    },
  };
});

// Mock DataManager
vi.mock('../src/data/DataManager', () => ({
  Data: {
    getColor: vi.fn(() => 0xffffff),
    gameConfig: {
      player: {
        initialHp: 5,
        cursorColorNumeric: 0x00ffff,
        hpRing: {
          radiusOffset: 10,
          barThickness: 6,
          segmentGapDeg: 9,
          filledColor: 'cyan',
          filledAlpha: 0.85,
          emptyColor: '#102230',
          emptyAlpha: 0.25,
          borderColor: 'white',
          borderAlpha: 0.75,
          borderThickness: 1.6,
          lowHpPulseSpeed: 0.008,
          lowHpMinAlpha: 0.35
        }
      }
    },
    feedback: {
      bossAttack: {
        mainColor: '#ff0000'
      }
    }
  }
}));

// Mock constants
vi.mock('../src/data/constants', () => ({
  COLORS: {
    MAGENTA: 0xff00ff,
    WHITE: 0xffffff,
    CYAN: 0x00ffff
  }
}));

// Create mock graphics object
function createMockGraphics() {
  return {
    clear: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    arc: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn().mockReturnThis(),
  };
}

import { CursorRenderer } from '../src/effects/CursorRenderer';

describe('CursorRenderer', () => {
  let mockScene: any;
  let mockGraphics: any;
  let cursorRenderer: CursorRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphics = createMockGraphics();
    mockScene = {
      add: {
        graphics: vi.fn(() => mockGraphics)
      }
    };
    cursorRenderer = new CursorRenderer(mockScene);
  });

  it('should render attack indicator without electric effect', () => {
    cursorRenderer.renderAttackIndicator(100, 100, 30, 0.5, 50, 0, 0, 0);
    
    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(100, 100, 30);
    // Should NOT call electric effect related methods
    expect(mockGraphics.beginPath).not.toHaveBeenCalled();
  });

  it('should render hp ring in menu cursor', () => {
    cursorRenderer.renderMenuCursor(100, 100, 30, 0.7, 1200);

    expect(mockGraphics.clear).toHaveBeenCalled();
    expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(100, 100, 30);
    expect(mockGraphics.arc).toHaveBeenCalled();
  });

  it('should render electric sparks when electricLevel > 0', () => {
    cursorRenderer.renderAttackIndicator(100, 100, 30, 0.5, 50, 0, 1, 100);
    
    expect(mockGraphics.clear).toHaveBeenCalled();
    // Should call beginPath/moveTo/lineTo for sparks
    expect(mockGraphics.beginPath).toHaveBeenCalled();
    expect(mockGraphics.moveTo).toHaveBeenCalled();
    expect(mockGraphics.lineTo).toHaveBeenCalled();
    expect(mockGraphics.strokePath).toHaveBeenCalled();
  });

  it('should render magnet range when magnetLevel > 0', () => {
    cursorRenderer.renderAttackIndicator(100, 100, 30, 0.5, 50, 1, 0, 0);
    
    // One for magnet, one for attack indicator
    expect(mockGraphics.strokeCircle).toHaveBeenCalledTimes(2);
    expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(100, 100, 50); // Magnet
    expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(100, 100, 30); // Attack
  });
});
