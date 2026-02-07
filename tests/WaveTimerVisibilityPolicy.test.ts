import { describe, it, expect } from 'vitest';
import { WaveTimerVisibilityPolicy } from '../src/ui/hud/WaveTimerVisibilityPolicy';

describe('WaveTimerVisibilityPolicy', () => {
  it('shows wave/timer during upgrade selection', () => {
    const visible = WaveTimerVisibilityPolicy.shouldShow({
      isUpgradeSelectionVisible: true,
      hoverArea: null,
      cursorX: 0,
      cursorY: 0,
    });

    expect(visible).toBe(true);
  });

  it('shows wave/timer when cursor is inside hover area', () => {
    const visible = WaveTimerVisibilityPolicy.shouldShow({
      isUpgradeSelectionVisible: false,
      hoverArea: {
        contains: (x: number, y: number) => x >= 10 && x <= 20 && y >= 5 && y <= 15,
      },
      cursorX: 15,
      cursorY: 10,
    });

    expect(visible).toBe(true);
  });

  it('hides wave/timer when there is no hover area and not upgrading', () => {
    const visible = WaveTimerVisibilityPolicy.shouldShow({
      isUpgradeSelectionVisible: false,
      hoverArea: null,
      cursorX: 15,
      cursorY: 10,
    });

    expect(visible).toBe(false);
  });
});
