import { describe, expect, it } from 'vitest';
import Phaser from 'phaser';
import {
  CursorPositionProvider,
  resolveCursorPosition,
} from '../src/scenes/game/CursorPositionProvider';

describe('CursorPositionProvider', () => {
  it('should prioritize explicit provider', () => {
    const scene = {
      input: {
        activePointer: { worldX: 10, worldY: 20 },
      },
    } as unknown as Phaser.Scene;

    const provider: CursorPositionProvider = {
      getCursorPosition: () => ({ x: 300, y: 400 }),
    };

    expect(resolveCursorPosition(scene, provider)).toEqual({ x: 300, y: 400 });
  });

  it('should use scene cursor provider when explicit provider is missing', () => {
    const scene = {
      getCursorPosition: () => ({ x: 120, y: 240 }),
      input: {
        activePointer: { worldX: 1, worldY: 2 },
      },
    } as unknown as Phaser.Scene;

    expect(resolveCursorPosition(scene)).toEqual({ x: 120, y: 240 });
  });

  it('should fallback to active pointer coordinates', () => {
    const scene = {
      input: {
        activePointer: { worldX: 55, worldY: 77 },
      },
    } as unknown as Phaser.Scene;

    expect(resolveCursorPosition(scene)).toEqual({ x: 55, y: 77 });
  });

  it('should return origin when pointer is unavailable', () => {
    const scene = {
      input: {},
    } as unknown as Phaser.Scene;

    expect(resolveCursorPosition(scene)).toEqual({ x: 0, y: 0 });
  });
});
