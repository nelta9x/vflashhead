import type { BossRenderer } from '../effects/BossRenderer';
import type { DishUpgradeOptions } from '../entities/EntityTypes';
import type { CursorInteractionType, EntityTypePlugin } from '../plugins/types';
import type { CursorSmoothingConfig } from '../data/types';
import { defineComponent } from './ComponentDef';

// === Tags ===
export type DishTag = Record<string, never>;
export const C_DishTag = defineComponent<DishTag>('dishTag');
export type BossTag = Record<string, never>;
export const C_BossTag = defineComponent<BossTag>('bossTag');

// === C1: Identity ===
export interface IdentityComponent {
  entityId: string;
  entityType: string;
  isGatekeeper: boolean;
}
export const C_Identity = defineComponent<IdentityComponent>('identity');

// === C2: Transform ===
export interface TransformComponent {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
}
export const C_Transform = defineComponent<TransformComponent>('transform');

// === C3: Health ===
export interface HealthComponent {
  currentHp: number;
  maxHp: number;
  isDead: boolean;
}
export const C_Health = defineComponent<HealthComponent>('health');

// === C4: StatusCache (frame-level cache from StatusEffectManager) ===
export interface StatusCacheComponent {
  isFrozen: boolean;
  slowFactor: number;
  isShielded: boolean;
}
export const C_StatusCache = defineComponent<StatusCacheComponent>('statusCache');

// === C5: Lifetime (time-based entities) ===
export interface LifetimeComponent {
  elapsedTime: number;
  movementTime: number;
  lifetime: number | null;
  spawnDuration: number;
  globalSlowPercent: number;
}
export const C_Lifetime = defineComponent<LifetimeComponent>('lifetime');

// === C6: DishProps (dish-specific data) ===
export interface DishPropsComponent {
  dangerous: boolean;
  invulnerable: boolean;
  color: number;
  size: number;
  interactiveRadius: number;
  upgradeOptions: DishUpgradeOptions;
  destroyedByAbility: boolean;
}
export const C_DishProps = defineComponent<DishPropsComponent>('dishProps');

// === C7: CursorInteraction ===
export interface CursorInteractionComponent {
  isHovered: boolean;
  isBeingDamaged: boolean;
  damageInterval: number;
  damageTimerHandle: unknown;
  cursorInteractionType: CursorInteractionType;
}
export const C_CursorInteraction = defineComponent<CursorInteractionComponent>('cursorInteraction');

// === C8: VisualState (animation phases) ===
export interface VisualStateComponent {
  hitFlashPhase: number;
  wobblePhase: number;
  blinkPhase: number;
  isBeingPulled: boolean;
  pullPhase: number;
}
export const C_VisualState = defineComponent<VisualStateComponent>('visualState');

// === C9: Movement (pure data — no class instances) ===
export interface DriftData {
  xAmplitude: number;
  xFrequency: number;
  yAmplitude: number;
  yFrequency: number;
  phaseX: number;
  phaseY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface MovementComponent {
  type: 'drift' | 'none';
  homeX: number;
  homeY: number;
  movementTime: number;
  drift: DriftData | null;
}
export const C_Movement = defineComponent<MovementComponent>('movement');

// === C10: PhaserNode (Phaser object references) ===
export interface PhaserNodeComponent {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  body: Phaser.Physics.Arcade.Body | null;
  spawnTween: Phaser.Tweens.Tween | null;
  bossRenderer: BossRenderer | null;
  typePlugin: EntityTypePlugin | null;
}
export const C_PhaserNode = defineComponent<PhaserNodeComponent>('phaserNode');

// === C11: BossState (pure data — no class instances) ===
export interface BossStateComponent {
  defaultArmorPieces: number;
  armorPieceCount: number;
  currentArmorCount: number;
  filledHpSlotCount: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  pushOffsetX: number;
  pushOffsetY: number;
  isHitStunned: boolean;
  pendingDamageReaction: boolean;
  damageSourceX: number;
  damageSourceY: number;
  pendingDeathAnimation: boolean;
  deathAnimationPlaying: boolean;
  reactionTweens: Phaser.Tweens.Tween[];
  deathTween: Phaser.Tweens.Tween | null;
}
export const C_BossState = defineComponent<BossStateComponent>('bossState');

// === FallingBomb components ===
export interface FallingBombComponent {
  moveSpeed: number;
  blinkPhase: number;
  fullySpawned: boolean;
}
export const C_FallingBomb = defineComponent<FallingBombComponent>('fallingBomb');

// === HealthPack components ===
export interface HealthPackComponent {
  moveSpeed: number;
  pulsePhase: number;
  hasPreMissWarningEmitted: boolean;
}
export const C_HealthPack = defineComponent<HealthPackComponent>('healthPack');

// === Player-specific components ===

// === P1: PlayerInput ===
export interface PlayerInputComponent {
  targetX: number;
  targetY: number;
  smoothingConfig: CursorSmoothingConfig;
}
export const C_PlayerInput = defineComponent<PlayerInputComponent>('playerInput');

// === P2: PlayerRender ===
export interface PlayerRenderComponent {
  gaugeRatio: number;
  gameTime: number;
}
export const C_PlayerRender = defineComponent<PlayerRenderComponent>('playerRender');
