import Phaser from 'phaser';
import { COLORS } from '../data/constants';

export interface DishVisualState {
  size: number;
  baseColor: number;
  currentHp: number;
  maxHp: number;
  isHovered: boolean;
  isBeingPulled: boolean;
  pullPhase: number;
  hitFlashPhase: number;
  isFrozen: boolean;
  wobblePhase: number;
  blinkPhase: number;
}

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
    graphics.clear();
    this.renderRegularDish(graphics, state);
  }

  public static renderDangerDish(
    graphics: Phaser.GameObjects.Graphics,
    state: Pick<DishVisualState, 'size' | 'blinkPhase'>
  ): void {
    const pulse = Math.sin(state.blinkPhase * 2) * 0.15 + 0.85;
    const baseRadius = state.size * 0.7;

    graphics.clear();
    graphics.fillStyle(0x1a1a1a, 1);
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
    const wobble = Math.sin(state.wobblePhase) * 2;

    let pullOffsetX = 0;
    let pullOffsetY = 0;
    if (state.isBeingPulled) {
      pullOffsetX = Math.sin(state.pullPhase * 2) * 2;
      pullOffsetY = Math.cos(state.pullPhase * 1.5) * 2;
    }

    const flashWhite = state.hitFlashPhase > 0 ? state.hitFlashPhase : 0;
    const hpRatio = state.maxHp > 0 ? state.currentHp / state.maxHp : 1;
    let displayColor = this.lerpColor(COLORS.RED, state.baseColor, hpRatio);

    if (state.isFrozen) {
      displayColor = 0x88ccff;
    }

    if (state.isBeingPulled) {
      const magnetAlpha = 0.15;
      graphics.fillStyle(COLORS.MAGENTA, magnetAlpha);
      graphics.fillCircle(pullOffsetX, pullOffsetY, state.size + 15);
    }

    const glowAlpha = state.isHovered ? 0.4 : 0.2;
    graphics.fillStyle(displayColor, glowAlpha);
    graphics.fillCircle(pullOffsetX, pullOffsetY, state.size + 10 + wobble);

    const fillAlpha = flashWhite > 0 ? 0.7 + flashWhite * 0.3 : 0.7;
    const fillColor =
      flashWhite > 0 ? this.lerpColor(displayColor, COLORS.WHITE, flashWhite) : displayColor;
    graphics.fillStyle(fillColor, fillAlpha);
    this.tracePolygonPath(graphics, pullOffsetX, pullOffsetY, state.size + wobble, sides);
    graphics.fillPath();

    const lineWidth = state.isHovered ? 4 : 3;
    graphics.lineStyle(lineWidth, displayColor, 1);
    this.tracePolygonPath(graphics, pullOffsetX, pullOffsetY, state.size + wobble, sides);
    graphics.strokePath();

    graphics.lineStyle(2, COLORS.WHITE, 0.4);
    graphics.strokeCircle(pullOffsetX, pullOffsetY, state.size * 0.5);

    if (state.currentHp < state.maxHp) {
      this.drawHpBar(graphics, state.size, state.currentHp, state.maxHp, pullOffsetX, pullOffsetY);
    }

    graphics.lineStyle(1, COLORS.GREEN, 0.5);
    graphics.strokeCircle(pullOffsetX, pullOffsetY, state.size);
  }

  private static drawHpBar(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    currentHp: number,
    maxHp: number,
    offsetX: number,
    offsetY: number
  ): void {
    const barWidth = size * 1.6;
    const barHeight = 6;
    const barY = -size - 15 + offsetY;

    graphics.fillStyle(0x000000, 0.6);
    graphics.fillRect(-barWidth / 2 - 1 + offsetX, barY - 1, barWidth + 2, barHeight + 2);

    const hpRatio = Math.max(0, currentHp / maxHp);
    const hpColor = this.lerpColor(COLORS.RED, COLORS.GREEN, hpRatio);
    graphics.fillStyle(hpColor, 1);
    graphics.fillRect(-barWidth / 2 + offsetX, barY, barWidth * hpRatio, barHeight);

    graphics.lineStyle(1, COLORS.WHITE, 0.5);
    graphics.strokeRect(-barWidth / 2 + offsetX, barY, barWidth, barHeight);
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
