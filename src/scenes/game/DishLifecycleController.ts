import Phaser from 'phaser';
import type { Dish } from '../../entities/Dish';
import type { DamageText } from '../../ui/DamageText';
import type { ParticleManager } from '../../effects/ParticleManager';
import type { PlayerAttackRenderer } from '../../effects/PlayerAttackRenderer';
import type { ObjectPool } from '../../utils/ObjectPool';
import type { ComboSystem } from '../../systems/ComboSystem';
import type { FeedbackSystem } from '../../systems/FeedbackSystem';
import type { HealthSystem } from '../../systems/HealthSystem';
import type { SoundSystem } from '../../systems/SoundSystem';
import type { UpgradeSystem } from '../../systems/UpgradeSystem';
import type {
  BossInteractionGateway,
  CursorSnapshot,
  DishDamagedEventPayload,
  DishDestroyedEventPayload,
  DishMissedEventPayload,
} from './GameSceneContracts';
import { DishFieldEffectService } from './dish/DishFieldEffectService';
import { DishResolutionService } from './dish/DishResolutionService';
import { DishSpawnService } from './dish/DishSpawnService';

interface DishLifecycleControllerDeps {
  dishPool: ObjectPool<Dish>;
  dishes: Phaser.GameObjects.Group;
  healthSystem: HealthSystem;
  comboSystem: ComboSystem;
  upgradeSystem: UpgradeSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  damageText: DamageText;
  particleManager: ParticleManager;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  bossGateway: BossInteractionGateway;
  isAnyLaserFiring: () => boolean;
  getCursor: () => CursorSnapshot;
  isGameOver: () => boolean;
}

export class DishLifecycleController {
  private readonly spawnService: DishSpawnService;
  private readonly resolutionService: DishResolutionService;
  private readonly fieldEffectService: DishFieldEffectService;

  constructor(deps: DishLifecycleControllerDeps) {
    this.spawnService = new DishSpawnService({
      dishPool: deps.dishPool,
      dishes: deps.dishes,
      upgradeSystem: deps.upgradeSystem,
      getPlayerAttackRenderer: deps.getPlayerAttackRenderer,
      isGameOver: deps.isGameOver,
    });

    this.resolutionService = new DishResolutionService({
      dishPool: deps.dishPool,
      dishes: deps.dishes,
      healthSystem: deps.healthSystem,
      comboSystem: deps.comboSystem,
      upgradeSystem: deps.upgradeSystem,
      feedbackSystem: deps.feedbackSystem,
      soundSystem: deps.soundSystem,
      damageText: deps.damageText,
      bossGateway: deps.bossGateway,
      isAnyLaserFiring: deps.isAnyLaserFiring,
      getCursor: deps.getCursor,
    });

    this.fieldEffectService = new DishFieldEffectService({
      dishPool: deps.dishPool,
      particleManager: deps.particleManager,
      upgradeSystem: deps.upgradeSystem,
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

  public updateMagnetEffect(delta: number, cursor: CursorSnapshot): void {
    this.fieldEffectService.updateMagnetEffect(delta, cursor);
  }

  public updateCursorAttack(cursor: CursorSnapshot): void {
    this.fieldEffectService.updateCursorAttack(cursor);
  }
}
