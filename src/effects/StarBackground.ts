import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../data/constants';
import type { StarsConfig } from '../data/types';

interface StarData {
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  offset: number;
}

export class StarBackground {
  private graphics: Phaser.GameObjects.Graphics;
  private config: StarsConfig;
  private stars: StarData[] = [];

  constructor(scene: Phaser.Scene, config: StarsConfig) {
    this.config = config;
    this.graphics = scene.add.graphics();
    this.init();
  }

  private init(): void {
    this.stars = [];
    const limitY = GAME_HEIGHT * this.config.verticalLimitRatio;

    for (let i = 0; i < this.config.count; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * limitY,
        size: Phaser.Math.FloatBetween(this.config.minSize, this.config.maxSize),
        twinkleSpeed: Phaser.Math.FloatBetween(
          this.config.twinkleSpeedMin,
          this.config.twinkleSpeedMax
        ),
        offset: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(delta: number, time: number, gridSpeed: number): void {
    const limitY = GAME_HEIGHT * this.config.verticalLimitRatio;
    this.graphics.clear();

    this.stars.forEach((star) => {
      // 1. 반짝임 (Alpha)
      const alpha = 0.2 + Math.abs(Math.sin(time * star.twinkleSpeed + star.offset)) * 0.8;

      // 2. 아래로 이동 (그리드보다 10배 느리게 흐름)
      // 원근감을 위해 크기에 비례하여 속도 조절
      const sizeFactor = star.size / this.config.maxSize;
      const baseRatio = this.config.parallaxRatio;
      const variation = this.config.sizeSpeedFactor;

      // 공식: gridSpeed * 기본비율 * (1 - variation/2 + sizeFactor * variation)
      // 예: 0.1 * (0.8 + sizeFactor * 0.4) 와 비슷하게 동작하도록 설정
      const parallaxSpeed = gridSpeed * baseRatio * (1 - variation * 0.5 + sizeFactor * variation);

      star.y += parallaxSpeed * delta;

      // 경계 체크 및 리셋
      if (star.y > limitY) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }

      // 3. 그리기
      this.graphics.fillStyle(0xffffff, alpha);
      this.graphics.fillCircle(star.x, star.y, star.size);

      // 큰 별은 가끔 Cyan 빛 테두리 추가
      if (star.size > 1.5) {
        this.graphics.lineStyle(1, COLORS.CYAN, alpha * 0.4);
        this.graphics.strokeCircle(star.x, star.y, star.size + 1);
      }
    });
  }

  public setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
