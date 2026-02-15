import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneInputAdapter } from '../src/scenes/game/SceneInputAdapter';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Events: {
        GAME_OUT: 'gameout',
      },
    },
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown',
      },
    },
  },
}));

type Listener = (...args: unknown[]) => void;

function createEventEmitterHarness() {
  const listeners = new Map<string, Listener[]>();

  return {
    listeners,
    on: vi.fn((event: string, handler: Listener) => {
      const current = listeners.get(event) ?? [];
      current.push(handler);
      listeners.set(event, current);
    }),
    off: vi.fn((event: string, handler: Listener) => {
      const current = listeners.get(event) ?? [];
      listeners.set(
        event,
        current.filter((candidate) => candidate !== handler)
      );
    }),
    once: vi.fn((event: string, handler: Listener) => {
      const current = listeners.get(event) ?? [];
      current.push(handler);
      listeners.set(event, current);
    }),
  };
}

describe('SceneInputAdapter', () => {
  const globalWithDom = globalThis as unknown as {
    window?: EventTarget;
    document?: (EventTarget & { hidden: boolean });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalWithDom.window = new EventTarget();
    globalWithDom.document = Object.assign(new EventTarget(), { hidden: false });
  });

  it('binds pointer/keyboard/safety handlers and forwards events', () => {
    const inputHarness = createEventEmitterHarness();
    const keyboardHarness = createEventEmitterHarness();
    const sceneEventsHarness = createEventEmitterHarness();

    const scene = {
      input: {
        activePointer: { worldX: 10, worldY: 20 },
        keyboard: keyboardHarness,
        on: inputHarness.on,
        off: inputHarness.off,
      },
      events: {
        once: sceneEventsHarness.once,
        off: sceneEventsHarness.off,
      },
    };

    const inputController = {
      bindKeyboard: vi.fn(),
      unbindKeyboard: vi.fn(),
      onPointerInput: vi.fn(),
    };
    const applyCursorPosition = vi.fn();
    const resetMovementInput = vi.fn();
    const togglePause = vi.fn();

    const adapter = new SceneInputAdapter({
      scene: scene as never,
      inputController: inputController as never,
      getInputTimestamp: () => 1234,
      applyCursorPosition,
      resetMovementInput,
      isGameOver: () => false,
      togglePause,
      toggleFps: vi.fn(),
    });

    adapter.setup();

    expect(inputController.bindKeyboard).toHaveBeenCalledWith(scene.input.keyboard);
    expect(applyCursorPosition).toHaveBeenCalledWith(10, 20);
    expect(inputController.onPointerInput).toHaveBeenCalledWith(1234);

    const pointerMove = (inputHarness.listeners.get('pointermove') ?? [])[0];
    expect(pointerMove).toBeDefined();
    pointerMove({ worldX: 30, worldY: 40 });
    expect(applyCursorPosition).toHaveBeenCalledWith(30, 40);

    const escHandler = (keyboardHarness.listeners.get('keydown-ESC') ?? [])[0];
    expect(escHandler).toBeDefined();
    escHandler();
    expect(togglePause).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('blur'));
    expect(resetMovementInput).toHaveBeenCalledTimes(1);

    if (globalWithDom.document) {
      globalWithDom.document.hidden = true;
      globalWithDom.document.dispatchEvent(new Event('visibilitychange'));
    }
    expect(resetMovementInput).toHaveBeenCalledTimes(2);

    const gameOutHandler = (inputHarness.listeners.get('gameout') ?? [])[0];
    expect(gameOutHandler).toBeDefined();
    gameOutHandler();
    expect(resetMovementInput).toHaveBeenCalledTimes(3);
  });

  it('tears down all listeners and keyboard bindings', () => {
    const inputHarness = createEventEmitterHarness();
    const keyboardHarness = createEventEmitterHarness();
    const sceneEventsHarness = createEventEmitterHarness();

    const scene = {
      input: {
        activePointer: { worldX: 0, worldY: 0 },
        keyboard: keyboardHarness,
        on: inputHarness.on,
        off: inputHarness.off,
      },
      events: {
        once: sceneEventsHarness.once,
        off: sceneEventsHarness.off,
      },
    };

    const inputController = {
      bindKeyboard: vi.fn(),
      unbindKeyboard: vi.fn(),
      onPointerInput: vi.fn(),
    };

    const adapter = new SceneInputAdapter({
      scene: scene as never,
      inputController: inputController as never,
      getInputTimestamp: () => 1000,
      applyCursorPosition: vi.fn(),
      resetMovementInput: vi.fn(),
      isGameOver: () => false,
      togglePause: vi.fn(),
      toggleFps: vi.fn(),
    });

    adapter.setup();
    adapter.teardown();

    expect(inputController.unbindKeyboard).toHaveBeenCalledTimes(1);
    expect(inputHarness.off).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(inputHarness.off).toHaveBeenCalledWith('gameout', expect.any(Function));
    expect(keyboardHarness.off).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    expect(sceneEventsHarness.off).toHaveBeenCalledWith('shutdown', expect.any(Function), adapter);
  });
});
