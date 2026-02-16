import Phaser from 'phaser';

interface GlowLevel {
  radius: number;
  alpha: number;
}

interface CoreVisualConfig {
  radius: number;
  color: number;
  initialAlpha: number;
  pulseSpeed: number;
  pulseIntensity: number;
  lightRadiusRatio: number;
  glowLevels: GlowLevel[];
}

interface ArmorVisualConfig {
  pieces: number;
  radius: number;
  innerRadius: number;
  rotationSpeed: number;
  gap: number;
  bodyColor: number;
  bodyAlpha: number;
  borderColor: number;
  depletedBodyColor: number;
  depletedBodyAlpha: number;
  depletedBorderColor: number;
  depletedBorderAlpha: number;
}

export interface SpaceshipVisualState {
  currentHp: number;
  maxHp: number;
  hitFlashPhase: number;
  timeElapsed: number;
  core: CoreVisualConfig;
  armor: ArmorVisualConfig;
}

export class SpaceshipRenderer {
  static render(
    graphics: Phaser.GameObjects.Graphics,
    state: SpaceshipVisualState,
  ): void {
    graphics.clear();

    const { core, armor, hitFlashPhase, timeElapsed } = state;
    const hpRatio = Phaser.Math.Clamp(state.currentHp / state.maxHp, 0, 1);
    const filledPieces = Math.ceil(hpRatio * armor.pieces);
    const dangerLevel = 1 - hpRatio;
    const flashWhite = hitFlashPhase > 0 ? hitFlashPhase : 0;

    this.drawCoreGlow(graphics, core, timeElapsed, dangerLevel, flashWhite);
    this.drawArmorGlow(graphics, core, armor, timeElapsed, filledPieces);
    this.drawCore(graphics, core, timeElapsed, dangerLevel, flashWhite);
    this.drawCoreLight(graphics, core, timeElapsed, flashWhite);
    this.drawArmor(graphics, armor, timeElapsed, filledPieces, flashWhite);
  }

  private static drawCoreGlow(
    graphics: Phaser.GameObjects.Graphics,
    core: CoreVisualConfig,
    timeElapsed: number,
    dangerLevel: number,
    flashWhite: number,
  ): void {
    const pulseFactor = 1 + Math.sin(timeElapsed * core.pulseSpeed) * 0.1;
    const color = flashWhite > 0 ? this.lerpColor(core.color, 0xffffff, flashWhite) : core.color;

    for (const level of core.glowLevels) {
      graphics.fillStyle(color, level.alpha * pulseFactor);
      graphics.fillCircle(
        0,
        0,
        core.radius * level.radius * (1 + dangerLevel * 0.2),
      );
    }
  }

  private static drawArmorGlow(
    graphics: Phaser.GameObjects.Graphics,
    core: CoreVisualConfig,
    armor: ArmorVisualConfig,
    timeElapsed: number,
    filledPieces: number,
  ): void {
    const pulseFactor = 1 + Math.sin(timeElapsed * core.pulseSpeed) * 0.1;
    const rotation = timeElapsed * armor.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / armor.pieces;
    const pieceSpan = this.getArmorPieceSpan(armor.gap, armor.pieces);
    const glowAlpha = 0.4 * pulseFactor;

    for (let i = 0; i < filledPieces; i++) {
      const centerAngle = rotation + (i + 0.5) * pieceAngle;
      const startAngle = centerAngle - pieceSpan * 0.5;
      const endAngle = centerAngle + pieceSpan * 0.5;
      if (endAngle <= startAngle) continue;

      graphics.lineStyle(4, armor.borderColor, glowAlpha);
      this.traceArmorPiecePath(graphics, startAngle, endAngle, armor.innerRadius, armor.radius);
      graphics.strokePath();
    }
  }

  private static drawCore(
    graphics: Phaser.GameObjects.Graphics,
    core: CoreVisualConfig,
    timeElapsed: number,
    dangerLevel: number,
    flashWhite: number,
  ): void {
    const corePulse =
      core.initialAlpha +
      Math.sin(timeElapsed * core.pulseSpeed * (1 + dangerLevel)) *
        core.pulseIntensity;
    const color = flashWhite > 0 ? this.lerpColor(core.color, 0xffffff, flashWhite) : core.color;
    const scale = 1 + dangerLevel * 0.1;

    graphics.fillStyle(color, corePulse);
    graphics.fillCircle(0, 0, core.radius * scale);
  }

  private static drawCoreLight(
    graphics: Phaser.GameObjects.Graphics,
    core: CoreVisualConfig,
    timeElapsed: number,
    flashWhite: number,
  ): void {
    const lightPulse = 0.8 + Math.sin(timeElapsed * core.pulseSpeed * 2) * 0.2;
    const color = flashWhite > 0 ? 0xffffff : 0xffffff;
    const lightRadius = core.radius * core.lightRadiusRatio;

    graphics.fillStyle(color, lightPulse);
    graphics.fillCircle(0, 0, lightRadius);
  }

  private static drawArmor(
    graphics: Phaser.GameObjects.Graphics,
    armor: ArmorVisualConfig,
    timeElapsed: number,
    filledPieces: number,
    flashWhite: number,
  ): void {
    const rotation = timeElapsed * armor.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / armor.pieces;
    const pieceSpan = this.getArmorPieceSpan(armor.gap, armor.pieces);

    for (let i = 0; i < armor.pieces; i++) {
      const centerAngle = rotation + (i + 0.5) * pieceAngle;
      const startAngle = centerAngle - pieceSpan * 0.5;
      const endAngle = centerAngle + pieceSpan * 0.5;
      if (endAngle <= startAngle) continue;

      const isFilled = i < filledPieces;

      let bodyColor: number;
      let bodyAlpha: number;
      let borderColor: number;
      let borderAlpha: number;

      if (isFilled) {
        bodyColor = flashWhite > 0
          ? this.lerpColor(armor.bodyColor, 0xffffff, flashWhite)
          : armor.bodyColor;
        bodyAlpha = armor.bodyAlpha;
        borderColor = flashWhite > 0
          ? this.lerpColor(armor.borderColor, 0xffffff, flashWhite)
          : armor.borderColor;
        borderAlpha = 1;
      } else {
        bodyColor = armor.depletedBodyColor;
        bodyAlpha = armor.depletedBodyAlpha;
        borderColor = armor.depletedBorderColor;
        borderAlpha = armor.depletedBorderAlpha;
      }

      const detailAlpha = isFilled ? 0.4 : Math.min(0.25, armor.depletedBorderAlpha * 0.7);

      graphics.fillStyle(bodyColor, bodyAlpha);
      this.traceArmorPiecePath(graphics, startAngle, endAngle, armor.innerRadius, armor.radius);
      graphics.fillPath();

      graphics.lineStyle(2, borderColor, borderAlpha);
      this.traceArmorPiecePath(graphics, startAngle, endAngle, armor.innerRadius, armor.radius);
      graphics.strokePath();

      graphics.lineStyle(1, borderColor, detailAlpha);
      const midRadius = (armor.radius + armor.innerRadius) / 2;
      graphics.beginPath();
      graphics.arc(0, 0, midRadius, startAngle, endAngle);
      graphics.strokePath();
    }
  }

  private static getArmorPieceSpan(gap: number, pieceCount: number): number {
    const safePieceCount = Math.max(1, pieceCount);
    const slotAngle = (Math.PI * 2) / safePieceCount;
    const maxGap = slotAngle * 0.45;
    const clampedGap = Phaser.Math.Clamp(gap, 0, maxGap);
    return Math.max(slotAngle - clampedGap * 2, slotAngle * 0.2);
  }

  private static traceArmorPiecePath(
    graphics: Phaser.GameObjects.Graphics,
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number,
  ): void {
    graphics.beginPath();
    graphics.arc(0, 0, outerRadius, startAngle, endAngle, false);
    graphics.lineTo(Math.cos(endAngle) * innerRadius, Math.sin(endAngle) * innerRadius);
    graphics.arc(0, 0, innerRadius, endAngle, startAngle, true);
    graphics.closePath();
  }

  static lerpColor(colorA: number, colorB: number, t: number): number {
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
