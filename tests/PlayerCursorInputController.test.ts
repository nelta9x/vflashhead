import { describe, expect, it, vi } from 'vitest';
import { PlayerCursorInputController } from '../src/systems/PlayerCursorInputController';

function createMockKey() {
  const key = {
    isDown: false,
    reset: vi.fn(() => {
      key.isDown = false;
    }),
  };
  return key;
}

function createKeyboardHarness() {
  const cursorKeys = {
    left: createMockKey(),
    right: createMockKey(),
    up: createMockKey(),
    down: createMockKey(),
  };

  const wasdKeys = {
    W: createMockKey(),
    A: createMockKey(),
    S: createMockKey(),
    D: createMockKey(),
  };

  const keydownHandlers: Array<(event: KeyboardEvent) => void> = [];
  const resetKeysSpy = vi.fn();

  const plugin = {
    createCursorKeys: () => cursorKeys,
    addKey: (key: string) => wasdKeys[key as keyof typeof wasdKeys],
    on: (event: string, handler: (event: KeyboardEvent) => void) => {
      if (event === 'keydown') {
        keydownHandlers.push(handler);
      }
    },
    off: (event: string, handler: (event: KeyboardEvent) => void) => {
      if (event !== 'keydown') return;
      const index = keydownHandlers.indexOf(handler);
      if (index >= 0) {
        keydownHandlers.splice(index, 1);
      }
    },
    resetKeys: resetKeysSpy,
  };

  return {
    plugin,
    cursorKeys,
    wasdKeys,
    resetKeysSpy,
    emitKeyDown: (code: string, repeat: boolean = false) => {
      for (const handler of keydownHandlers) {
        handler({ code, repeat } as KeyboardEvent);
      }
    },
  };
}

describe('PlayerCursorInputController', () => {
  it('ramps keyboard axis from 0 to 1 while key is held', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    harness.cursorKeys.right.isDown = true;
    harness.emitKeyDown('ArrowRight');

    const first = controller.getKeyboardAxis(45, 1000);
    expect(first.x).toBeCloseTo(0.5, 5);
    expect(first.y).toBe(0);
    expect(first.isMoving).toBe(true);

    const second = controller.getKeyboardAxis(45, 1045);
    expect(second.x).toBeCloseTo(1, 5);
    expect(second.y).toBe(0);
    expect(second.isMoving).toBe(true);
  });

  it('drops axis to zero immediately on key release', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    harness.cursorKeys.right.isDown = true;
    controller.getKeyboardAxis(90, 1000);

    harness.cursorKeys.right.isDown = false;
    const released = controller.getKeyboardAxis(16, 1016);

    expect(released).toEqual({ x: 0, y: 0, isMoving: false });
  });

  it('keeps keyboard movement blocked during pointer priority window', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    harness.cursorKeys.left.isDown = true;
    controller.onPointerInput(1000);

    expect(controller.shouldUseKeyboardMovement(1050)).toBe(false);
    const blocked = controller.getKeyboardAxis(16, 1050);
    expect(blocked).toEqual({ x: 0, y: 0, isMoving: false });

    expect(controller.shouldUseKeyboardMovement(1121)).toBe(true);
    const allowed = controller.getKeyboardAxis(45, 1121);
    expect(allowed.x).toBeCloseTo(-0.5, 5);
    expect(allowed.y).toBe(0);
    expect(allowed.isMoving).toBe(true);
  });

  it('resets keyboard plugin, movement keys, and axis state', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    harness.cursorKeys.up.isDown = true;
    controller.getKeyboardAxis(90, 1000);

    controller.resetMovementInput(1001);

    expect(harness.resetKeysSpy).toHaveBeenCalledTimes(1);
    expect(harness.cursorKeys.left.reset).toHaveBeenCalledTimes(1);
    expect(harness.cursorKeys.right.reset).toHaveBeenCalledTimes(1);
    expect(harness.cursorKeys.up.reset).toHaveBeenCalledTimes(1);
    expect(harness.cursorKeys.down.reset).toHaveBeenCalledTimes(1);
    expect(harness.wasdKeys.W.reset).toHaveBeenCalledTimes(1);
    expect(harness.wasdKeys.A.reset).toHaveBeenCalledTimes(1);
    expect(harness.wasdKeys.S.reset).toHaveBeenCalledTimes(1);
    expect(harness.wasdKeys.D.reset).toHaveBeenCalledTimes(1);
    expect(controller.getKeyboardAxis(16, 1010)).toEqual({ x: 0, y: 0, isMoving: false });
  });

  it('resets axis baseline before ramping when direction flips', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    harness.cursorKeys.right.isDown = true;
    controller.getKeyboardAxis(90, 1000);

    harness.cursorKeys.right.isDown = false;
    harness.cursorKeys.left.isDown = true;
    const reversed = controller.getKeyboardAxis(45, 1045);

    expect(reversed.x).toBeCloseTo(-0.5, 5);
    expect(reversed.y).toBe(0);
    expect(reversed.isMoving).toBe(true);
  });

  it('key repeat events do not bypass pointer priority window', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    harness.cursorKeys.up.isDown = true;
    harness.emitKeyDown('ArrowUp');

    // Pointer input sets lastInputDevice to 'pointer' and starts priority window
    controller.onPointerInput(1000);

    // Repeat keydown should NOT flip lastInputDevice back to 'keyboard'
    harness.emitKeyDown('ArrowUp', true);

    // Still within pointer priority window → keyboard movement should be blocked
    expect(controller.shouldUseKeyboardMovement(1050)).toBe(false);
  });

  it('initial keypress still switches to keyboard immediately', () => {
    const harness = createKeyboardHarness();
    const controller = new PlayerCursorInputController({
      pointerPriorityMs: 120,
      keyboardAxisRampUpMs: 90,
    });
    controller.bindKeyboard(harness.plugin as never);

    controller.onPointerInput(1000);

    // Fresh (non-repeat) keydown switches device to keyboard
    harness.cursorKeys.right.isDown = true;
    harness.emitKeyDown('ArrowRight', false);

    // lastInputDevice is now 'keyboard', so it bypasses pointer priority
    expect(controller.shouldUseKeyboardMovement(1050)).toBe(true);
  });
});
