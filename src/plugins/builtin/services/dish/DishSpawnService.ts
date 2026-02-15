import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import type { BombWarningConfig } from '../../../../data/types';
import type { Entity } from '../../../../entities/Entity';
import { initializeEntitySpawn } from '../../../../entities/EntitySpawnInitializer';
import type { PlayerAttackRenderer } from '../../abilities/PlayerAttackRenderer';
import type { ObjectPool } from '../../../../utils/ObjectPool';
import type { UpgradeSystem } from '../UpgradeSystem';
import type { World } from '../../../../world';
import { INVALID_ENTITY_ID } from '../../../../world/EntityId';
import { PluginRegistry } from '../../../../plugins/PluginRegistry';

interface DishSpawnServiceDeps {
  dishPool: ObjectPool<Entity>;
  dishes: Phaser.GameObjects.Group;
  upgradeSystem: UpgradeSystem;
  world: World;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  isGameOver: () => boolean;
}

export class DishSpawnService {
  private readonly dishPool: ObjectPool<Entity>;
  private readonly dishes: Phaser.GameObjects.Group;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly world: World;
  private readonly getPlayerAttackRenderer: () => PlayerAttackRenderer;
  private readonly isGameOver: () => boolean;

  constructor(deps: DishSpawnServiceDeps) {
    this.dishPool = deps.dishPool;
    this.dishes = deps.dishes;
    this.upgradeSystem = deps.upgradeSystem;
    this.world = deps.world;
    this.getPlayerAttackRenderer = deps.getPlayerAttackRenderer;
    this.isGameOver = deps.isGameOver;
  }

  public spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    const bombData = Data.getBombData(type);
    if (bombData?.bombWarning) {
      this.showBombWarningAndSpawn(type, x, y, speedMultiplier, bombData.bombWarning);
      return;
    }

    this.spawnDishImmediate(type, x, y, speedMultiplier);
  }

  private spawnDishImmediate(
    type: string,
    x: number,
    y: number,
    _speedMultiplier: number = 1
  ): void {
    const entity = this.dishPool.acquire();
    if (!entity) return;

    const plugin = PluginRegistry.getInstance().getEntityType(type);
    if (!plugin) {
      this.dishPool.release(entity);
      return;
    }

    const bombData = Data.getBombData(type);
    const dishData = bombData ? undefined : Data.getDishData(type);
    const options = {
      cursorSizeBonus: this.upgradeSystem.getCursorSizeBonus(),
      damageBonus: this.upgradeSystem.getCursorDamageBonus(),
      criticalChance: this.upgradeSystem.getCriticalChanceBonus(),
    };

    const config = {
      entityId: INVALID_ENTITY_ID,
      entityType: type,
      hp: bombData?.hp ?? dishData?.hp ?? 10,
      lifetime: bombData?.lifetime ?? dishData?.lifetime ?? 7000,
      isGatekeeper: false,
      spawnAnimation: bombData?.spawnAnimation ?? dishData?.spawnAnimation,
      upgradeOptions: options,
    };

    entity.active = true;
    initializeEntitySpawn(entity, this.world, config, plugin, x, y);

    this.dishes.add(entity);
  }

  private showBombWarningAndSpawn(
    type: string,
    x: number,
    y: number,
    speedMultiplier: number,
    warning: BombWarningConfig,
  ): void {
    this.getPlayerAttackRenderer().showBombWarning(
      x,
      y,
      warning,
      () => {
        if (!this.isGameOver()) {
          this.spawnDishImmediate(type, x, y, speedMultiplier);
        }
      }
    );
  }
}
