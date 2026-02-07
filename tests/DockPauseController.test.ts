import { describe, expect, it } from 'vitest';
import { DockPauseController } from '../src/ui/hud/DockPauseController';

describe('DockPauseController', () => {
  it('requires 1.2s hover before pause', () => {
    const controller = new DockPauseController(1200);

    let state = controller.update({ isEnabled: true, isHovered: true, deltaMs: 400 });
    expect(state.shouldPauseGame).toBe(false);
    expect(state.progress).toBeCloseTo(1 / 3, 5);

    state = controller.update({ isEnabled: true, isHovered: true, deltaMs: 799 });
    expect(state.shouldPauseGame).toBe(false);
    expect(state.progress).toBeLessThan(1);

    state = controller.update({ isEnabled: true, isHovered: true, deltaMs: 1 });
    expect(state.shouldPauseGame).toBe(true);
    expect(state.progress).toBe(1);
  });

  it('resets progress when hover is lost', () => {
    const controller = new DockPauseController(1200);

    controller.update({ isEnabled: true, isHovered: true, deltaMs: 600 });
    const resetState = controller.update({ isEnabled: true, isHovered: false, deltaMs: 16 });

    expect(resetState.shouldPauseGame).toBe(false);
    expect(resetState.progress).toBe(0);
    expect(resetState.isCharging).toBe(false);
  });

  it('does not charge while disabled', () => {
    const controller = new DockPauseController(1200);

    const state = controller.update({ isEnabled: false, isHovered: true, deltaMs: 1200 });

    expect(state.shouldPauseGame).toBe(false);
    expect(state.progress).toBe(0);
  });
});
