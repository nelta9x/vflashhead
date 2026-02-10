import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../data/constants';
import { Data } from '../data/DataManager';

export class MenuBossRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private bossTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  public update(delta: number): void {
    const config = Data.mainMenu.boss;
    this.graphics.clear();
    this.bossTime += delta;

    const bossX = GAME_WIDTH / 2;
    const bossY = GAME_HEIGHT * config.posYRatio;

    // 1. 배경 아우라 (붉은빛)
    const auraPulse = 0.2 + Math.sin(this.bossTime * config.aura.pulseSpeed) * 0.1;
    for (let i = 0; i < config.aura.count; i++) {
      const alpha = (1 - i / config.aura.count) * auraPulse;
      this.graphics.fillStyle(COLORS.RED, alpha);
      this.graphics.fillCircle(bossX, bossY, config.baseRadius * (1 + i * config.aura.spacing));
    }

    // 2. 중앙 거대 코어
    const corePulse = 0.6 + Math.sin(this.bossTime * config.core.pulseSpeed) * 0.2;
    this.graphics.fillStyle(COLORS.RED, corePulse);
    this.graphics.fillCircle(bossX, bossY, config.coreRadius);

    // 코어 내부 흰색 광원
    this.graphics.fillStyle(0xffffff, 0.8);
    this.graphics.fillCircle(bossX, bossY, config.innerLightRadius);

    // 3. 회전하는 거대 아머 조각들
    const rotation = this.bossTime * config.armor.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / config.armor.pieceCount;

    for (let i = 0; i < config.armor.pieceCount; i++) {
      const startAngle = rotation + i * pieceAngle + config.armor.gap;
      const endAngle = rotation + (i + 1) * pieceAngle - config.armor.gap;

      const p1x = bossX + Math.cos(startAngle) * config.armor.innerRadius;
      const p1y = bossY + Math.sin(startAngle) * config.armor.innerRadius;
      const p2x = bossX + Math.cos(endAngle) * config.armor.innerRadius;
      const p2y = bossY + Math.sin(endAngle) * config.armor.innerRadius;
      const p3x = bossX + Math.cos(endAngle) * config.armor.outerRadius;
      const p3y = bossY + Math.sin(endAngle) * config.armor.outerRadius;
      const p4x = bossX + Math.cos(startAngle) * config.armor.outerRadius;
      const p4y = bossY + Math.sin(startAngle) * config.armor.outerRadius;

      // 아머 본체 (어두운 색)
      this.graphics.fillStyle(COLORS.MENU_BOSS_ARMOR, 0.9);
      this.graphics.fillPoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );

      // 아머 테두리 (네온 레드)
      this.graphics.lineStyle(3, COLORS.RED, 0.8);
      this.graphics.strokePoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );

      // 아머 내부 디테일 라인
      this.graphics.lineStyle(1, COLORS.RED, 0.4);
      const midR = (config.armor.innerRadius + config.armor.outerRadius) / 2;
      this.graphics.beginPath();
      this.graphics.arc(bossX, bossY, midR, startAngle, endAngle);
      this.graphics.strokePath();
    }

    // 보스 미세 진동 효과
    const shakeX = (Math.random() - 0.5) * 2;
    const shakeY = (Math.random() - 0.5) * 2;
    this.graphics.x = shakeX;
    this.graphics.y = shakeY;
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
