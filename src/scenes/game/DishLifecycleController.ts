import Phaser from 'phaser';
import type { Entity } from '../../entities/Entity';
import type { DamageText } from '../../ui/DamageText';
import type { PlayerAttackRenderer } from '../../effects/PlayerAttackRenderer';
import type { ObjectPool } from '../../utils/ObjectPool';
import type { ComboSystem } from '../../systems/ComboSystem';
import type { EntityDamageService } from '../../systems/EntityDamageService';
import type { FeedbackSystem } from '../../systems/FeedbackSystem';
import type { HealthSystem } from '../../systems/HealthSystem';
import type { SoundSystem } from '../../systems/SoundSystem';
import type { UpgradeSystem } from '../../systems/UpgradeSystem';
import type { World } from '../../world';
import type {
  DishDamagedEventPayload,
  DishDestroyedEventPayload,
  DishMissedEventPayload,
} from './GameSceneContracts';
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
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  isAnyLaserFiring: () => boolean;
  isGameOver: () => boolean;
}

export class DishLifecycleController {
  private readonly spawnService: DishSpawnService;
  private readonly resolutionService: DishResolutionService;

  constructor(deps: DishLifecycleControllerDeps) {
    this.spawnService = new DishSpawnService({
      dishPool: deps.dishPool,
      dishes: deps.dishes,
      upgradeSystem: deps.upgradeSystem,
      world: deps.world,
      getPlayerAttackRenderer: deps.getPlayerAttackRenderer,
      isGameOver: deps.isGameOver,
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
      isAnyLaserFiring: deps.isAnyLaserFiring,
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
}
