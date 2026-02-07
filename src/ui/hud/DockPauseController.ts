export interface DockPauseUpdateInput {
  isEnabled: boolean;
  isHovered: boolean;
  deltaMs: number;
}

export interface DockPauseState {
  shouldPauseGame: boolean;
  progress: number;
  isCharging: boolean;
}

export class DockPauseController {
  private readonly holdDurationMs: number;
  private holdMs = 0;

  constructor(holdDurationMs: number) {
    this.holdDurationMs = Math.max(1, holdDurationMs);
  }

  public update(input: DockPauseUpdateInput): DockPauseState {
    if (!input.isEnabled || !input.isHovered) {
      this.holdMs = 0;
      return {
        shouldPauseGame: false,
        progress: 0,
        isCharging: false,
      };
    }

    this.holdMs = Math.min(this.holdDurationMs, this.holdMs + Math.max(0, input.deltaMs));
    const progress = this.holdMs / this.holdDurationMs;

    return {
      shouldPauseGame: progress >= 1,
      progress,
      isCharging: progress > 0,
    };
  }
}
