import Phaser from 'phaser';
import { COLORS, DEPTHS } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import type { IBossShatterEffect } from '../../types';

export class BossShatterEffect implements IBossShatterEffect {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createBossGaugeShatter(
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    bodyColor: number
  ): void {
    const config = Data.boss.visual.shatter;
    this.createShatterShards(x, y, innerRadius, outerRadius, bodyColor, config);
    this.createShatterSparks(x, y, outerRadius, config);
  }

  private createShatterShards(
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    bodyColor: number,
    config: typeof Data.boss.visual.shatter
  ): void {
    for (let i = 0; i < config.shardCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Phaser.Math.Between(innerRadius, outerRadius);
      const startX = x + Math.cos(angle) * radius;
      const startY = y + Math.sin(angle) * radius;

      const shard = this.scene.add.graphics();
      shard.setDepth(DEPTHS.bossShatterShard);

      const size = Phaser.Math.Between(config.minSize, config.maxSize);
      const isEnergy = Math.random() < config.energyShardRatio;
      const color = isEnergy ? COLORS.RED : bodyColor;
      const alpha = isEnergy ? 1 : 0.8;

      shard.fillStyle(color, alpha);

      const points: Phaser.Math.Vector2[] = [];
      const numPoints = Phaser.Math.Between(3, 5);
      for (let j = 0; j < numPoints; j++) {
        const pAngle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const pRadius = (size / 2) * (0.5 + Math.random() * 0.5);
        points.push(new Phaser.Math.Vector2(Math.cos(pAngle) * pRadius, Math.sin(pAngle) * pRadius));
      }

      shard.fillPoints(points, true);

      if (isEnergy) {
        shard.lineStyle(1, 0xffffff, 0.5);
        shard.strokePoints(points, true);
      }

      shard.setPosition(startX, startY);
      shard.setRotation(Math.random() * Math.PI * 2);

      const velocityX =
        (Math.cos(angle) * 0.5 + (Math.random() - 0.5)) *
        Phaser.Math.Between(config.minVelocity, config.maxVelocity);
      const velocityY =
        (Math.sin(angle) * 0.5 + (Math.random() - 0.5)) *
          Phaser.Math.Between(config.minVelocity, config.maxVelocity) -
        config.upwardForce;
      const gravity = config.gravity;
      const rotationSpeed = (Math.random() - 0.5) * config.rotationSpeedRange;
      const duration = Phaser.Math.Between(config.minDuration, config.maxDuration);

      this.scene.tweens.add({
        targets: shard,
        alpha: 0,
        duration: duration,
        ease: 'Cubic.easeIn',
        onUpdate: (_tween) => {
          const t = _tween.elapsed / 1000;
          const curX = startX + velocityX * t;
          const curY = startY + velocityY * t + 0.5 * gravity * t * t;
          shard.setPosition(curX, curY);
          shard.setRotation(shard.rotation + rotationSpeed * 0.016);
        },
        onComplete: () => shard.destroy(),
      });
    }
  }

  private createShatterSparks(
    x: number,
    y: number,
    outerRadius: number,
    config: typeof Data.boss.visual.shatter
  ): void {
    for (let i = 0; i < config.sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spark = this.scene.add.circle(
        x + Math.cos(angle) * outerRadius,
        y + Math.sin(angle) * outerRadius,
        2,
        0xffffff,
        0.8
      );
      spark.setDepth(DEPTHS.explosionSpark);

      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * config.sparkTravelDistance,
        y: spark.y + Math.sin(angle) * config.sparkTravelDistance,
        alpha: 0,
        scale: 0,
        duration: config.sparkDuration,
        onComplete: () => spark.destroy(),
      });
    }
  }
}
