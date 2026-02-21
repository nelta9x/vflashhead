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
import { C_DishTag, C_DishProps, C_Transform } from '../../../../world';
import type { World } from '../../../../world';
import type { EntityId } from '../../../../world/EntityId';
import type { AbilityProgressionService } from '../abilities/AbilityProgressionService';
import type { AbilityRuntimeQueryService } from '../abilities/AbilityRuntimeQueryService';
import type {
  DishDamagedEventPayload,
  DishDestroyedEventPayload,
  DishMissedEventPayload,
} from '../ContentContracts';
import {
  ABILITY_IDS,
  CRITICAL_CHANCE_EFFECT_KEYS,
  CURSOR_SIZE_EFFECT_KEYS,
  ELECTRIC_SHOCK_EFFECT_KEYS,
} from '../upgrades/AbilityEffectCatalog';

interface DishResolutionServiceDeps {
  world: World;
  dishPool: ObjectPool<Entity>;
  dishes: Phaser.GameObjects.Group;
  healthSystem: HealthSystem;
  comboSystem: ComboSystem;
  abilityProgression: AbilityProgressionService;
  abilityRuntimeQuery: AbilityRuntimeQueryService;
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
  private readonly abilityProgression: AbilityProgressionService;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly damageText: DamageText;
  private readonly damageService: EntityDamageService;
  private readonly isAnyLaserFiring: () => boolean;

  private cachedWave = -1;
  private cachedCursorSizeBonus = 0;
  private cachedElectricRadius = 0;
  private cachedElectricDamage = 0;
  private cachedCriticalChance = 0;

  constructor(deps: DishResolutionServiceDeps) {
    this.world = deps.world;
    this.dishPool = deps.dishPool;
    this.dishes = deps.dishes;
    this.healthSystem = deps.healthSystem;
    this.comboSystem = deps.comboSystem;
    this.abilityProgression = deps.abilityProgression;
    this.abilityRuntimeQuery = deps.abilityRuntimeQuery;
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

    const electricLevel = this.abilityProgression.getAbilityLevel(ABILITY_IDS.ELECTRIC_SHOCK);
    if (!isAbilityDamage && electricLevel > 0) {
      this.ensureEffectCache();
      this.applyElectricShock(x, y, snapshot.entityId, this.cachedElectricRadius);
    }

    if (isCritical) {
      this.feedbackSystem.onCriticalHit(x, y, damage, combo);
      return;
    }

    this.feedbackSystem.onDishDamaged(x, y, damage, hpRatio, snapshot.color, combo);
  }

  public onDishMissed(data: DishMissedEventPayload): void {
    const { snapshot, x, y } = data;

    this.feedbackSystem.onDishMissed(x, y, snapshot.color, snapshot.entityType);
    const damage = Data.getPlayerDamage(snapshot.entityType);
    if (damage > 0) {
      this.healthSystem.takeDamage(damage);
    }
    this.comboSystem.reset();
    this.removeDishFromPool(snapshot.entityId);
  }

  private applyElectricShock(x: number, y: number, excludeEntityId: EntityId, radius: number): void {
    const targets: { x: number; y: number }[] = [];
    this.ensureEffectCache();
    const damage = this.cachedElectricDamage;
    const criticalChanceBonus = this.cachedCriticalChance;

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

  private ensureEffectCache(): void {
    const wave = this.world.context.currentWave;
    if (this.cachedWave === wave) return;
    this.cachedWave = wave;
    this.cachedCursorSizeBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CURSOR_SIZE,
      CURSOR_SIZE_EFFECT_KEYS.SIZE_BONUS,
    );
    this.cachedElectricRadius = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ELECTRIC_SHOCK,
      ELECTRIC_SHOCK_EFFECT_KEYS.RADIUS,
    );
    this.cachedElectricDamage = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ELECTRIC_SHOCK,
      ELECTRIC_SHOCK_EFFECT_KEYS.DAMAGE,
    );
    this.cachedCriticalChance = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CRITICAL_CHANCE,
      CRITICAL_CHANCE_EFFECT_KEYS.CRITICAL_CHANCE,
    );
  }

  private getCursorRadius(): number {
    this.ensureEffectCache();
    return CURSOR_HITBOX.BASE_RADIUS * (1 + this.cachedCursorSizeBonus);
  }
}
