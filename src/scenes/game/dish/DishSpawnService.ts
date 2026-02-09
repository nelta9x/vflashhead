import Phaser from 'phaser';
import type { Dish } from '../../../entities/Dish';
import type { PlayerAttackRenderer } from '../../../effects/PlayerAttackRenderer';
import type { ObjectPool } from '../../../utils/ObjectPool';
import type { UpgradeSystem } from '../../../systems/UpgradeSystem';

interface DishSpawnServiceDeps {
  dishPool: ObjectPool<Dish>;
  dishes: Phaser.GameObjects.Group;
  upgradeSystem: UpgradeSystem;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  isGameOver: () => boolean;
}

export class DishSpawnService {
  private readonly dishPool: ObjectPool<Dish>;
  private readonly dishes: Phaser.GameObjects.Group;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly getPlayerAttackRenderer: () => PlayerAttackRenderer;
  private readonly isGameOver: () => boolean;

  constructor(deps: DishSpawnServiceDeps) {
    this.dishPool = deps.dishPool;
    this.dishes = deps.dishes;
    this.upgradeSystem = deps.upgradeSystem;
    this.getPlayerAttackRenderer = deps.getPlayerAttackRenderer;
    this.isGameOver = deps.isGameOver;
  }

  public spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    if (type === 'bomb') {
      this.showBombWarningAndSpawn(x, y, speedMultiplier);
      return;
    }

    this.spawnDishImmediate(type, x, y, speedMultiplier);
  }

  private spawnDishImmediate(
    type: string,
    x: number,
    y: number,
    speedMultiplier: number = 1
  ): void {
    const dish = this.dishPool.acquire();
    if (!dish) return;

    const options = {
      cursorSizeBonus: this.upgradeSystem.getCursorSizeBonus(),
      damageBonus: this.upgradeSystem.getCursorDamageBonus(),
      criticalChance: this.upgradeSystem.getCriticalChanceBonus(),
    };
    dish.spawn(x, y, type, speedMultiplier, options);
    this.dishes.add(dish);
  }

  private showBombWarningAndSpawn(x: number, y: number, speedMultiplier: number): void {
    this.getPlayerAttackRenderer().showBombWarning(
      x,
      y,
      {
        duration: 500,
        radius: 50,
        blinkInterval: 100,
      },
      () => {
        if (!this.isGameOver()) {
          this.spawnDishImmediate('bomb', x, y, speedMultiplier);
        }
      }
    );
  }
}
