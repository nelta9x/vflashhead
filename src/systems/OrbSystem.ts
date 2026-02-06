import Phaser from 'phaser';
import { Dish } from '../entities/Dish';
import { UpgradeSystem } from './UpgradeSystem';
import { ObjectPool } from '../utils/ObjectPool';

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
  private readonly HIT_INTERVAL = 300; // ms between hits on the same target

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

    const stats = this.upgradeSystem.getOrbitingOrbData();
    if (!stats) return;

    // Magnet Synergy: Increase Size
    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    // Base size + 20% per magnet level
    const synergySizeMultiplier = 1 + (magnetLevel * 0.2); 
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
      const angleDeg = this.currentAngle + (i * angleStep);
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      
      const orbX = playerX + Math.cos(angleRad) * radius;
      const orbY = playerY + Math.sin(angleRad) * radius;

      this.orbPositions.push({
        x: orbX,
        y: orbY,
        size: finalSize
      });
    }

    // Check Collisions
    this.checkCollisions(gameTime, dishPool, stats.damage, finalSize);
  }

  private checkCollisions(
    gameTime: number, 
    dishPool: ObjectPool<Dish>, 
    damage: number, 
    orbSize: number
  ): void {
    dishPool.forEach(dish => {
      if (!dish.active || dish.isDangerous()) return; // Don't hit bombs automatically with orbs? 
      // Actually, hitting bombs with orbs might be bad if it kills the player.
      // But "Protective Orbs" usually defend.
      // In Vampire Survivors, Bible hits everything.
      // If bomb explodes on contact, user might get hurt.
      // Let's assume Orbs trigger bombs safely or just hit them.
      // Existing logic: Dish.applyDamage triggers explosion if hp <= 0.
      // If it's a bomb, applyDamage -> destroy -> explosion.
      // Usually "Projectiles" trigger bombs. Orbs are projectiles.
      // Let's keep it consistent: Orbs hit everything.
      
      // Collision Check (Circle vs Circle)
      // Iterate all orbs
      let hit = false;
      for (const orb of this.orbPositions) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, dish.x, dish.y);
        if (dist <= (orbSize + dish.getSize())) {
          hit = true;
          break;
        }
      }

      if (hit) {
        const nextHitTime = this.lastHitTimes.get(dish) || 0;
        if (gameTime >= nextHitTime) {
          // Deal Damage
          dish.applyDamage(damage);
          // Set Cooldown
          this.lastHitTimes.set(dish, gameTime + this.HIT_INTERVAL);
        }
      }
    });
  }

  public getOrbs(): OrbPosition[] {
    return this.orbPositions;
  }
}
