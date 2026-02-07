import Phaser from 'phaser';
import { Dish } from '../entities/Dish';
import { UpgradeSystem } from './UpgradeSystem';
import { ObjectPool } from '../utils/ObjectPool';
import { Data } from '../data/DataManager';
import { EventBus, GameEvents } from '../utils/EventBus';

export interface OrbPosition {
  x: number;
  y: number;
  size: number;
}

export class OrbSystem {
  private upgradeSystem: UpgradeSystem;
  private currentAngle: number = 0;

  // Cooldown tracking per dish: Map<Dish, NextHitTime>
  private lastHitTimes: WeakMap<Dish, number> = new WeakMap();

  private orbPositions: OrbPosition[] = [];

  constructor(upgradeSystem: UpgradeSystem) {
    this.upgradeSystem = upgradeSystem;
  }

  update(
    delta: number,
    gameTime: number,
    playerX: number,
    playerY: number,
    dishPool: ObjectPool<Dish>
  ): void {
    const level = this.upgradeSystem.getOrbitingOrbLevel();
    if (level <= 0) {
      this.orbPositions = [];
      return;
    }

    const upgradeData = this.upgradeSystem.getSystemUpgrade('orbiting_orb');
    const hitInterval = upgradeData?.hitInterval ?? 300;

    const stats = this.upgradeSystem.getOrbitingOrbData();
    if (!stats) return;

    // Magnet Synergy: Increase Size
    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    // Base size + 20% per magnet level
    const synergySizeMultiplier = 1 + magnetLevel * 0.2;
    const finalSize = stats.size * synergySizeMultiplier;

    // Update Angle
    // Speed is in degrees per second
    const speed = stats.speed;
    this.currentAngle += speed * (delta / 1000);
    this.currentAngle %= 360;

    // Calculate Positions
    this.orbPositions = [];
    const count = stats.count;
    const radius = stats.radius;
    const angleStep = 360 / count;

    for (let i = 0; i < count; i++) {
      const angleDeg = this.currentAngle + i * angleStep;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      const orbX = playerX + Math.cos(angleRad) * radius;
      const orbY = playerY + Math.sin(angleRad) * radius;

      this.orbPositions.push({
        x: orbX,
        y: orbY,
        size: finalSize,
      });
    }

    // Check Collisions
    this.checkCollisions(gameTime, dishPool, stats.damage, finalSize, hitInterval);
  }

  private checkCollisions(
    gameTime: number,
    dishPool: ObjectPool<Dish>,
    damage: number,
    orbSize: number,
    hitInterval: number
  ): void {
    dishPool.forEach((dish) => {
      if (!dish.active) return;
      
      // 폭탄(dangerous)은 완전히 스폰된 후에만 타격 가능
      if (dish.isDangerous() && !dish.isFullySpawned()) return;

      // Collision Check (Circle vs Circle)
      // Iterate all orbs
      let hit = false;
      for (const orb of this.orbPositions) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, dish.x, dish.y);
        // 타격 범위를 넉넉하게 잡기 위해 (orbSize + dish.getSize())의 1.5배 적용
        if (dist <= (orbSize + dish.getSize()) * 1.5) {
          hit = true;
          break;
        }
      }

      if (hit) {
        const nextHitTime = this.lastHitTimes.get(dish) || 0;
        if (gameTime >= nextHitTime) {
          // 폭탄(dangerous)은 HP와 관계없이 즉시 제거
          if (dish.isDangerous()) {
            dish.forceDestroy();
          } else {
            // 일반 접시는 데미지 적용
            dish.applyDamage(damage);
          }
          // Set Cooldown
          this.lastHitTimes.set(dish, gameTime + hitInterval);
        }
      }
    });
  }

  public getOrbs(): OrbPosition[] {
    return this.orbPositions;
  }
}
