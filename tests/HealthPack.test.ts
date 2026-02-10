import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';

const { mockEmit, mockRender } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockRender: vi.fn(),
}));

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
    }),
  },
  GameEvents: {
    HEALTH_PACK_SPAWNED: 'healthPack:spawned',
    HEALTH_PACK_PASSING: 'healthPack:passing',
    HEALTH_PACK_COLLECTED: 'healthPack:collected',
    HEALTH_PACK_MISSED: 'healthPack:missed',
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    healthPack: {
      moveSpeed: 200,
      hitboxSize: 35,
      visualSize: 28,
      preMissWarningDistance: 120,
    },
    gameConfig: {
      screen: {
        height: 720,
      },
    },
  },
}));

vi.mock('../src/effects/HealthPackRenderer', () => ({
  HealthPackRenderer: {
    render: mockRender,
  },
}));

const { phaserMock } = vi.hoisted(() => {
  type Listener = () => void;

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
    private listeners = new Map<string, Listener[]>();

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

    setInteractive(_shape: unknown, _contains: unknown): this {
      return this;
    }

    disableInteractive(): this {
      return this;
    }

    on(eventName: string, callback: Listener): this {
      const handlers = this.listeners.get(eventName) ?? [];
      handlers.push(callback);
      this.listeners.set(eventName, handlers);
      return this;
    }

    removeAllListeners(): this {
      this.listeners.clear();
      return this;
    }
  }

  class MockCircle {
    constructor(_x: number, _y: number, _radius: number) {}

    static Contains(): boolean {
      return true;
    }
  }

  return {
    phaserMock: {
      GameObjects: {
        Container: MockContainer,
      },
      Geom: {
        Circle: MockCircle,
      },
    },
  };
});

vi.mock('phaser', () => ({
  default: phaserMock,
}));

import { HealthPack } from '../src/entities/HealthPack';
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

describe('HealthPack', () => {
  beforeEach(() => {
    mockEmit.mockClear();
    mockRender.mockClear();
  });

  it('spawns below screen with offscreen margin and emits spawn event', () => {
    const pack = new HealthPack(createScene(), 0, 0);

    pack.spawn(120);

    expect(pack.x).toBe(120);
    expect(pack.y).toBe(760);
    expect(mockEmit).toHaveBeenCalledWith(GameEvents.HEALTH_PACK_SPAWNED, { x: 120, y: 760 });
  });

  it('moves upward over time using moveSpeed', () => {
    const pack = new HealthPack(createScene(), 0, 0);
    pack.spawn(120);
    const initialY = pack.y;

    pack.update(1000);

    expect(pack.y).toBe(initialY - 200);
  });

  it('emits passing warning once before moving out of the top boundary', () => {
    const pack = new HealthPack(createScene(), 0, 0);
    pack.spawn(120);
    mockEmit.mockClear();
    pack.y = 80;

    pack.update(16);
    pack.update(16);

    const warningCalls = mockEmit.mock.calls.filter(
      (call) => call[0] === GameEvents.HEALTH_PACK_PASSING
    );
    expect(warningCalls).toHaveLength(1);
    expect(warningCalls[0][1]).toEqual(
      expect.objectContaining({
        x: 120,
      })
    );
  });

  it('emits missed and deactivates when moving beyond top boundary', () => {
    const pack = new HealthPack(createScene(), 0, 0);
    pack.spawn(120);
    mockEmit.mockClear();
    pack.y = -41;

    pack.update(16);

    expect(mockEmit).toHaveBeenCalledWith(GameEvents.HEALTH_PACK_MISSED);
    expect(pack.active).toBe(false);
    expect(pack.visible).toBe(false);
  });

  it('does not move or emit events while inactive', () => {
    const pack = new HealthPack(createScene(), 0, 0);
    pack.spawn(120);
    pack.deactivate();
    const yBeforeUpdate = pack.y;
    mockEmit.mockClear();

    pack.update(1000);

    expect(pack.y).toBe(yBeforeUpdate);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
