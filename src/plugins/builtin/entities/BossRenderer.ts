import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { COLORS } from '../../../data/constants';
import type { IBossRenderer, BossRendererState } from '../../types';

export type { BossRendererState } from '../../types';

export class BossRenderer implements IBossRenderer {
  private readonly scene: Phaser.Scene;
  private readonly core: Phaser.GameObjects.Arc;
  private readonly coreLight: Phaser.GameObjects.Arc;
  private readonly glowGraphics: Phaser.GameObjects.Graphics;
  private readonly armorGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, host: Phaser.GameObjects.Container) {
    this.scene = scene;
    const config = Data.boss.visual;

    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    host.add(this.glowGraphics);

    this.core = scene.add.arc(
      0,
      0,
      config.core.radius,
      0,
      360,
      false,
      COLORS.RED,
      config.core.initialAlpha
    );
    host.add(this.core);

    this.coreLight = scene.add.arc(0, 0, config.core.radius * 0.4, 0, 360, false, 0xffffff, 0.8);
    host.add(this.coreLight);

    this.armorGraphics = scene.add.graphics();
    host.add(this.armorGraphics);
  }

  public render(state: BossRendererState): void {
    const config = Data.boss.visual;
    const safeHpRatio = Phaser.Math.Clamp(state.hpRatio, 0, 1);
    const safeArmorPieceCount = Math.max(1, Math.floor(state.armorPieceCount));
    const safeFilledArmorPieceCount = Phaser.Math.Clamp(
      Math.floor(state.filledArmorPieceCount),
      0,
      safeArmorPieceCount
    );
    const dangerLevel = 1 - safeHpRatio;

    const corePulse =
      config.core.initialAlpha +
      Math.sin(state.timeElapsed * config.core.pulseSpeed * (1 + dangerLevel)) *
        config.core.pulseIntensity;
    this.core.setAlpha(corePulse);
    this.core.setScale(1 + dangerLevel * 0.1);

    const lightPulse = 0.8 + Math.sin(state.timeElapsed * config.core.pulseSpeed * 2) * 0.2;
    this.coreLight.setAlpha(lightPulse);

    this.glowGraphics.clear();
    this.armorGraphics.clear();

    this.drawGlow(state.timeElapsed, dangerLevel, safeArmorPieceCount, safeFilledArmorPieceCount);
    this.drawArmor(state.timeElapsed, safeArmorPieceCount, safeFilledArmorPieceCount);
  }

  public playHitFlash(flashDuration: number): void {
    this.scene.tweens.add({
      targets: [this.core, this.coreLight],
      fillAlpha: 1,
      duration: flashDuration,
      yoyo: true,
      onStart: () => {
        this.core.setFillStyle(0xffffff);
        this.coreLight.setFillStyle(0xffffff);
      },
      onComplete: () => {
        this.core.setFillStyle(COLORS.RED, Data.boss.visual.core.initialAlpha);
        this.coreLight.setFillStyle(0xffffff, 0.8);
      },
    });
  }

  public static resolveColor(colorValue: string | undefined, fallback: number): number {
    if (!colorValue) {
      return fallback;
    }

    if (colorValue.startsWith('0x') || colorValue.startsWith('0X')) {
      const parsedHex = Number.parseInt(colorValue.slice(2), 16);
      return Number.isNaN(parsedHex) ? fallback : parsedHex;
    }

    if (colorValue.startsWith('#')) {
      const parsedHex = Number.parseInt(colorValue.slice(1), 16);
      return Number.isNaN(parsedHex) ? fallback : parsedHex;
    }

    return Data.getColor(colorValue);
  }

  private drawGlow(
    timeElapsed: number,
    dangerLevel: number,
    armorPieceCount: number,
    filledArmorPieceCount: number
  ): void {
    const config = Data.boss.visual;
    const pulseFactor = 1 + Math.sin(timeElapsed * config.core.pulseSpeed) * 0.1;

    if (config.core.glowLevels) {
      config.core.glowLevels.forEach((level) => {
        this.glowGraphics.fillStyle(COLORS.RED, level.alpha * pulseFactor);
        this.glowGraphics.fillCircle(
          0,
          0,
          config.core.radius * level.radius * (1 + dangerLevel * 0.2)
        );
      });
    }

    const armor = config.armor;
    const rotation = timeElapsed * armor.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / armorPieceCount;
    const pieceSpan = this.getArmorPieceSpan(armor.gap, armorPieceCount);
    const glowAlpha = (armor.glowAlpha ?? 0.4) * pulseFactor;
    const glowWidth = armor.glowWidth ?? 4;

    for (let i = 0; i < filledArmorPieceCount; i++) {
      const centerAngle = rotation + (i + 0.5) * pieceAngle;
      const startAngle = centerAngle - pieceSpan * 0.5;
      const endAngle = centerAngle + pieceSpan * 0.5;
      if (endAngle <= startAngle) {
        continue;
      }

      this.glowGraphics.lineStyle(glowWidth, COLORS.RED, glowAlpha);
      this.traceArmorPiecePath(this.glowGraphics, startAngle, endAngle, armor.innerRadius, armor.radius);
      this.glowGraphics.strokePath();
    }
  }

  private drawArmor(
    timeElapsed: number,
    armorPieceCount: number,
    filledArmorPieceCount: number
  ): void {
    const config = Data.boss.visual.armor;
    const rotation = timeElapsed * config.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / armorPieceCount;
    const pieceSpan = this.getArmorPieceSpan(config.gap, armorPieceCount);

    const filledBodyColor = BossRenderer.resolveColor(config.bodyColor, COLORS.RED);
    const filledBorderColor = BossRenderer.resolveColor(config.borderColor, COLORS.RED);
    const depletedBodyColor = BossRenderer.resolveColor(config.depletedBodyColor, filledBodyColor);
    const depletedBorderColor = BossRenderer.resolveColor(config.depletedBorderColor, filledBorderColor);
    const depletedBodyAlpha = config.depletedBodyAlpha ?? Math.max(0.12, config.bodyAlpha * 0.35);
    const depletedBorderAlpha = config.depletedBorderAlpha ?? 0.35;

    for (let i = 0; i < armorPieceCount; i++) {
      const centerAngle = rotation + (i + 0.5) * pieceAngle;
      const startAngle = centerAngle - pieceSpan * 0.5;
      const endAngle = centerAngle + pieceSpan * 0.5;
      if (endAngle <= startAngle) {
        continue;
      }

      const isFilled = i < filledArmorPieceCount;
      const bodyColor = isFilled ? filledBodyColor : depletedBodyColor;
      const bodyAlpha = isFilled ? config.bodyAlpha : depletedBodyAlpha;
      const borderColor = isFilled ? filledBorderColor : depletedBorderColor;
      const borderAlpha = isFilled ? 1 : depletedBorderAlpha;
      const detailAlpha = isFilled ? 0.4 : Math.min(0.25, depletedBorderAlpha * 0.7);

      this.armorGraphics.fillStyle(bodyColor, bodyAlpha);
      this.traceArmorPiecePath(this.armorGraphics, startAngle, endAngle, config.innerRadius, config.radius);
      this.armorGraphics.fillPath();

      this.armorGraphics.lineStyle(2, borderColor, borderAlpha);
      this.traceArmorPiecePath(this.armorGraphics, startAngle, endAngle, config.innerRadius, config.radius);
      this.armorGraphics.strokePath();

      this.armorGraphics.lineStyle(1, borderColor, detailAlpha);
      const midRadius = (config.radius + config.innerRadius) / 2;
      this.armorGraphics.beginPath();
      this.armorGraphics.arc(0, 0, midRadius, startAngle, endAngle);
      this.armorGraphics.strokePath();
    }
  }

  private getClampedArmorGap(configuredGap: number, pieceCount: number): number {
    const safePieceCount = Math.max(1, pieceCount);
    const pieceAngle = (Math.PI * 2) / safePieceCount;
    const maxGap = pieceAngle * 0.45;
    return Phaser.Math.Clamp(configuredGap, 0, maxGap);
  }

  private getArmorPieceSpan(configuredGap: number, pieceCount: number): number {
    const safePieceCount = Math.max(1, pieceCount);
    const slotAngle = (Math.PI * 2) / safePieceCount;
    const gap = this.getClampedArmorGap(configuredGap, safePieceCount);
    return Math.max(slotAngle - gap * 2, slotAngle * 0.2);
  }

  private traceArmorPiecePath(
    graphics: Phaser.GameObjects.Graphics,
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number
  ): void {
    graphics.beginPath();
    graphics.arc(0, 0, outerRadius, startAngle, endAngle, false);
    graphics.lineTo(Math.cos(endAngle) * innerRadius, Math.sin(endAngle) * innerRadius);
    graphics.arc(0, 0, innerRadius, endAngle, startAngle, true);
    graphics.closePath();
  }
}
