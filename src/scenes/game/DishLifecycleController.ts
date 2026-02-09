import Phaser from 'phaser';
import { Data } from '../../data/DataManager';
import { COLORS, CURSOR_HITBOX, MAGNET } from '../../data/constants';
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
  private readonly dishPool: ObjectPool<Dish>;
  private readonly dishes: Phaser.GameObjects.Group;
  private readonly healthSystem: HealthSystem;
  private readonly comboSystem: ComboSystem;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly damageText: DamageText;
  private readonly particleManager: ParticleManager;
  private readonly getPlayerAttackRenderer: () => PlayerAttackRenderer;
  private readonly bossGateway: BossInteractionGateway;
  private readonly isAnyLaserFiring: () => boolean;
  private readonly getCursor: () => CursorSnapshot;
  private readonly isGameOver: () => boolean;

  constructor(deps: DishLifecycleControllerDeps) {
    this.dishPool = deps.dishPool;
    this.dishes = deps.dishes;
    this.healthSystem = deps.healthSystem;
    this.comboSystem = deps.comboSystem;
    this.upgradeSystem = deps.upgradeSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.damageText = deps.damageText;
    this.particleManager = deps.particleManager;
    this.getPlayerAttackRenderer = deps.getPlayerAttackRenderer;
    this.bossGateway = deps.bossGateway;
    this.isAnyLaserFiring = deps.isAnyLaserFiring;
    this.getCursor = deps.getCursor;
    this.isGameOver = deps.isGameOver;
  }

  public spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    if (type === 'bomb') {
      this.showBombWarningAndSpawn(x, y, speedMultiplier);
      return;
    }

    this.spawnDishImmediate(type, x, y, speedMultiplier);
  }

  public onDishDestroyed(data: DishDestroyedEventPayload): void {
    const { dish, x, y, byAbility } = data;
    const dishData = Data.getDishData(dish.getDishType());

    if (dish.isDangerous()) {
      if (!byAbility && dishData) {
        const damage = dishData.playerDamage ?? 1;
        this.healthSystem.takeDamage(damage);

        if (dishData.resetCombo) {
          this.comboSystem.reset();
        }
      } else if (byAbility) {
        this.damageText.showText(x, y - 40, Data.t('feedback.bomb_removed'), COLORS.CYAN);
      }

      this.feedbackSystem.onBombExploded(x, y, !!byAbility);
      this.removeDishFromPool(dish);
      return;
    }

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
      dish.getColor(),
      dish.getDishType(),
      this.comboSystem.getCombo(),
      cursorRadius
    );

    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    if (electricLevel > 0) {
      const electricRadius = this.upgradeSystem.getElectricShockRadius();
      this.applyElectricShock(x, y, dish, electricRadius);
    }

    this.removeDishFromPool(dish);
  }

  public onDishDamaged(data: DishDamagedEventPayload): void {
    const { x, y, damage, hpRatio, byAbility, isCritical } = data;
    const combo = byAbility ? 0 : this.comboSystem.getCombo();

    if (isCritical) {
      this.feedbackSystem.onCriticalHit(x, y, damage, combo);
      if (data.type === 'amber') {
        const cursor = this.getCursor();
        const nearestBoss = this.bossGateway.findNearestAliveBoss(cursor.x, cursor.y);
        if (nearestBoss) {
          this.bossGateway.cancelChargingLasers(nearestBoss.id);
        }
      }
      return;
    }

    this.feedbackSystem.onDishDamaged(x, y, damage, hpRatio, data.dish.getColor(), combo);
  }

  public onDishMissed(data: DishMissedEventPayload): void {
    const { dish, x, y, isDangerous } = data;
    const dishData = Data.getDishData(dish.getDishType());

    if (isDangerous) {
      this.removeDishFromPool(dish);
      return;
    }

    this.feedbackSystem.onDishMissed(x, y, dish.getColor(), dish.getDishType());
    const damage = dishData?.playerDamage ?? 1;
    this.healthSystem.takeDamage(damage);
    this.comboSystem.reset();
    this.removeDishFromPool(dish);
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

  private applyElectricShock(x: number, y: number, excludeDish: Dish, radius: number): void {
    const targets: { x: number; y: number }[] = [];
    const damage = this.upgradeSystem.getElectricShockDamage();

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active && !dish.isDangerous()) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) {
          targets.push({ x: dish.x, y: dish.y });
          dish.applyDamage(damage, true);
        }
      }
    });

    if (targets.length > 0) {
      this.feedbackSystem.onElectricShock(x, y, targets);
    }
  }

  private removeDishFromPool(dish: Dish): void {
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  private getCursorRadius(): number {
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    return CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
  }
}
