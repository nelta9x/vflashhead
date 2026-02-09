export interface HudFrameContext {
  cursorX: number;
  cursorY: number;
  isUpgradeSelectionVisible: boolean;
  isEscPaused: boolean;
}

export interface HudInteractionState {
  isDockBarHovered: boolean;
  shouldPauseGame: boolean;
  dockPauseProgress: number;
}
