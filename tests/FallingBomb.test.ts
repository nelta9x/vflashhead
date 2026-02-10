import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';

const { mockEmit, mockRenderDangerDish } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockRenderDangerDish: vi.fn(),
}));

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
    }),
  },
  GameEvents: {
    FALLING_BOMB_SPAWNED: 'fallingBomb:spawned',
    FALLING_BOMB_DESTROYED: 'fallingBomb:destroyed',
    FALLING_BOMB_MISSED: 'fallingBomb:missed',
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    fallingBomb: {
      moveSpeed: 80,
      hitboxSize: 30,
      visualSize: 24,
    },
    gameConfig: {
      screen: {
        height: 720,
      },
    },
  },
}));

vi.mock('../src/effects/DishRenderer', () => ({
  DishRenderer: {
    renderDangerDish: mockRenderDangerDish,
  },
}));

const { phaserMock } = vi.hoisted(() => {
  class MockContainer {
    public x: number;
    public y: number;
    public active = false;
    public visible = true;
    public alpha = 1;
    public scaleX = 1;
    public scaleY = 1;
    public scene: {
      add: {
        existing: (...args: unknown[]) => unknown;
        graphics: (...args: unknown[]) => unknown;
      };
      tweens: {
        add: (...args: unknown[]) => unknown;
      };
    };

    constructor(
      scene: {
        add: {
          existing: (...args: unknown[]) => unknown;
          graphics: (...args: unknown[]) => unknown;
        };
        tweens: {
          add: (...args: unknown[]) => unknown;
        };
      },
      x: number,
      y: number
    ) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    add(_child: unknown): this {
      return this;
    }

    setVisible(visible: boolean): this {
      this.visible = visible;
      return this;
    }

    setActive(active: boolean): this {
      this.active = active;
      return this;
    }

    setAlpha(alpha: number): this {
      this.alpha = alpha;
      return this;
    }

    setScale(scale: number): this {
      this.scaleX = scale;
      this.scaleY = scale;
      return this;
    }

    setPosition(x: number, y: number): this {
      this.x = x;
      this.y = y;
      return this;
    }
  }

  return {
    phaserMock: {
      GameObjects: {
        Container: MockContainer,
      },
    },
  };
});

vi.mock('phaser', () => ({
  default: phaserMock,
}));

import { FallingBomb } from '../src/entities/FallingBomb';
import { GameEvents } from '../src/utils/EventBus';

function createScene(): Phaser.Scene {
  const scene = {
    add: {
      existing: vi.fn(),
      graphics: vi.fn(() => ({})),
    },
    tweens: {
      add: vi.fn(),
    },
  };

  return scene as unknown as Phaser.Scene;
}

describe('FallingBomb', () => {
  beforeEach(() => {
    mockEmit.mockClear();
    mockRenderDangerDish.mockClear();
  });

  it('spawns above screen with offscreen margin and emits spawn event', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);

    bomb.spawn(120);

    expect(bomb.x).toBe(120);
    expect(bomb.y).toBe(-40);
    expect(mockEmit).toHaveBeenCalledWith(GameEvents.FALLING_BOMB_SPAWNED, {
      x: 120,
      y: -40,
      moveSpeed: 80,
    });
  });

  it('moves downward over time using moveSpeed', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    bomb.spawn(120);
    const initialY = bomb.y;

    bomb.update(1000);

    expect(bomb.y).toBe(initialY + 80);
  });

  it('emits missed and deactivates when moving beyond bottom boundary', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    bomb.spawn(120);
    mockEmit.mockClear();
    bomb.y = 761;

    bomb.update(16);

    expect(mockEmit).toHaveBeenCalledWith(GameEvents.FALLING_BOMB_MISSED, { bomb });
    expect(bomb.active).toBe(false);
    expect(bomb.visible).toBe(false);
  });

  it('does not move or emit events while inactive', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    bomb.spawn(120);
    bomb.deactivate();
    const yBeforeUpdate = bomb.y;
    mockEmit.mockClear();

    bomb.update(1000);

    expect(bomb.y).toBe(yBeforeUpdate);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('forceDestroy emits destroyed event with byAbility flag', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    bomb.spawn(100);
    mockEmit.mockClear();

    bomb.forceDestroy(true);

    expect(mockEmit).toHaveBeenCalledWith(GameEvents.FALLING_BOMB_DESTROYED, {
      bomb,
      x: 100,
      y: -40,
      byAbility: true,
    });
    expect(bomb.active).toBe(false);
  });

  it('forceDestroy with byAbility=false emits correct payload', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    bomb.spawn(200);
    mockEmit.mockClear();

    bomb.forceDestroy(false);

    expect(mockEmit).toHaveBeenCalledWith(GameEvents.FALLING_BOMB_DESTROYED, {
      bomb,
      x: 200,
      y: -40,
      byAbility: false,
    });
  });

  it('isDangerous returns true', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    expect(bomb.isDangerous()).toBe(true);
  });

  it('isFullySpawned returns false before tween completes', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    bomb.spawn(100);
    expect(bomb.isFullySpawned()).toBe(false);
  });

  it('getSize returns hitboxSize from config', () => {
    const bomb = new FallingBomb(createScene(), 0, 0);
    expect(bomb.getSize()).toBe(30);
  });
});
