import type Phaser from 'phaser';
import type { EntityId } from '../../world/EntityId';
import type { AttackPattern } from './AttackPattern';
import type { World, MovementComponent } from '../../world';

export type CursorInteractionType = 'dps' | 'contact' | 'explode' | 'none';
export type EntitySpawnCategory = 'pooled' | 'singleton';

export interface EntityTypeConfig {
  spawnCategory: EntitySpawnCategory;
  poolSize: number;
  defaultLifetime: number | null;
  isGatekeeper: boolean;
  cursorInteraction: CursorInteractionType;
  archetypeId?: string;
}

/** 엔티티 타입별 렌더러 */
export interface EntityTypeRenderer {
  render(entityId: EntityId, world: World, timeElapsed: number): void;
  playHitFlash?(duration: number): void;
  destroy(): void;
}

export type DamageSource = 'cursor' | 'ability' | 'orb' | 'blackHole' | 'missile' | 'laser';

/**
 * 엔티티 타입 플러그인 인터페이스
 * - BasicDish: 일반 접시 타입들 (basic, golden, crystal, mini, amber)
 * - BombDish: 폭탄 접시
 * - StandardBoss: 표준 보스
 */
export interface EntityTypePlugin {
  readonly typeId: string;
  readonly config: EntityTypeConfig;

  createRenderer(scene: Phaser.Scene, host: Phaser.GameObjects.Container): EntityTypeRenderer;
  createMovementData?(entityId: EntityId, homeX: number, homeY: number): MovementComponent;
  createAttackPatterns?(scene: Phaser.Scene, entityId: EntityId): AttackPattern[];

  /** singleton 엔티티 스폰. archetype 해석 + 컴포넌트 조립 + 후처리까지 플러그인이 전담. */
  spawn?(world: World): EntityId;
  onSpawn?(entityId: EntityId, world: World): void;
  onUpdate?(entityId: EntityId, world: World, delta: number, gameTime: number): void;
  onDamaged?(entityId: EntityId, world: World, damage: number, source: DamageSource): void;
  onDestroyed?(entityId: EntityId, world: World): void;
  onTimeout?(entityId: EntityId, world: World): void;
}
