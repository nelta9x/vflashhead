import Phaser from 'phaser';
import { CURSOR_HITBOX, MAGNET } from '../../../data/constants';
import type { Dish } from '../../../entities/Dish';
import type { ParticleManager } from '../../../effects/ParticleManager';
import type { ObjectPool } from '../../../utils/ObjectPool';
import type { UpgradeSystem } from '../../../systems/UpgradeSystem';
import type { CursorSnapshot } from '../GameSceneContracts';

interface DishFieldEffectServiceDeps {
  dishPool: ObjectPool<Dish>;
  particleManager: ParticleManager;
  upgradeSystem: UpgradeSystem;
}

export class DishFieldEffectService {
  private readonly dishPool: ObjectPool<Dish>;
  private readonly particleManager: ParticleManager;
  private readonly upgradeSystem: UpgradeSystem;

  constructor(deps: DishFieldEffectServiceDeps) {
    this.dishPool = deps.dishPool;
    this.particleManager = deps.particleManager;
    this.upgradeSystem = deps.upgradeSystem;
  }

  public updateMagnetEffect(delta: number, cursor: CursorSnapshot): void {
    const magnetLevel = this.upgradeSystem.getMagnetLevel();

    if (magnetLevel <= 0) {
      this.dishPool.forEach((dish) => {
        if (dish.active) dish.setBeingPulled(false);
      });
      return;
    }

    const magnetRadius = this.upgradeSystem.getMagnetRadius();
    const magnetForce = this.upgradeSystem.getMagnetForce();
    const deltaSeconds = delta / 1000;

    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      dish.setBeingPulled(false);
      if (dish.isDangerous()) return;

      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, dish.x, dish.y);
      if (dist > magnetRadius || dist < MAGNET.MIN_PULL_DISTANCE) return;

      dish.setBeingPulled(true);
      const pullStrength = 1 - dist / magnetRadius;
      const pullAmount = magnetForce * pullStrength * deltaSeconds;
      const angle = Phaser.Math.Angle.Between(dish.x, dish.y, cursor.x, cursor.y);
      dish.x += Math.cos(angle) * pullAmount;
      dish.y += Math.sin(angle) * pullAmount;

      if (Math.random() < 0.15) {
        this.particleManager.createMagnetPullEffect(dish.x, dish.y, cursor.x, cursor.y);
      }
    });
  }

  public updateCursorAttack(cursor: CursorSnapshot): void {
    const cursorRadius = this.getCursorRadius();

    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, dish.x, dish.y);
      const dishRadius = dish.getSize();
      dish.setInCursorRange(dist <= cursorRadius + dishRadius);
    });
  }

  private getCursorRadius(): number {
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    return CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
  }
}
