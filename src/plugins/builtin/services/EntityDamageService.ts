import { Data } from '../../../data/DataManager';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import { DishDamageResolver } from './DishDamageResolver';
import type { CurseModifiers } from './DishDamageResolver';
import { DishEventPayloadFactory } from './DishEventPayloadFactory';
import { createEntitySnapshot } from '../../../entities/EntitySnapshot';
import { deactivateEntity } from '../../../entities/EntityLifecycle';
import type { EntityId } from '../../../world/EntityId';
import type { Entity } from '../../../entities/Entity';
import type { World } from '../../../world';
import type { StatusEffectManager } from '../../../systems/StatusEffectManager';

/**
 * EntityDamageService: 데미지 계산, 이벤트 발행, 상태효과를 Entity에서 분리.
 * World 스토어를 직접 읽고/쓰며, entityLookup으로 Entity 참조를 획득한다.
 * 데미지 타이머는 내부 Map으로 관리한다.
 */
export class EntityDamageService {
  private readonly timers = new Map<EntityId, Phaser.Time.TimerEvent>();
  private getCurseModifiers: (() => CurseModifiers) | null = null;

  constructor(
    private readonly world: World,
    private readonly sem: StatusEffectManager,
    private readonly entityLookup: (entityId: EntityId) => Entity | undefined,
    private readonly scene: Phaser.Scene,
  ) {}

  setCurseModifiersProvider(provider: () => CurseModifiers): void {
    this.getCurseModifiers = provider;
  }

  // === Cursor interaction ===

  setInCursorRange(entityId: EntityId, inRange: boolean): void {
    const ci = this.world.cursorInteraction.get(entityId);
    const interaction = ci?.cursorInteractionType ?? 'dps';
    const entity = this.entityLookup(entityId);
    if (!entity) return;

    if (inRange && !(ci?.isHovered)) {
      if (ci) ci.isHovered = true;

      if (interaction === 'explode') {
        this.explode(entityId);
        return;
      }

      if (interaction === 'dps') {
        this.startDamaging(entityId);
      }
    } else if (!inRange && ci?.isHovered) {
      ci.isHovered = false;
      if (interaction === 'dps') {
        this.stopDamaging(entityId);
      }
    }
  }

  private startDamaging(entityId: EntityId): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const ci = this.world.cursorInteraction.get(entityId);
    if (!ci || ci.isBeingDamaged) return;

    ci.isBeingDamaged = true;
    this.takeDamageFromCursor(entityId, true);

    const timer = this.scene.time.addEvent({
      delay: ci.damageInterval,
      callback: () => this.takeDamageFromCursor(entityId, false),
      loop: true,
    });
    this.setDamageTimer(entityId, timer);
  }

  private stopDamaging(entityId: EntityId): void {
    const ci = this.world.cursorInteraction.get(entityId);
    if (ci) ci.isBeingDamaged = false;

    this.clearDamageTimer(entityId);
  }

  private takeDamageFromCursor(entityId: EntityId, isFirstHit: boolean): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const dp = this.world.dishProps.get(entityId);
    const health = this.world.health.get(entityId);
    if (!health) return;

    const damageConfig = Data.entityDamage;
    const upgradeOptions = dp?.upgradeOptions ?? {};
    const curseModifiers = this.getCurseModifiers?.() ?? undefined;
    const { damage, isCritical } = DishDamageResolver.resolveCursorDamage(damageConfig, upgradeOptions, curseModifiers);

    health.currentHp -= damage;

    const vs = this.world.visualState.get(entityId);
    if (vs) vs.hitFlashPhase = 1;

    const snapshot = createEntitySnapshot(this.world, entityId);
    EventBus.getInstance().emit(
      GameEvents.DISH_DAMAGED,
      DishEventPayloadFactory.createDishDamagedPayload({
        snapshot, damage,
        currentHp: health.currentHp, maxHp: health.maxHp,
        isFirstHit, isCritical, byAbility: false,
      })
    );

    this.invokePluginOnDamaged(entityId, damage, 'cursor');
    if (health.currentHp <= 0) this.destroyEntity(entityId);
  }

  // === Ability damage ===

  applyDamage(entityId: EntityId, damage: number): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const dp = this.world.dishProps.get(entityId);
    if (dp) dp.destroyedByAbility = true;

    const health = this.world.health.get(entityId);
    if (!health) return;

    // 글로벌 데미지 승수 적용 (글래스 캐논 + 광전사)
    const mods = this.getCurseModifiers?.();
    const effectiveDamage = mods && mods.globalDamageMultiplier !== 1
      ? damage * mods.globalDamageMultiplier
      : damage;

    health.currentHp -= effectiveDamage;

    const vs = this.world.visualState.get(entityId);
    if (vs) vs.hitFlashPhase = 1;

    const snapshot = createEntitySnapshot(this.world, entityId);
    EventBus.getInstance().emit(
      GameEvents.DISH_DAMAGED,
      DishEventPayloadFactory.createDishDamagedPayload({
        snapshot, damage: effectiveDamage,
        currentHp: health.currentHp, maxHp: health.maxHp,
        isFirstHit: false, byAbility: true,
      })
    );

    this.invokePluginOnDamaged(entityId, effectiveDamage, 'ability');
    if (health.currentHp <= 0) this.destroyEntity(entityId);
  }

  // === Upgrade damage ===

  applyUpgradeDamage(entityId: EntityId, baseDamage: number, damageBonus: number, criticalChanceBonus: number): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const dp = this.world.dishProps.get(entityId);
    const health = this.world.health.get(entityId);
    if (!health) return;

    const damageConfig = Data.entityDamage;
    const upgradeCurseModifiers = this.getCurseModifiers?.() ?? undefined;
    const { damage: totalDamage, isCritical } = DishDamageResolver.resolveUpgradeDamage(
      damageConfig, baseDamage, damageBonus, criticalChanceBonus, upgradeCurseModifiers
    );

    health.currentHp -= totalDamage;
    if (dp) dp.destroyedByAbility = true;

    const vs = this.world.visualState.get(entityId);
    if (vs) vs.hitFlashPhase = 1;

    const snapshot = createEntitySnapshot(this.world, entityId);
    EventBus.getInstance().emit(
      GameEvents.DISH_DAMAGED,
      DishEventPayloadFactory.createDishDamagedPayload({
        snapshot, damage: totalDamage,
        currentHp: health.currentHp, maxHp: health.maxHp,
        isFirstHit: false, isCritical, byAbility: true,
      })
    );

    if (health.currentHp <= 0) this.destroyEntity(entityId);
  }

  // === Boss contact damage ===

  applyContactDamage(entityId: EntityId, damage: number, sourceX: number, sourceY: number): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const health = this.world.health.get(entityId);
    if (!health || health.isDead) return;

    health.currentHp = Math.max(0, health.currentHp - damage);

    const bs = this.world.bossState.get(entityId);
    if (bs) {
      bs.pendingDamageReaction = true;
      bs.damageSourceX = sourceX;
      bs.damageSourceY = sourceY;
    }

    this.invokePluginOnDamaged(entityId, damage, 'cursor');

    if (health.currentHp <= 0) {
      health.isDead = true;
      if (bs) bs.pendingDeathAnimation = true;
      this.invokePluginOnDestroyed(entityId);
      EventBus.getInstance().emit(GameEvents.MONSTER_DIED, { bossId: entityId });
    }
  }

  // === External HP change (MonsterSystem) ===

  handleExternalHpChange(entityId: EntityId, currentHp: number, maxHp: number, sourceX?: number, sourceY?: number): void {
    const entity = this.entityLookup(entityId);
    if (!entity) return;

    const health = this.world.health.get(entityId);
    if (!health || health.isDead) return;

    health.currentHp = Math.max(0, Math.floor(currentHp));
    health.maxHp = Math.max(1, Math.floor(maxHp));

    const bs = this.world.bossState.get(entityId);
    if (bs && sourceX !== undefined && sourceY !== undefined) {
      bs.pendingDamageReaction = true;
      bs.damageSourceX = sourceX;
      bs.damageSourceY = sourceY;
    }

    if (health.currentHp <= 0) {
      health.isDead = true;
      if (bs) bs.pendingDeathAnimation = true;
    }
  }

  // === Force destroy ===

  forceDestroy(entityId: EntityId, byAbility: boolean = true): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const dp = this.world.dishProps.get(entityId);
    if (dp) dp.destroyedByAbility = byAbility;

    const bp = this.world.bombProps.get(entityId);
    if (bp) bp.destroyedByAbility = byAbility;

    this.destroyEntity(entityId);
  }

  // === Explode (bomb interaction) ===

  explode(entityId: EntityId): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    entity.active = false;
    this.clearDamageTimer(entityId);
    entity.disableInteractive();
    entity.removeAllListeners();

    const bp = this.world.bombProps.get(entityId);
    const t = this.world.transform.get(entityId);
    EventBus.getInstance().emit(GameEvents.BOMB_DESTROYED, {
      entityId,
      x: t?.x ?? 0,
      y: t?.y ?? 0,
      byAbility: false,
      playerDamage: bp?.playerDamage ?? 1,
      resetCombo: bp?.resetCombo ?? true,
    });

    this.invokePluginOnDestroyed(entityId);
    deactivateEntity(entity, this.world, this.sem);
  }

  // === Timeout ===

  handleTimeout(entityId: EntityId): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    this.clearDamageTimer(entityId);

    const isBomb = this.world.bombProps.has(entityId);

    if (isBomb) {
      const t = this.world.transform.get(entityId);
      this.invokePluginOnTimeout(entityId);
      EventBus.getInstance().emit(GameEvents.BOMB_MISSED, {
        entityId,
        x: t?.x ?? 0,
        y: t?.y ?? 0,
      });
      deactivateEntity(entity, this.world, this.sem);
    } else {
      const snapshot = createEntitySnapshot(this.world, entityId);
      const eventData = DishEventPayloadFactory.createDishMissedPayload({ snapshot });
      deactivateEntity(entity, this.world, this.sem);
      this.invokePluginOnTimeout(entityId);
      EventBus.getInstance().emit(GameEvents.DISH_MISSED, eventData);
    }
  }

  // === Status effects ===

  applySlow(entityId: EntityId, duration: number, factor: number = 0.3): void {
    const entity = this.entityLookup(entityId);
    if (!entity?.active) return;

    const effectId = `${entityId}:slow`;
    this.sem.removeEffect(entityId, effectId);
    this.sem.applyEffect(entityId, {
      id: effectId,
      type: 'slow',
      duration,
      remaining: duration,
      data: { factor },
    });
  }

  freeze(entityId: EntityId): void {
    const effectId = `${entityId}:freeze`;
    this.sem.applyEffect(entityId, {
      id: effectId,
      type: 'freeze',
      duration: Infinity,
      remaining: Infinity,
      data: {},
    });
  }

  unfreeze(entityId: EntityId): void {
    this.sem.removeEffect(entityId, `${entityId}:freeze`);
  }

  // === Magnet ===

  setBeingPulled(entityId: EntityId, pulled: boolean): void {
    const vs = this.world.visualState.get(entityId);
    if (vs) vs.isBeingPulled = pulled;
  }

  // === Timer management ===

  private setDamageTimer(entityId: EntityId, timer: Phaser.Time.TimerEvent): void {
    this.clearDamageTimer(entityId);
    this.timers.set(entityId, timer);
  }

  clearDamageTimer(entityId: EntityId): void {
    const timer = this.timers.get(entityId);
    if (timer) {
      timer.destroy();
      this.timers.delete(entityId);
    }
  }

  // === Plugin helpers (World 스토어에서 typePlugin 조회) ===

  private getTypePlugin(entityId: EntityId) {
    const node = this.world.phaserNode.get(entityId);
    return node?.typePlugin ?? null;
  }

  private invokePluginOnDamaged(entityId: EntityId, damage: number, source: string): void {
    const plugin = this.getTypePlugin(entityId);
    plugin?.onDamaged?.(entityId, this.world, damage, source as import('../../types').DamageSource);
  }

  private invokePluginOnDestroyed(entityId: EntityId): void {
    const plugin = this.getTypePlugin(entityId);
    plugin?.onDestroyed?.(entityId, this.world);
  }

  private invokePluginOnTimeout(entityId: EntityId): void {
    const plugin = this.getTypePlugin(entityId);
    plugin?.onTimeout?.(entityId, this.world);
  }

  // === Private: standard destroy ===

  private destroyEntity(entityId: EntityId): void {
    const entity = this.entityLookup(entityId);
    if (!entity) return;

    entity.active = false;
    this.clearDamageTimer(entityId);
    entity.disableInteractive();
    entity.removeAllListeners();

    const bp = this.world.bombProps.get(entityId);
    if (bp) {
      const t = this.world.transform.get(entityId);
      EventBus.getInstance().emit(GameEvents.BOMB_DESTROYED, {
        entityId,
        x: t?.x ?? 0,
        y: t?.y ?? 0,
        byAbility: bp.destroyedByAbility,
        playerDamage: bp.playerDamage,
        resetCombo: bp.resetCombo,
      });
    } else {
      const dp = this.world.dishProps.get(entityId);
      const snapshot = createEntitySnapshot(this.world, entityId);
      EventBus.getInstance().emit(
        GameEvents.DISH_DESTROYED,
        DishEventPayloadFactory.createDishDestroyedPayload({
          snapshot,
          byAbility: dp?.destroyedByAbility,
        })
      );
    }

    this.invokePluginOnDestroyed(entityId);
    deactivateEntity(entity, this.world, this.sem);
  }
}
