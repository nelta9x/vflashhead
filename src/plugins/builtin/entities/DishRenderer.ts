import Phaser from 'phaser';
import { COLORS } from '../../../data/constants';

export interface DishVisualState {
  size: number;
  baseColor: number;
  currentHp: number;
  maxHp: number;
  isFrozen: boolean;
  blinkPhase: number;
}

/**
 * Purpose: Per-graphics dirty state cache for DishRenderer skip-redraw optimization.
 * Boundary: Only tracks string keys; does not manage graphics lifecycle.
 */
const dishStateCache = new WeakMap<Phaser.GameObjects.Graphics, string>();
const dangerDishStateCache = new WeakMap<Phaser.GameObjects.Graphics, string>();

export class DishRenderer {
  public static renderMenuDish(
    graphics: Phaser.GameObjects.Graphics,
    radius: number,
    color: number
  ): void {
    graphics.clear();
    graphics.lineStyle(2, color, 1);
    graphics.fillStyle(color, 0.3);
    this.tracePolygonPath(graphics, 0, 0, radius, 8);
    graphics.fillPath();
    graphics.strokePath();
  }

  public static renderDish(graphics: Phaser.GameObjects.Graphics, state: DishVisualState): void {
    const stateKey = `${state.size}|${state.baseColor}|${state.currentHp}|${state.maxHp}|${state.isFrozen ? 1 : 0}|${(state.blinkPhase * 100) | 0}`;
    if (dishStateCache.get(graphics) === stateKey) return;
    dishStateCache.set(graphics, stateKey);

    graphics.clear();
    this.renderRegularDish(graphics, state);
  }

  public static renderDangerDish(
    graphics: Phaser.GameObjects.Graphics,
    state: Pick<DishVisualState, 'size' | 'blinkPhase'>
  ): void {
    const stateKey = `${state.size}|${(state.blinkPhase * 100) | 0}`;
    if (dangerDishStateCache.get(graphics) === stateKey) return;
    dangerDishStateCache.set(graphics, stateKey);
    const pulse = Math.sin(state.blinkPhase * 2) * 0.15 + 0.85;
    const baseRadius = state.size * 0.7;

    graphics.clear();
    graphics.fillStyle(COLORS.DANGER_DISH_BG, 1);
    graphics.fillCircle(0, 0, baseRadius);

    graphics.lineStyle(4, COLORS.RED, pulse);
    graphics.strokeCircle(0, 0, baseRadius);

    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 - Math.PI / 8;
      const innerRadius = baseRadius * 0.8;
      const outerRadius = baseRadius + 12;

      const x1 = Math.cos(angle - 0.15) * innerRadius;
      const y1 = Math.sin(angle - 0.15) * innerRadius;
      const x2 = Math.cos(angle + 0.15) * innerRadius;
      const y2 = Math.sin(angle + 0.15) * innerRadius;
      const x3 = Math.cos(angle) * outerRadius;
      const y3 = Math.sin(angle) * outerRadius;

      graphics.fillStyle(COLORS.RED, pulse);
      graphics.beginPath();
      graphics.moveTo(x1, y1);
      graphics.lineTo(x3, y3);
      graphics.lineTo(x2, y2);
      graphics.closePath();
      graphics.fillPath();
    }

    graphics.fillStyle(COLORS.RED, pulse);
    graphics.fillCircle(0, 0, 8);

    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillCircle(-5, -5, 4);
  }

  private static renderRegularDish(
    graphics: Phaser.GameObjects.Graphics,
    state: DishVisualState
  ): void {
    const sides = 8;
    const hpRatio = state.maxHp > 0 ? state.currentHp / state.maxHp : 1;
    let displayColor = this.lerpColor(COLORS.RED, state.baseColor, hpRatio);

    if (state.isFrozen) {
      displayColor = COLORS.FROZEN;
    }

    // Glow
    graphics.fillStyle(displayColor, 0.2);
    graphics.fillCircle(0, 0, state.size + 10);

    // Fill octagon
    graphics.fillStyle(displayColor, 0.7);
    this.tracePolygonPath(graphics, 0, 0, state.size, sides);
    graphics.fillPath();

    // Stroke octagon
    graphics.lineStyle(3, displayColor, 1);
    this.tracePolygonPath(graphics, 0, 0, state.size, sides);
    graphics.strokePath();

    // HP bar (only when damaged)
    if (state.currentHp < state.maxHp) {
      this.drawHpBar(graphics, state.size, state.currentHp, state.maxHp);
    }
  }

  private static drawHpBar(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    currentHp: number,
    maxHp: number
  ): void {
    const barWidth = size * 1.6;
    const barHeight = 6;
    const barY = -size - 15;

    graphics.fillStyle(0x000000, 0.6);
    graphics.fillRect(-barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);

    const hpRatio = Math.max(0, currentHp / maxHp);
    const hpColor = this.lerpColor(COLORS.RED, COLORS.GREEN, hpRatio);
    graphics.fillStyle(hpColor, 1);
    graphics.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);

    graphics.lineStyle(1, COLORS.WHITE, 0.5);
    graphics.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
  }

  private static tracePolygonPath(
    graphics: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    sides: number
  ): void {
    graphics.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
    graphics.closePath();
  }

  private static lerpColor(colorA: number, colorB: number, t: number): number {
    const rA = (colorA >> 16) & 0xff;
    const gA = (colorA >> 8) & 0xff;
    const bA = colorA & 0xff;

    const rB = (colorB >> 16) & 0xff;
    const gB = (colorB >> 8) & 0xff;
    const bB = colorB & 0xff;

    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const b = Math.round(bA + (bB - bA) * t);

    return (r << 16) | (g << 8) | b;
  }
}
