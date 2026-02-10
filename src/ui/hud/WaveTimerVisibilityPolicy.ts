export interface HoverArea {
  contains(x: number, y: number): boolean;
}

export interface WaveTimerVisibilityInput {
  isUpgradeSelectionVisible: boolean;
  isEscPaused: boolean;
  hoverArea: HoverArea | null;
  cursorX: number;
  cursorY: number;
}

export class WaveTimerVisibilityPolicy {
  static shouldShow(input: WaveTimerVisibilityInput): boolean {
    if (input.isUpgradeSelectionVisible || input.isEscPaused) {
      return true;
    }

    if (!input.hoverArea) {
      return false;
    }

    return input.hoverArea.contains(input.cursorX, input.cursorY);
  }
}
