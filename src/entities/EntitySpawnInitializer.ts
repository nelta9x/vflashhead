import Phaser from 'phaser';
import { Data } from '../data/DataManager';
import { CURSOR_HITBOX } from '../data/constants';
import { INVALID_ENTITY_ID } from '../world/EntityId';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { EntityId } from '../world/EntityId';
import type { Entity } from './Entity';
import type { EntitySpawnConfig } from './EntitySpawnConfig';
import type { World, BossStateComponent } from '../world';
import type { EntityTypePlugin } from '../plugins/types';

/**
 * Entity spawn 초기화 로직.
 * 타입 데이터 로드 → World 스토어 구성 → Phaser 물리/인터랙티브 설정
 * → 보스 초기화 → 스폰 애니메이션 → World spawn → 이동 데이터 → 초기 렌더링 → 이벤트.
 *
 * Returns the EntityId assigned by World.
 */
export function initializeEntitySpawn(
  entity: Entity,
  world: World,
  config: EntitySpawnConfig,
  plugin: EntityTypePlugin,
  x: number,
  y: number,
): EntityId {
  const upgradeOptions = config.upgradeOptions ?? {};

  // 1. 타입 데이터 로드
  const bombData = Data.getBombData(config.entityType);
  const isBomb = !!bombData;
  const dishData = isBomb ? undefined : Data.getDishData(config.entityType);
  const size = bombData?.size ?? dishData?.size ?? 30;
  const color = (bombData?.color ?? dishData?.color)
    ? parseInt((bombData?.color ?? dishData?.color ?? '#00ffff').replace('#', ''), 16)
    : 0x00ffff;

  const attackSpeedMultiplier = upgradeOptions.attackSpeedMultiplier ?? 1;
  const damageInterval = Data.dishes.damage.damageInterval * attackSpeedMultiplier;

  const cursorSizeBonus = upgradeOptions.cursorSizeBonus ?? 0;
  const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
  const interactiveRadius = size + cursorRadius;

  // 2. Position
  entity.setPosition(x, y);

  // 3. Physics body
  const body = entity.body as Phaser.Physics.Arcade.Body;
  body.enable = true;
  const bodySize = config.isGatekeeper ? Data.boss.visual.armor.radius : size;
  body.setCircle(bodySize);
  body.setOffset(-bodySize, -bodySize);
  body.setVelocity(0, 0);

  // 4. Interactive
  entity.setInteractive(
    new Phaser.Geom.Circle(0, 0, interactiveRadius),
    Phaser.Geom.Circle.Contains
  );

  // 5. Boss state initialization (pure data)
  let bossState: BossStateComponent | null = null;
  const finalSize = config.isGatekeeper ? Data.boss.visual.armor.radius : size;

  if (config.isGatekeeper) {
    const defaultArmorPieces = Math.max(1, Math.floor(Data.boss.visual.armor.maxPieces));

    bossState = {
      defaultArmorPieces,
      armorPieceCount: defaultArmorPieces,
      currentArmorCount: defaultArmorPieces,
      filledHpSlotCount: defaultArmorPieces,
      shakeOffsetX: 0,
      shakeOffsetY: 0,
      pushOffsetX: 0,
      pushOffsetY: 0,
      isHitStunned: false,
      pendingDamageReaction: false,
      damageSourceX: 0,
      damageSourceY: 0,
      pendingDeathAnimation: false,
      deathAnimationPlaying: false,
      reactionTweens: [],
      deathTween: null,
    };
  }

  // 6. Spawn animation
  let spawnDuration: number;
  let spawnTween: Phaser.Tweens.Tween | null = null;

  // assignedEntityId will be set after spawnFromArchetype; tween callbacks capture it via closure
  let assignedEntityId: EntityId = INVALID_ENTITY_ID;

  if (config.isGatekeeper) {
    const bossSpawn = Data.boss.spawn;
    spawnDuration = bossSpawn.duration;
    entity.setAlpha(0);
    entity.setScale(bossSpawn.initialScale);
    entity.setVisible(true);
    spawnTween = entity.scene.tweens.add({
      targets: entity,
      alpha: 1,
      scale: { from: bossSpawn.initialScale, to: 1 },
      duration: bossSpawn.duration,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!entity.scene) return;
        const pn = world.phaserNode.get(assignedEntityId);
        if (pn) pn.spawnTween = null;
      },
    });
  } else {
    const spawnAnim = config.spawnAnimation ?? { duration: 150, ease: 'Back.easeOut' };
    spawnDuration = spawnAnim.duration;
    entity.setScale(0);
    entity.setAlpha(0);
    spawnTween = entity.scene.tweens.add({
      targets: entity,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: spawnAnim.duration,
      ease: spawnAnim.ease,
      onComplete: () => {
        if (!entity.scene) return;
        const pn = world.phaserNode.get(assignedEntityId);
        if (pn) pn.spawnTween = null;
      },
    });
  }

  // 7. World 스토어 기록 (archetype 기반) — placeholder movement
  const archetypeId = plugin.config.archetypeId
    ?? (config.isGatekeeper ? 'boss' : 'dish');
  const archetype = world.archetypeRegistry.get(archetypeId);

  const placeholderMovement = { type: 'none' as const, homeX: x, homeY: y, movementTime: 0, drift: null };

  const values: Record<string, unknown> = {
    ...(config.isGatekeeper ? { bossTag: {} } : isBomb ? {} : { dishTag: {} }),
    identity: {
      entityId: 0, // placeholder — overwritten after spawn
      entityType: config.entityType,
      isGatekeeper: config.isGatekeeper,
    },
    transform: {
      x, y, baseX: x, baseY: y,
      alpha: entity.alpha, scaleX: entity.scaleX, scaleY: entity.scaleY,
    },
    health: { currentHp: config.hp, maxHp: config.hp, isDead: false },
    statusCache: { isFrozen: false, slowFactor: 1.0, isShielded: false },
    lifetime: {
      elapsedTime: 0, movementTime: 0,
      lifetime: config.lifetime, spawnDuration,
      globalSlowPercent: upgradeOptions.globalSlowPercent ?? 0,
    },
    ...(isBomb
      ? {
          bombProps: {
            color, size: finalSize,
            playerDamage: bombData!.playerDamage,
            resetCombo: bombData!.resetCombo,
            destroyedByAbility: false,
          },
        }
      : {
          dishProps: {
            color, size: finalSize,
            interactiveRadius, upgradeOptions,
            destroyedByAbility: false,
          },
        }),
    cursorInteraction: {
      isHovered: false, isBeingDamaged: false,
      damageInterval, damageTimerHandle: null,
      cursorInteractionType: plugin.config.cursorInteraction ?? 'dps',
    },
    visualState: {
      hitFlashPhase: 0, wobblePhase: 0, blinkPhase: 0,
      isBeingPulled: false, pullPhase: 0,
    },
    movement: placeholderMovement,
    phaserNode: {
      container: entity, graphics: entity.getGraphics(),
      body: entity.body as Phaser.Physics.Arcade.Body | null,
      spawnTween,
      bossRenderer: null,
      typePlugin: plugin,
    },
  };

  if (bossState) {
    values['bossState'] = bossState;
  }

  if (archetype) {
    assignedEntityId = world.spawnFromArchetype(archetype, values);
  } else {
    assignedEntityId = world.createEntity();
    for (const [key, val] of Object.entries(values)) {
      const store = world.getStoreByName(key);
      if (store) store.set(assignedEntityId, val);
    }
  }

  // 8. Patch identity.entityId with the real assigned ID
  const identityComp = world.identity.get(assignedEntityId);
  if (identityComp) identityComp.entityId = assignedEntityId;

  // 9. Compute movement with real entityId and update store
  const movementData = resolveMovementData(plugin, assignedEntityId, x, y);
  world.movement.set(assignedEntityId, movementData);

  // 10. Update entity's cached ID
  entity.setEntityId(assignedEntityId);

  // 11. Setup boss event listeners if needed
  if (config.isGatekeeper) {
    setupBossEventListeners(assignedEntityId, config.bossDataId);
  }

  // 12. Plugin callback (before render — onSpawn may refine bossState segments)
  plugin.onSpawn?.(assignedEntityId, world);

  // 13. Event (initial render is now done by plugin.onSpawn)
  EventBus.getInstance().emit(GameEvents.DISH_SPAWNED, { x, y });

  return assignedEntityId;
}

/** Get movement data from plugin or default to 'none' */
function resolveMovementData(
  plugin: EntityTypePlugin,
  entityId: EntityId,
  homeX: number,
  homeY: number,
): import('../world').MovementComponent {
  return plugin.createMovementData?.(entityId, homeX, homeY)
    ?? { type: 'none', homeX, homeY, movementTime: 0, drift: null };
}

/** Stored damage service getter — set during spawn via entity lookup */
let _damageServiceGetter: (() => import('../plugins/builtin/services/EntityDamageService').EntityDamageService | null) | null = null;

/** Called once from initializeEntitySpawn to set the damage service accessor */
export function setSpawnDamageServiceGetter(getter: () => import('../plugins/builtin/services/EntityDamageService').EntityDamageService | null): void {
  _damageServiceGetter = getter;
}

/**
 * Setup EventBus listeners for boss entities.
 * Routes MONSTER_HP_CHANGED to EntityDamageService.
 * bossDataId is the string ID from waves.json (e.g. "boss_center").
 */
function setupBossEventListeners(entityId: EntityId, bossDataId?: string): void {
  const bus = EventBus.getInstance();
  const matchId = bossDataId ?? String(entityId);

  const onHpChanged = (...args: unknown[]) => {
    const data = args[0] as {
      bossId: string;
      current?: number;
      max?: number;
      ratio: number;
      sourceX?: number;
      sourceY?: number;
    };
    if (data.bossId !== matchId) return;
    const max = typeof data.max === 'number' && data.max > 0 ? Math.floor(data.max) : 0;
    const current = typeof data.current === 'number'
      ? Math.max(0, Math.floor(data.current))
      : Math.round(max * data.ratio);

    _damageServiceGetter?.()?.handleExternalHpChange(entityId, current, max, data.sourceX, data.sourceY);
  };

  bus.on(GameEvents.MONSTER_HP_CHANGED, onHpChanged);
}
