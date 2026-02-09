import Phaser from 'phaser';

export interface CursorPositionProvider {
  getCursorPosition(): { x: number; y: number };
}

export function resolveCursorPosition(
  scene: Phaser.Scene,
  provider?: CursorPositionProvider
): { x: number; y: number } {
  if (provider) {
    return provider.getCursorPosition();
  }

  const sceneWithCursorProvider = scene as Phaser.Scene & Partial<CursorPositionProvider>;
  if (typeof sceneWithCursorProvider.getCursorPosition === 'function') {
    return sceneWithCursorProvider.getCursorPosition();
  }

  const pointer = scene.input?.activePointer;
  if (pointer) {
    return { x: pointer.worldX, y: pointer.worldY };
  }

  return { x: 0, y: 0 };
}
