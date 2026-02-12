import Phaser from 'phaser';
import { Data } from '../data/DataManager';
import { CURSOR_HITBOX } from '../data/constants';
import { EventBus, GameEvents } from '../utils/EventBus';
import { DishRenderer } from '../effects/DishRenderer';
import { BossRenderer } from '../effects/BossRenderer';
import { resolveBossHpSegmentState } from './bossHpSegments';
import type { Entity } from './Entity';
import type { EntitySpawnConfig } from './EntitySpawnConfig';
import type { World, BossStateComponent } from '../world';
import type { EntityTypePlugin } from '../plugins/types';

/**
 * Entity spawn 초기화 로직.
 * 타입 데이터 로드 → World 스토어 구성 → Phaser 물리/인터랙티브 설정
 * → 이동 데이터 → 보스 초기화 → 스폰 애니메이션 → 초기 렌더링 → 이벤트.
 */
export function initializeEntitySpawn(
  entity: Entity,
  world: World,
  config: EntitySpawnConfig,
  plugin: EntityTypePlugin,
  x: number,
  y: number,
): void {
  const upgradeOptions = config.upgradeOptions ?? {};

  // 1. 타입 데이터 로드
  const dishData = Data.getDishData(config.entityType);
  const size = dishData?.size ?? 30;
  const color = dishData?.color ? parseInt(dishData.color.replace('#', ''), 16) : 0x00ffff;
  const dangerous = dishData?.dangerous ?? false;
  const invulnerable = dishData?.invulnerable ?? false;

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

  // 5. Movement data (pure data — no class instances)
  const movementData = resolveMovementData(plugin, config.entityId, x, y);

  // 6. Boss state initialization (pure data)
  let bossRenderer: BossRenderer | null = null;
  let bossState: BossStateComponent | null = null;
  const finalSize = config.isGatekeeper ? Data.boss.visual.armor.radius : size;

  if (config.isGatekeeper) {
    bossRenderer = new BossRenderer(entity.scene, entity);
    entity.setDepth(Data.boss.depth);

    const bossConfig = Data.boss.visual;
    const defaultArmorPieces = Math.max(1, Math.floor(bossConfig.armor.maxPieces));

    // Compute initial armor segments
    const segmentState = resolveBossHpSegmentState(config.hp, config.hp, {
      defaultPieces: defaultArmorPieces,
      hpScale: bossConfig.armor.hpSegments,
    });

    bossState = {
      defaultArmorPieces,
      armorPieceCount: Math.max(1, segmentState.pieceCount),
      currentArmorCount: Phaser.Math.Clamp(segmentState.filledPieces, 0, Math.max(1, segmentState.pieceCount)),
      filledHpSlotCount: segmentState.filledPieces,
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

    // Setup EventBus listeners for MONSTER_HP_CHANGED / MONSTER_DIED
    setupBossEventListeners(config.entityId);
  }

  // 7. Spawn animation
  let spawnDuration: number;
  let spawnTween: Phaser.Tweens.Tween | null = null;

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
        const pn = world.phaserNode.get(config.entityId);
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
        const pn = world.phaserNode.get(config.entityId);
        if (pn) pn.spawnTween = null;
      },
    });
  }

  // 8. World 스토어 기록 (archetype 기반)
  const archetypeId = plugin.config.archetypeId
    ?? (config.isGatekeeper ? 'boss' : 'dish');
  const archetype = world.archetypeRegistry.get(archetypeId);

  const values: Record<string, unknown> = {
    ...(config.isGatekeeper ? { bossTag: {} } : { dishTag: {} }),
    identity: {
      entityId: config.entityId, entityType: config.entityType,
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
    dishProps: {
      dangerous, invulnerable, color, size: finalSize,
      interactiveRadius, upgradeOptions,
      destroyedByAbility: false,
    },
    cursorInteraction: {
      isHovered: false, isBeingDamaged: false,
      damageInterval, damageTimerHandle: null,
      cursorInteractionType: plugin.config.cursorInteraction ?? 'dps',
    },
    visualState: {
      hitFlashPhase: 0, wobblePhase: 0, blinkPhase: 0,
      isBeingPulled: false, pullPhase: 0,
    },
    movement: movementData,
    phaserNode: {
      container: entity, graphics: entity.getGraphics(),
      body: entity.body as Phaser.Physics.Arcade.Body | null,
      spawnTween,
      bossRenderer,
      typePlugin: plugin,
    },
  };

  if (bossState) {
    values['bossState'] = bossState;
  }

  if (archetype) {
    world.spawnFromArchetype(archetype, config.entityId, values);
  } else {
    world.createEntity(config.entityId);
    for (const [key, val] of Object.entries(values)) {
      const store = world.getStoreByName(key);
      if (store) store.set(config.entityId, val);
    }
  }

  // 9. Initial render
  if (config.isGatekeeper && bossRenderer && bossState) {
    bossRenderer.render({
      hpRatio: 1,
      timeElapsed: 0,
      armorPieceCount: bossState.armorPieceCount,
      filledArmorPieceCount: bossState.currentArmorCount,
    });
  } else if (dangerous) {
    DishRenderer.renderDangerDish(entity.getGraphics(), { size: finalSize, blinkPhase: 0 });
  } else {
    DishRenderer.renderDish(entity.getGraphics(), {
      size: finalSize, baseColor: color,
      currentHp: config.hp, maxHp: config.hp,
      isHovered: false, isBeingPulled: false,
      pullPhase: 0, hitFlashPhase: 0,
      isFrozen: false, wobblePhase: 0, blinkPhase: 0,
    });
  }

  // 10. Plugin callback + event
  plugin.onSpawn?.(config.entityId, world);
  EventBus.getInstance().emit(GameEvents.DISH_SPAWNED, { x, y });
}

/** Get movement data from plugin or default to 'none' */
function resolveMovementData(
  plugin: EntityTypePlugin,
  entityId: string,
  homeX: number,
  homeY: number,
): import('../world').MovementComponent {
  return plugin.createMovementData?.(entityId, homeX, homeY)
    ?? { type: 'none', homeX, homeY, movementTime: 0, drift: null };
}

/** Stored damage service getter — set during spawn via entity lookup */
let _damageServiceGetter: (() => import('../systems/EntityDamageService').EntityDamageService | null) | null = null;

/** Called once from initializeEntitySpawn to set the damage service accessor */
export function setSpawnDamageServiceGetter(getter: () => import('../systems/EntityDamageService').EntityDamageService | null): void {
  _damageServiceGetter = getter;
}

/**
 * Setup EventBus listeners for boss entities.
 * Routes MONSTER_HP_CHANGED to EntityDamageService.
 * MONSTER_DIED is handled by EntityDamageService.applyContactDamage directly.
 */
function setupBossEventListeners(entityId: string): void {
  const bus = EventBus.getInstance();

  const onHpChanged = (...args: unknown[]) => {
    const data = args[0] as {
      bossId: string;
      current?: number;
      max?: number;
      ratio: number;
      sourceX?: number;
      sourceY?: number;
    };
    if (data.bossId !== entityId) return;
    const max = typeof data.max === 'number' && data.max > 0 ? Math.floor(data.max) : 0;
    const current = typeof data.current === 'number'
      ? Math.max(0, Math.floor(data.current))
      : Math.round(max * data.ratio);

    _damageServiceGetter?.()?.handleExternalHpChange(entityId, current, max, data.sourceX, data.sourceY);
  };

  bus.on(GameEvents.MONSTER_HP_CHANGED, onHpChanged);
}
