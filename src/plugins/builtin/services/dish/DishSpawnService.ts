import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import type { BombWarningConfig } from '../../../../data/types';
import type { Entity } from '../../../../entities/Entity';
import { initializeEntitySpawn } from '../../../../entities/EntitySpawnInitializer';
import type { PlayerAttackRenderer } from '../../abilities/PlayerAttackRenderer';
import type { ObjectPool } from '../../../../utils/ObjectPool';
import type { World } from '../../../../world';
import type { AbilityRuntimeQueryService } from '../abilities/AbilityRuntimeQueryService';
import { INVALID_ENTITY_ID } from '../../../../world/EntityId';
import { PluginRegistry } from '../../../../plugins/PluginRegistry';
import {
  ABILITY_IDS,
  CRITICAL_CHANCE_EFFECT_KEYS,
  CURSOR_SIZE_EFFECT_KEYS,
} from '../upgrades/AbilityEffectCatalog';

interface DishSpawnServiceDeps {
  dishPool: ObjectPool<Entity>;
  dishes: Phaser.GameObjects.Group;
  abilityRuntimeQuery: AbilityRuntimeQueryService;
  world: World;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  isGameOver: () => boolean;
}

export class DishSpawnService {
  private readonly dishPool: ObjectPool<Entity>;
  private readonly dishes: Phaser.GameObjects.Group;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
  private readonly world: World;
  private readonly getPlayerAttackRenderer: () => PlayerAttackRenderer;
  private readonly isGameOver: () => boolean;

  private cachedWave = -1;
  private cachedCursorSizeBonus = 0;
  private cachedDamageBonus = 0;
  private cachedCriticalChance = 0;

  constructor(deps: DishSpawnServiceDeps) {
    this.dishPool = deps.dishPool;
    this.dishes = deps.dishes;
    this.abilityRuntimeQuery = deps.abilityRuntimeQuery;
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
    const dishData = bombData ? undefined : Data.getEntityTypeData(type);
    this.ensureEffectCache();
    const options = {
      cursorSizeBonus: this.cachedCursorSizeBonus,
      damageBonus: this.cachedDamageBonus,
      criticalChance: this.cachedCriticalChance,
    };

    const config = {
      entityId: INVALID_ENTITY_ID,
      entityType: type,
      hp: bombData?.hp ?? dishData?.hp ?? 10,
      lifetime: (bombData?.lifetime !== undefined ? bombData.lifetime : dishData?.lifetime) ?? null,
      isGatekeeper: false,
      spawnAnimation: bombData?.spawnAnimation ?? dishData?.spawnAnimation,
      upgradeOptions: options,
    };

    entity.active = true;
    initializeEntitySpawn(entity, this.world, config, plugin, x, y);

    this.dishes.add(entity);
  }

  private ensureEffectCache(): void {
    const wave = this.world.context.currentWave;
    if (this.cachedWave === wave) return;
    this.cachedWave = wave;
    this.cachedCursorSizeBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CURSOR_SIZE,
      CURSOR_SIZE_EFFECT_KEYS.SIZE_BONUS,
    );
    this.cachedDamageBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CURSOR_SIZE,
      CURSOR_SIZE_EFFECT_KEYS.DAMAGE,
    );
    this.cachedCriticalChance = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CRITICAL_CHANCE,
      CRITICAL_CHANCE_EFFECT_KEYS.CRITICAL_CHANCE,
    );
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
