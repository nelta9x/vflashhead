import Phaser from 'phaser';
import { Entity } from '../../../entities/Entity';
import { deactivateEntity } from '../../../entities/EntityLifecycle';
import type { DamageText } from '../../../ui/DamageText';
import type { PlayerAttackRenderer } from '../abilities/PlayerAttackRenderer';
import type { ObjectPool } from '../../../utils/ObjectPool';
import type { ComboSystem } from '../../../systems/ComboSystem';
import type { EntityDamageService } from '../../../systems/EntityDamageService';
import type { FeedbackSystem } from '../../../systems/FeedbackSystem';
import type { HealthSystem } from '../../../systems/HealthSystem';
import type { SoundSystem } from '../../../systems/SoundSystem';
import type { StatusEffectManager } from '../../../systems/StatusEffectManager';
import type { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { C_DishTag, C_BombProps } from '../../../world';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type {
  DishDamagedEventPayload,
  DishDestroyedEventPayload,
  DishMissedEventPayload,
} from './ContentContracts';
import type { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import type { BossCombatCoordinator } from './BossCombatCoordinator';
import { DishResolutionService } from './dish/DishResolutionService';
import { DishSpawnService } from './dish/DishSpawnService';

interface DishLifecycleControllerDeps {
  world: World;
  dishPool: ObjectPool<Entity>;
  dishes: Phaser.GameObjects.Group;
  healthSystem: HealthSystem;
  comboSystem: ComboSystem;
  upgradeSystem: UpgradeSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  damageText: DamageText;
  damageService: EntityDamageService;
  statusEffectManager: StatusEffectManager;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  gameEnv: GameEnvironment;
  bcc: BossCombatCoordinator;
}

export class DishLifecycleController {
  private readonly spawnService: DishSpawnService;
  private readonly resolutionService: DishResolutionService;
  private readonly world: World;
  private readonly dishPool: ObjectPool<Entity>;
  private readonly statusEffectManager: StatusEffectManager;

  public readonly dishes: Phaser.GameObjects.Group;

  constructor(deps: DishLifecycleControllerDeps) {
    this.dishes = deps.dishes;
    this.world = deps.world;
    this.dishPool = deps.dishPool;
    this.statusEffectManager = deps.statusEffectManager;

    this.spawnService = new DishSpawnService({
      dishPool: deps.dishPool,
      dishes: deps.dishes,
      upgradeSystem: deps.upgradeSystem,
      world: deps.world,
      getPlayerAttackRenderer: deps.getPlayerAttackRenderer,
      isGameOver: () => deps.gameEnv.isGameOver,
    });

    this.resolutionService = new DishResolutionService({
      world: deps.world,
      dishPool: deps.dishPool,
      dishes: deps.dishes,
      healthSystem: deps.healthSystem,
      comboSystem: deps.comboSystem,
      upgradeSystem: deps.upgradeSystem,
      feedbackSystem: deps.feedbackSystem,
      soundSystem: deps.soundSystem,
      damageText: deps.damageText,
      damageService: deps.damageService,
      isAnyLaserFiring: () => deps.bcc.isAnyLaserFiring(),
    });
  }

  public spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    this.spawnService.spawnDish(type, x, y, speedMultiplier);
  }

  public onDishDestroyed(data: DishDestroyedEventPayload): void {
    this.resolutionService.onDishDestroyed(data);
  }

  public onDishDamaged(data: DishDamagedEventPayload): void {
    this.resolutionService.onDishDamaged(data);
  }

  public onDishMissed(data: DishMissedEventPayload): void {
    this.resolutionService.onDishMissed(data);
  }

  public removeEntityFromPool(entityId: EntityId): void {
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      this.dishes.remove(node.container as unknown as Phaser.GameObjects.GameObject);
      this.dishPool.release(node.container as unknown as Entity);
    }
  }

  public clearAll(): void {
    for (const [entityId] of this.world.query(C_DishTag)) {
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        const entity = node.container as Entity;
        deactivateEntity(entity, this.world, this.statusEffectManager);
        this.dishes.remove(entity);
        this.dishPool.release(entity);
      }
    }
    // 웨이브 폭탄도 동일 풀을 사용하므로 정리
    for (const [entityId] of this.world.query(C_BombProps)) {
      // 낙하 폭탄은 FallingBombSystem이 관리하므로 건너뜀
      if (this.world.fallingBomb.has(entityId)) continue;
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        const entity = node.container as Entity;
        deactivateEntity(entity, this.world, this.statusEffectManager);
        this.dishes.remove(entity);
        this.dishPool.release(entity);
      }
    }
  }
}
