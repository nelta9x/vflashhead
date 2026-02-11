import type { BossEntityBehavior } from '../entities/BossEntityBehavior';
import type { MovementStrategy } from '../plugins/types';
import type { DishUpgradeOptions } from '../entities/EntityTypes';
import type { CursorInteractionType } from '../plugins/types';
import type { CursorSmoothingConfig } from '../data/types';

// === C1: Identity ===
export interface IdentityComponent {
  entityId: string;
  entityType: string;
  isGatekeeper: boolean;
}

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

// === C3: Health ===
export interface HealthComponent {
  currentHp: number;
  maxHp: number;
}

// === C4: StatusCache (frame-level cache from StatusEffectManager) ===
export interface StatusCacheComponent {
  isFrozen: boolean;
  slowFactor: number;
  isShielded: boolean;
}

// === C5: Lifetime (time-based entities) ===
export interface LifetimeComponent {
  elapsedTime: number;
  movementTime: number;
  lifetime: number | null;
  spawnDuration: number;
  globalSlowPercent: number;
}

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

// === C7: CursorInteraction ===
export interface CursorInteractionComponent {
  isHovered: boolean;
  isBeingDamaged: boolean;
  damageInterval: number;
  damageTimerHandle: unknown;
  cursorInteractionType: CursorInteractionType;
}

// === C8: VisualState (animation phases) ===
export interface VisualStateComponent {
  hitFlashPhase: number;
  wobblePhase: number;
  blinkPhase: number;
  isBeingPulled: boolean;
  pullPhase: number;
}

// === C9: Movement ===
export interface MovementComponent {
  strategy: MovementStrategy | null;
}

// === C10: PhaserNode (Phaser object references) ===
export interface PhaserNodeComponent {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  body: Phaser.Physics.Arcade.Body | null;
  spawnTween: Phaser.Tweens.Tween | null;
}

// === C11: BossBehavior ===
export interface BossBehaviorComponent {
  behavior: BossEntityBehavior;
}

// === Player-specific components ===

// === P1: PlayerInput ===
export interface PlayerInputComponent {
  targetX: number;
  targetY: number;
  smoothingConfig: CursorSmoothingConfig;
}

// === P2: PlayerRender ===
export interface PlayerRenderComponent {
  gaugeRatio: number;
  gameTime: number;
}
