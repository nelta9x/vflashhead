import Phaser from 'phaser';
import { COLORS } from '../../../data/constants';

export interface HealthPackVisualState {
  size: number;
  pulsePhase: number;
}

/**
 * Purpose: Per-graphics dirty state cache for HealthPackRenderer skip-redraw optimization.
 * Boundary: Only tracks string keys; does not manage graphics lifecycle.
 */
const healthPackStateCache = new WeakMap<Phaser.GameObjects.Graphics, string>();

export class HealthPackRenderer {
  public static render(
    graphics: Phaser.GameObjects.Graphics,
    state: HealthPackVisualState
  ): void {
    // Quantize pulsePhase to ~50 steps per radian to reduce redraws
    const stateKey = `${state.size}|${(state.pulsePhase * 50) | 0}`;
    if (healthPackStateCache.get(graphics) === stateKey) return;
    healthPackStateCache.set(graphics, stateKey);

    graphics.clear();

    const pulse = 1 + Math.sin(state.pulsePhase) * 0.1;
    const crossWidth = state.size * 0.35;
    const crossLength = state.size * 0.8;

    graphics.fillStyle(COLORS.GREEN, 0.3);
    graphics.fillCircle(0, 0, state.size * pulse + 8);

    graphics.fillStyle(COLORS.GREEN, 0.5);
    graphics.fillCircle(0, 0, state.size * pulse);

    graphics.fillStyle(COLORS.WHITE, 1);
    graphics.fillRect(
      (-crossLength * pulse) / 2,
      (-crossWidth * pulse) / 2,
      crossLength * pulse,
      crossWidth * pulse
    );
    graphics.fillRect(
      (-crossWidth * pulse) / 2,
      (-crossLength * pulse) / 2,
      crossWidth * pulse,
      crossLength * pulse
    );

    graphics.lineStyle(2, COLORS.GREEN, 1);
    graphics.strokeCircle(0, 0, state.size * pulse);
  }
}
