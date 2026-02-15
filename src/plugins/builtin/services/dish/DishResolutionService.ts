import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import { COLORS, CURSOR_HITBOX } from '../../../../data/constants';
import type { Entity } from '../../../../entities/Entity';
import type { DamageText } from '../../../../ui/DamageText';
import type { ObjectPool } from '../../../../utils/ObjectPool';
import type { ComboSystem } from '../ComboSystem';
import type { EntityDamageService } from '../EntityDamageService';
import type { FeedbackSystem } from '../FeedbackSystem';
import type { HealthSystem } from '../../../../systems/HealthSystem';
import type { SoundSystem } from '../SoundSystem';
import type { UpgradeSystem } from '../UpgradeSystem';
import { C_DishTag, C_DishProps, C_Transform } from '../../../../world';
import type { World } from '../../../../world';
import type { EntityId } from '../../../../world/EntityId';
import type {
  DishDamagedEventPayload,
  DishDestroyedEventPayload,
  DishMissedEventPayload,
} from '../ContentContracts';

interface DishResolutionServiceDeps {
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
  isAnyLaserFiring: () => boolean;
}

export class DishResolutionService {
  private readonly world: World;
  private readonly dishPool: ObjectPool<Entity>;
  private readonly dishes: Phaser.GameObjects.Group;
  private readonly healthSystem: HealthSystem;
  private readonly comboSystem: ComboSystem;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly damageText: DamageText;
  private readonly damageService: EntityDamageService;
  private readonly isAnyLaserFiring: () => boolean;

  constructor(deps: DishResolutionServiceDeps) {
    this.world = deps.world;
    this.dishPool = deps.dishPool;
    this.dishes = deps.dishes;
    this.healthSystem = deps.healthSystem;
    this.comboSystem = deps.comboSystem;
    this.upgradeSystem = deps.upgradeSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.damageText = deps.damageText;
    this.damageService = deps.damageService;
    this.isAnyLaserFiring = deps.isAnyLaserFiring;
  }

  public onDishDestroyed(data: DishDestroyedEventPayload): void {
    const { snapshot, x, y, byAbility } = data;

    if (!byAbility) {
      const laserConfig = Data.gameConfig.monsterAttack.laser;
      const isLaserFiring = this.isAnyLaserFiring();
      const comboBonus = isLaserFiring ? laserConfig.bonus.comboAmount : 0;
      this.comboSystem.increment(comboBonus);

      if (isLaserFiring) {
        this.damageText.showText(x, y - 40, Data.t('feedback.laser_bonus'), COLORS.YELLOW);
        this.soundSystem.playBossImpactSound();
      }
    }

    const cursorRadius = this.getCursorRadius();
    this.feedbackSystem.onDishDestroyed(
      x,
      y,
      snapshot.color,
      snapshot.entityType,
      this.comboSystem.getCombo(),
      cursorRadius
    );

    this.removeDishFromPool(snapshot.entityId);
  }

  public onDishDamaged(data: DishDamagedEventPayload): void {
    const { snapshot, x, y, damage, hpRatio, byAbility, isCritical } = data;
    const isAbilityDamage = byAbility === true;
    const combo = isAbilityDamage ? 0 : this.comboSystem.getCombo();

    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    if (!isAbilityDamage && electricLevel > 0) {
      const electricRadius = this.upgradeSystem.getElectricShockRadius();
      this.applyElectricShock(x, y, snapshot.entityId, electricRadius);
    }

    if (isCritical) {
      this.feedbackSystem.onCriticalHit(x, y, damage, combo);
      return;
    }

    this.feedbackSystem.onDishDamaged(x, y, damage, hpRatio, snapshot.color, combo);
  }

  public onDishMissed(data: DishMissedEventPayload): void {
    const { snapshot, x, y } = data;
    const dishData = Data.getDishData(snapshot.entityType);

    this.feedbackSystem.onDishMissed(x, y, snapshot.color, snapshot.entityType);
    const damage = dishData?.playerDamage ?? 1;
    this.healthSystem.takeDamage(damage);
    this.comboSystem.reset();
    this.removeDishFromPool(snapshot.entityId);
  }

  private applyElectricShock(x: number, y: number, excludeEntityId: EntityId, radius: number): void {
    const targets: { x: number; y: number }[] = [];
    const damage = this.upgradeSystem.getElectricShockDamage();
    const criticalChanceBonus = this.upgradeSystem.getCriticalChanceBonus();

    for (const [entityId, , , t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      if (entityId === excludeEntityId) continue;

      const distance = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      if (distance < radius) {
        targets.push({ x: t.x, y: t.y });
        this.damageService.applyUpgradeDamage(entityId, damage, 0, criticalChanceBonus);
      }
    }

    if (targets.length > 0) {
      this.feedbackSystem.onElectricShock(x, y, targets);
    }
  }

  private removeDishFromPool(entityId: EntityId): void {
    const node = this.world.phaserNode.get(entityId);
    if (node) {
      this.dishes.remove(node.container as unknown as Phaser.GameObjects.GameObject);
      this.dishPool.release(node.container as unknown as Entity);
    }
  }

  private getCursorRadius(): number {
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    return CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
  }
}
