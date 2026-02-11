import Phaser from 'phaser';
import { Data } from '../data/DataManager';
import { CURSOR_HITBOX } from '../data/constants';
import type { Poolable } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';
import { DishRenderer } from '../effects/DishRenderer';
import { DishDamageResolver } from './dish/DishDamageResolver';
import { DishEventPayloadFactory } from './dish/DishEventPayloadFactory';
import { BossEntityBehavior } from './BossEntityBehavior';
import type { StatusEffectManager } from '../systems/StatusEffectManager';
import type { World } from '../world';
import type { DishUpgradeOptions } from './EntityTypes';
import type { FeedbackSystem } from '../systems/FeedbackSystem';
import type {
  EntityRef,
  EntityTypePlugin,
  MovementStrategy,
} from '../plugins/types';

export interface EntitySpawnConfig {
  entityId: string;
  entityType: string;
  hp: number;
  lifetime: number | null;
  isGatekeeper: boolean;
  spawnAnimation?: { duration: number; ease: string };
  upgradeOptions?: DishUpgradeOptions;
}

export class Entity extends Phaser.GameObjects.Container implements Poolable, EntityRef {
  /** StatusEffectManager 연결 (GameScene.create에서 설정) */
  private static statusEffectManager: StatusEffectManager | null = null;
  /** ECS World 연결 (GameScene.create에서 설정) */
  private static world: World | null = null;

  static setStatusEffectManager(manager: StatusEffectManager | null): void {
    Entity.statusEffectManager = manager;
  }

  static setWorld(world: World | null): void {
    Entity.world = world;
  }

  active: boolean = false;

  // === Core identity ===
  private _entityId: string = '';
  private _entityType: string = 'basic';

  // === HP ===
  private _currentHp: number = 0;
  private _maxHp: number = 0;

  // === Plugin delegation ===
  private typePlugin: EntityTypePlugin | null = null;
  private movementStrategy: MovementStrategy | null = null;

  // === Graphics ===
  private graphics: Phaser.GameObjects.Graphics;

  // === Timing ===
  private _elapsedTime: number = 0;
  private lifetime: number | null = null;
  private _isGatekeeper: boolean = false;
  private movementTime: number = 0;

  // === Cursor interaction ===
  private _isHovered: boolean = false;
  private damageTimer: Phaser.Time.TimerEvent | null = null;
  private isBeingDamaged: boolean = false;
  private damageInterval: number = 150;

  // === Visual state ===
  private hitFlashPhase: number = 0;
  private wobblePhase: number = 0;
  private blinkPhase: number = 0;
  private spawnDuration: number = 150;
  private spawnTween: Phaser.Tweens.Tween | null = null;

  // === Dish-specific state ===
  private dangerous: boolean = false;
  private invulnerable: boolean = false;
  private color: number = 0x00ffff;
  private _size: number = 30;
  private upgradeOptions: DishUpgradeOptions = {};
  private interactiveRadius: number = 40;
  private destroyedByAbility: boolean = false;

  // === Magnet effect ===
  private _isBeingPulled: boolean = false;
  private pullPhase: number = 0;

  // === Slow/freeze (frame cache, derived from StatusEffectManager) ===
  private slowFactor: number = 1.0;
  private _isFrozen: boolean = false;

  // === Movement ===
  private baseX: number = 0;
  private baseY: number = 0;

  // === Boss behavior (composition) ===
  private _isDead: boolean = false;
  private bossBehavior: BossEntityBehavior | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(30);
    body.setOffset(-30, -30);

    this.setVisible(false);
    this.setActive(false);
  }

  // === Poolable ===

  reset(): void {
    this.wobblePhase = 0;
    this.blinkPhase = 0;
    this._elapsedTime = 0;
    this._isHovered = false;
    this.hitFlashPhase = 0;
    this.isBeingDamaged = false;
    this._isBeingPulled = false;
    this.pullPhase = 0;
    this._isDead = false;
    this._isFrozen = false;
    this.slowFactor = 1.0;
    this.movementTime = 0;
    this.destroyedByAbility = false;
    this.clearDamageTimer();
    if (this.spawnTween) {
      this.spawnTween.stop();
      this.spawnTween = null;
    }
    this.bossBehavior?.stopAllTweens();
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
    this.rotation = 0;
  }

  // === Spawn ===

  spawn(x: number, y: number, config: EntitySpawnConfig, plugin: EntityTypePlugin): void {
    this._entityId = config.entityId;
    this._entityType = config.entityType;
    this.typePlugin = plugin;
    this.lifetime = config.lifetime;
    this._isGatekeeper = config.isGatekeeper;
    this.active = true;

    // HP setup
    this._maxHp = config.hp;
    this._currentHp = config.hp;

    // Upgrade options
    this.upgradeOptions = config.upgradeOptions ?? {};

    // Load type data
    const typeData = this.getEntityTypeData();
    if (typeData) {
      this._size = typeData.size ?? 30;
      this.color = typeData.color ? parseInt(typeData.color.replace('#', ''), 16) : 0x00ffff;
      this.dangerous = typeData.dangerous ?? false;
      this.invulnerable = typeData.invulnerable ?? false;

      const attackSpeedMultiplier = this.upgradeOptions.attackSpeedMultiplier ?? 1;
      this.damageInterval = Data.dishes.damage.damageInterval * attackSpeedMultiplier;

      const cursorSizeBonus = this.upgradeOptions.cursorSizeBonus ?? 0;
      const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
      this.interactiveRadius = this._size + cursorRadius;
    }

    // Position
    this.setPosition(x, y);
    this.baseX = x;
    this.baseY = y;

    // Physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(this._size);
    body.setOffset(-this._size, -this._size);
    body.setVelocity(0, 0);

    // Interactive
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, this.interactiveRadius),
      Phaser.Geom.Circle.Contains
    );

    // Movement strategy
    this.movementStrategy = plugin.createMovementStrategy?.(this._entityId) ?? null;
    this.movementStrategy?.init(x, y);

    // Boss-specific initialization
    if (config.isGatekeeper) {
      this.ensureBossBehavior();
      this.bossBehavior!.init(this._entityId, this._maxHp);
      this._size = Data.boss.visual.armor.radius;
      this.bossBehavior!.setupEventListeners(this._entityId);
    }

    // Spawn animation
    if (config.isGatekeeper) {
      const bossSpawn = Data.boss.spawn;
      this.spawnDuration = bossSpawn.duration;
      this.setAlpha(0);
      this.setScale(bossSpawn.initialScale);
      this.setVisible(true);
      this.spawnTween = this.scene.tweens.add({
        targets: this,
        alpha: 1,
        scale: { from: bossSpawn.initialScale, to: 1 },
        duration: bossSpawn.duration,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!this.scene) return;
          this.spawnTween = null;
        },
      });
    } else {
      const spawnAnim = config.spawnAnimation ?? { duration: 150, ease: 'Back.easeOut' };
      this.spawnDuration = spawnAnim.duration;
      this.setScale(0);
      this.setAlpha(0);
      this.spawnTween = this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: spawnAnim.duration,
        ease: spawnAnim.ease,
        onComplete: () => {
          if (!this.scene) return;
          this.spawnTween = null;
        },
      });
    }

    this.drawEntity();
    plugin.onSpawn?.(this);
    EventBus.getInstance().emit(GameEvents.DISH_SPAWNED, { x: this.x, y: this.y });

    this.syncToWorld();
  }

  /** Dual-write: Entity 필드를 World store에 동기 기록 */
  private syncToWorld(): void {
    const w = Entity.world;
    if (!w) return;

    const id = this._entityId;
    w.createEntity(id);

    w.identity.set(id, {
      entityId: id,
      entityType: this._entityType,
      isGatekeeper: this._isGatekeeper,
    });
    w.transform.set(id, {
      x: this.x, y: this.y,
      baseX: this.baseX, baseY: this.baseY,
      alpha: this.alpha, scaleX: this.scaleX, scaleY: this.scaleY,
    });
    w.health.set(id, { currentHp: this._currentHp, maxHp: this._maxHp });
    w.statusCache.set(id, {
      isFrozen: this._isFrozen, slowFactor: this.slowFactor, isShielded: false,
    });
    w.lifetime.set(id, {
      elapsedTime: this._elapsedTime, movementTime: this.movementTime,
      lifetime: this.lifetime, spawnDuration: this.spawnDuration,
      globalSlowPercent: this.upgradeOptions.globalSlowPercent ?? 0,
    });
    w.dishProps.set(id, {
      dangerous: this.dangerous, invulnerable: this.invulnerable,
      color: this.color, size: this._size,
      interactiveRadius: this.interactiveRadius,
      upgradeOptions: this.upgradeOptions,
      destroyedByAbility: this.destroyedByAbility,
    });
    w.cursorInteraction.set(id, {
      isHovered: this._isHovered, isBeingDamaged: this.isBeingDamaged,
      damageInterval: this.damageInterval,
      damageTimerHandle: this.damageTimer,
      cursorInteractionType: this.typePlugin?.config.cursorInteraction ?? 'dps',
    });
    w.visualState.set(id, {
      hitFlashPhase: this.hitFlashPhase, wobblePhase: this.wobblePhase,
      blinkPhase: this.blinkPhase, isBeingPulled: this._isBeingPulled,
      pullPhase: this.pullPhase,
    });
    w.movement.set(id, { strategy: this.movementStrategy });

    w.phaserNode.set(id, {
      container: this, graphics: this.graphics,
      body: this.body as Phaser.Physics.Arcade.Body | null,
      spawnTween: this.spawnTween,
    });

    if (this.bossBehavior) {
      w.bossBehavior.set(id, { behavior: this.bossBehavior });
    }
  }

  // === Tick Phase Methods (called by external systems) ===

  /** EntityStatusSystem: derive freeze/slow cache from StatusEffectManager */
  tickStatusEffects(): void {
    const sem = Entity.statusEffectManager;
    if (sem) {
      const id = this._entityId;
      this._isFrozen = sem.hasEffect(id, 'freeze') || sem.hasEffect(id, 'slow');
      const slowEffects = sem.getEffectsByType(id, 'slow');
      this.slowFactor = slowEffects.length > 0
        ? Math.min(...slowEffects.map(e => (e.data['factor'] as number) ?? 1.0))
        : 1.0;
    } else {
      this._isFrozen = false;
      this.slowFactor = 1.0;
    }
  }

  /** EntityTimingSystem: accumulate time + check lifetime. Returns true if timed out */
  tickTimeDelta(delta: number): boolean {
    const globalSlowPercent = this.upgradeOptions.globalSlowPercent ?? 0;
    const globalSlowFactor = 1 - globalSlowPercent;
    const effectiveDelta = delta * this.slowFactor * globalSlowFactor;
    this._elapsedTime += effectiveDelta;
    this.movementTime += delta;

    if (this.lifetime !== null && this._elapsedTime >= this.lifetime) {
      this.onTimeout();
      return true;
    }
    return false;
  }

  /** EntityMovementSystem: execute movement strategy + boss offsets, or wobble */
  tickMovement(delta: number): void {
    const isStunned = this.bossBehavior?.isHitStunned ?? false;
    if (this.movementStrategy && !this._isFrozen && !isStunned) {
      const pos = this.movementStrategy.update(delta, this._isFrozen, isStunned);
      this.baseX = pos.x;
      this.baseY = pos.y;

      const shakeX = this.bossBehavior?.shakeOffsetX ?? 0;
      const shakeY = this.bossBehavior?.shakeOffsetY ?? 0;
      const pushX = this.bossBehavior?.pushOffsetX ?? 0;
      const pushY = this.bossBehavior?.pushOffsetY ?? 0;
      this.x = this.baseX + shakeX + pushX;
      this.y = this.baseY + shakeY + pushY;
    } else if (!this.movementStrategy) {
      this.wobblePhase += 0.1 * this.slowFactor;
    }
  }

  /** EntityVisualSystem: visual counters + blink + boss vibration */
  tickVisual(delta: number): void {
    if (this._isBeingPulled) {
      this.pullPhase += 0.5;
    }

    if (this.hitFlashPhase > 0) {
      this.hitFlashPhase -= delta / 100;
      if (this.hitFlashPhase < 0) this.hitFlashPhase = 0;
    }

    if (this.lifetime !== null) {
      const timeRatio = this.getTimeRatio();
      if (timeRatio < 0.3) {
        this.blinkPhase += 0.3;
        this.setAlpha(0.5 + Math.sin(this.blinkPhase) * 0.5);
      }
    }

    if (this._isGatekeeper && this._maxHp > 0) {
      const dangerLevel = 1 - this._currentHp / this._maxHp;
      const bossFeedback = Data.boss.feedback;
      if (dangerLevel > bossFeedback.vibrationThreshold) {
        const intensity = bossFeedback.vibrationIntensity * dangerLevel;
        this.x += (Math.random() - 0.5) * intensity;
        this.y += (Math.random() - 0.5) * intensity;
      }
    }
  }

  /** EntityRenderSystem: drawEntity + typePlugin.onUpdate */
  tickRender(delta: number): void {
    this.drawEntity();
    this.typePlugin?.onUpdate?.(this, delta, this.movementTime);
  }

  /** Dead state accessor for system guards */
  getIsDead(): boolean { return this._isDead; }

  // === Damage ===

  setInCursorRange(inRange: boolean): void {
    const interaction = this.typePlugin?.config.cursorInteraction ?? 'dps';

    if (inRange && !this._isHovered) {
      this._isHovered = true;

      if (interaction === 'explode') {
        this.explode();
        return;
      }

      if (interaction === 'dps') {
        this.startDamaging();
      }
    } else if (!inRange && this._isHovered) {
      this._isHovered = false;
      if (interaction === 'dps') {
        this.stopDamaging();
      }
    }
  }

  private startDamaging(): void {
    if (this.isBeingDamaged || !this.active || this.invulnerable) return;

    this.isBeingDamaged = true;
    this.takeDamageFromCursor(true);

    this.damageTimer = this.scene.time.addEvent({
      delay: this.damageInterval,
      callback: () => this.takeDamageFromCursor(false),
      loop: true,
    });
  }

  private stopDamaging(): void {
    this.isBeingDamaged = false;
    this.clearDamageTimer();
  }

  private takeDamageFromCursor(isFirstHit: boolean): void {
    if (!this.active || this.invulnerable) return;

    const damageConfig = Data.dishes.damage;
    const { damage, isCritical } = DishDamageResolver.resolveCursorDamage(damageConfig, this.upgradeOptions);

    this._currentHp -= damage;
    this.hitFlashPhase = 1;

    EventBus.getInstance().emit(
      GameEvents.DISH_DAMAGED,
      DishEventPayloadFactory.createDishDamagedPayload({
        dish: this, type: this._entityType, damage,
        currentHp: this._currentHp, maxHp: this._maxHp,
        isFirstHit, isCritical, byAbility: false,
      })
    );

    this.typePlugin?.onDamaged?.(this, damage, 'cursor');
    if (this._currentHp <= 0) this.destroyEntity();
  }

  applyDamage(damage: number): void {
    if (!this.active || this.invulnerable) return;

    this.destroyedByAbility = true;
    this._currentHp -= damage;
    this.hitFlashPhase = 1;

    EventBus.getInstance().emit(
      GameEvents.DISH_DAMAGED,
      DishEventPayloadFactory.createDishDamagedPayload({
        dish: this, type: this._entityType, damage,
        currentHp: this._currentHp, maxHp: this._maxHp,
        isFirstHit: false, byAbility: true,
      })
    );

    this.typePlugin?.onDamaged?.(this, damage, 'ability');
    if (this._currentHp <= 0) this.destroyEntity();
  }

  applyDamageWithUpgrades(baseDamage: number, damageBonus: number, criticalChanceBonus: number): void {
    if (!this.active || this.invulnerable) return;

    const damageConfig = Data.dishes.damage;
    const { damage: totalDamage, isCritical } = DishDamageResolver.resolveUpgradeDamage(
      damageConfig, baseDamage, damageBonus, criticalChanceBonus
    );

    this._currentHp -= totalDamage;
    this.hitFlashPhase = 1;
    this.destroyedByAbility = true;

    EventBus.getInstance().emit(
      GameEvents.DISH_DAMAGED,
      DishEventPayloadFactory.createDishDamagedPayload({
        dish: this, type: this._entityType, damage: totalDamage,
        currentHp: this._currentHp, maxHp: this._maxHp,
        isFirstHit: false, isCritical, byAbility: true,
      })
    );

    if (this._currentHp <= 0) this.destroyEntity();
  }

  // === Boss-style contact damage (external) ===

  applyContactDamage(damage: number, sourceX: number, sourceY: number, _isCritical: boolean): void {
    if (!this.active || this._isDead) return;

    this._currentHp = Math.max(0, this._currentHp - damage);
    this.bossBehavior?.refreshArmorSegments(this._currentHp, this._maxHp);
    this.bossBehavior?.onDamage(sourceX, sourceY);
    this.typePlugin?.onDamaged?.(this, damage, 'cursor');

    if (this._currentHp <= 0) {
      this._isDead = true;
      this.bossBehavior?.playDeathAnimation();
      this.typePlugin?.onDestroyed?.(this);
      EventBus.getInstance().emit(GameEvents.MONSTER_DIED, { bossId: this._entityId });
    }
  }

  /** MonsterSystem 호환: 외부에서 HP 변경 시 호출 */
  handleExternalHpChange(currentHp: number, maxHp: number, sourceX?: number, sourceY?: number): void {
    if (this._isDead) return;

    this._currentHp = Math.max(0, Math.floor(currentHp));
    this._maxHp = Math.max(1, Math.floor(maxHp));
    this.bossBehavior?.refreshArmorSegments(this._currentHp, this._maxHp);
    this.bossBehavior?.onDamage(sourceX, sourceY);

    if (this._currentHp <= 0) {
      this._isDead = true;
      this.bossBehavior?.playDeathAnimation();
    }
  }

  // === Slow/freeze ===

  applySlow(duration: number, factor: number = 0.3): void {
    if (!this.active) return;
    const sem = Entity.statusEffectManager;
    if (sem) {
      const effectId = `${this._entityId}:slow`;
      sem.removeEffect(this._entityId, effectId);
      sem.applyEffect(this._entityId, {
        id: effectId,
        type: 'slow',
        duration,
        remaining: duration,
        data: { factor },
      });
    }
  }

  freeze(): void {
    const sem = Entity.statusEffectManager;
    if (sem) {
      const effectId = `${this._entityId}:freeze`;
      sem.applyEffect(this._entityId, {
        id: effectId,
        type: 'freeze',
        duration: Infinity,
        remaining: Infinity,
        data: {},
      });
    } else {
      this._isFrozen = true;
    }
  }

  unfreeze(): void {
    const sem = Entity.statusEffectManager;
    if (sem) {
      sem.removeEffect(this._entityId, `${this._entityId}:freeze`);
    } else {
      this._isFrozen = false;
    }
  }

  // === Magnet ===

  setBeingPulled(pulled: boolean): void { this._isBeingPulled = pulled; }

  // === Force destroy ===

  forceDestroy(byAbility: boolean = true): void {
    if (!this.active) return;
    this.destroyedByAbility = byAbility;
    this.destroyEntity();
  }

  // === FeedbackSystem (boss) ===

  setFeedbackSystem(feedbackSystem: FeedbackSystem): void {
    this.ensureBossBehavior();
    this.bossBehavior!.setFeedbackSystem(feedbackSystem);
  }

  // === Boss-compatible spawn ===

  spawnAt(x: number, y: number): void {
    if (!this.typePlugin) return;
    if (this.spawnTween) { this.spawnTween.stop(); this.spawnTween = null; }
    this.bossBehavior?.stopAllTweens();
    this._isDead = false;
    this._isFrozen = false;
    this.rotation = 0;
    this.movementTime = 0;
    this._elapsedTime = 0;

    if (this._maxHp > 0) this._currentHp = this._maxHp;

    this.setPosition(x, y);
    this.baseX = x;
    this.baseY = y;
    this.active = true;

    this.movementStrategy?.destroy();
    this.movementStrategy = this.typePlugin.createMovementStrategy?.(this._entityId) ?? null;
    this.movementStrategy?.init(x, y);

    this.ensureBossBehavior();
    this.bossBehavior!.init(this._entityId, this._maxHp);
    this._size = Data.boss.visual.armor.radius;
    this.bossBehavior!.setupEventListeners(this._entityId);

    const bossSpawn = Data.boss.spawn;
    this.setVisible(true);
    this.setAlpha(0);
    this.setScale(bossSpawn.initialScale);
    this.spawnTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: { from: bossSpawn.initialScale, to: 1 },
      duration: bossSpawn.duration,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.scene) return;
        this.spawnTween = null;
      },
    });
  }

  // === Private lifecycle ===

  private explode(): void {
    if (!this.active) return;
    this.active = false;
    this.clearDamageTimer();
    this.disableInteractive();
    this.removeAllListeners();

    EventBus.getInstance().emit(
      GameEvents.DISH_DESTROYED,
      DishEventPayloadFactory.createDishDestroyedPayload({ dish: this, type: this._entityType })
    );

    this.typePlugin?.onDestroyed?.(this);
    this.deactivate();
  }

  private destroyEntity(): void {
    this.active = false;
    this.clearDamageTimer();
    this.disableInteractive();
    this.removeAllListeners();

    EventBus.getInstance().emit(
      GameEvents.DISH_DESTROYED,
      DishEventPayloadFactory.createDishDestroyedPayload({
        dish: this, type: this._entityType, byAbility: this.destroyedByAbility,
      })
    );

    this.typePlugin?.onDestroyed?.(this);
    this.deactivate();
  }

  private onTimeout(): void {
    if (!this.active) return;
    this.clearDamageTimer();

    const eventData = DishEventPayloadFactory.createDishMissedPayload({
      dish: this, type: this._entityType, isDangerous: this.dangerous,
    });

    this.deactivate();
    this.typePlugin?.onTimeout?.(this);
    EventBus.getInstance().emit(GameEvents.DISH_MISSED, eventData);
  }

  deactivate(): void {
    this.active = false;
    Entity.world?.destroyEntity(this._entityId);
    Entity.statusEffectManager?.clearEntity(this._entityId);
    this.clearDamageTimer();
    if (this.spawnTween) { this.spawnTween.stop(); this.spawnTween = null; }
    this.bossBehavior?.stopAllTweens();
    this.bossBehavior?.teardownEventListeners();
    this.movementStrategy?.destroy();
    this.movementStrategy = null;
    this.setVisible(false);
    this.setActive(false);
    this.disableInteractive();
    this.removeAllListeners();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }

  public override destroy(fromScene?: boolean): void {
    if (this.spawnTween) { this.spawnTween.stop(); this.spawnTween = null; }
    this.bossBehavior?.destroy();
    this.clearDamageTimer();
    this.movementStrategy?.destroy();
    this.movementStrategy = null;
    super.destroy(fromScene);
  }

  // === Drawing ===

  private drawEntity(): void {
    if (this._isGatekeeper && this.bossBehavior) {
      this.bossBehavior.render(this.getHpRatio(), this.movementTime);
      return;
    }

    if (this.dangerous) {
      DishRenderer.renderDangerDish(this.graphics, { size: this._size, blinkPhase: this.blinkPhase });
      return;
    }

    DishRenderer.renderDish(this.graphics, {
      size: this._size, baseColor: this.color,
      currentHp: this._currentHp, maxHp: this._maxHp,
      isHovered: this._isHovered, isBeingPulled: this._isBeingPulled,
      pullPhase: this.pullPhase, hitFlashPhase: this.hitFlashPhase,
      isFrozen: this._isFrozen, wobblePhase: this.wobblePhase, blinkPhase: this.blinkPhase,
    });
  }

  // === Timer management ===

  private clearDamageTimer(): void {
    if (this.damageTimer) {
      this.damageTimer.destroy();
      this.damageTimer = null;
    }
  }

  // === Boss behavior helper ===

  private ensureBossBehavior(): void {
    if (this.bossBehavior) return;
    this.bossBehavior = new BossEntityBehavior(
      this.scene,
      this,
      (current, max, sourceX, sourceY) => this.handleExternalHpChange(current, max, sourceX, sourceY),
      () => {
        this._isDead = true;
        this.bossBehavior?.playDeathAnimation();
      }
    );
  }

  // === EntityRef implementation ===

  getEntityId(): string { return this._entityId; }
  getEntityType(): string { return this._entityType; }
  getCurrentHp(): number { return this._currentHp; }
  getMaxHp(): number { return this._maxHp; }
  getHpRatio(): number { return this._maxHp > 0 ? this._currentHp / this._maxHp : 1; }
  getSize(): number { return this._size; }

  // === Dish-compatibility getters ===

  getColor(): number { return this.color; }
  getDishType(): string { return this._entityType; }
  isDangerous(): boolean { return this.dangerous; }
  isFullySpawned(): boolean { return this._elapsedTime >= this.spawnDuration; }
  isSlowed(): boolean { return this._isFrozen; }

  getTimeRatio(): number {
    if (this.lifetime === null) return 1;
    return Math.max(0, 1 - this._elapsedTime / this.lifetime);
  }

  getLifetime(): number { return this.lifetime ?? Infinity; }
  getDamageInterval(): number { return this.damageInterval; }
  getInteractiveRadius(): number { return this.interactiveRadius; }
  getUpgradeOptions(): DishUpgradeOptions { return this.upgradeOptions; }
  isGatekeeper(): boolean { return this._isGatekeeper; }

  // === Boss-compatibility ===

  getBossId(): string { return this._entityId; }

  // === Helper ===

  private getEntityTypeData(): {
    size?: number; color?: string; dangerous?: boolean; invulnerable?: boolean;
  } | null {
    const dishData = Data.getDishData(this._entityType);
    if (dishData) {
      return { size: dishData.size, color: dishData.color, dangerous: dishData.dangerous, invulnerable: dishData.invulnerable };
    }
    return null;
  }
}
