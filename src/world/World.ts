import { ComponentStore } from './ComponentStore';
import type {
  IdentityComponent,
  TransformComponent,
  HealthComponent,
  StatusCacheComponent,
  LifetimeComponent,
  DishPropsComponent,
  CursorInteractionComponent,
  VisualStateComponent,
  MovementComponent,
  PhaserNodeComponent,
  BossBehaviorComponent,
  PlayerInputComponent,
  PlayerRenderComponent,
} from './components';

/**
 * World: 모든 ComponentStore를 보유하고 entity lifecycle을 관리한다.
 * - createEntity/destroyEntity로 엔티티 생성/파괴
 * - markDead/flushDead로 지연 파괴 지원
 * - query()로 여러 store에 동시 존재하는 엔티티 검색
 */
export class World {
  // Entity stores (C1~C11)
  readonly identity = new ComponentStore<IdentityComponent>();
  readonly transform = new ComponentStore<TransformComponent>();
  readonly health = new ComponentStore<HealthComponent>();
  readonly statusCache = new ComponentStore<StatusCacheComponent>();
  readonly lifetime = new ComponentStore<LifetimeComponent>();
  readonly dishProps = new ComponentStore<DishPropsComponent>();
  readonly cursorInteraction = new ComponentStore<CursorInteractionComponent>();
  readonly visualState = new ComponentStore<VisualStateComponent>();
  readonly movement = new ComponentStore<MovementComponent>();
  readonly phaserNode = new ComponentStore<PhaserNodeComponent>();
  readonly bossBehavior = new ComponentStore<BossBehaviorComponent>();

  // Player stores (P1~P2)
  readonly playerInput = new ComponentStore<PlayerInputComponent>();
  readonly playerRender = new ComponentStore<PlayerRenderComponent>();

  // All stores for bulk operations (add new stores here)
  private readonly allStores: ComponentStore<unknown>[] = [
    this.identity, this.transform, this.health, this.statusCache,
    this.lifetime, this.dishProps, this.cursorInteraction, this.visualState,
    this.movement, this.phaserNode, this.bossBehavior,
    this.playerInput, this.playerRender,
  ];

  // Active/Dead entity tracking
  private readonly activeEntities = new Set<string>();
  private readonly deadEntities = new Set<string>();

  createEntity(entityId: string): void {
    this.activeEntities.add(entityId);
    this.deadEntities.delete(entityId);
  }

  destroyEntity(entityId: string): void {
    this.activeEntities.delete(entityId);
    this.deadEntities.delete(entityId);
    this.removeAllComponents(entityId);
  }

  markDead(entityId: string): void {
    this.deadEntities.add(entityId);
  }

  isActive(entityId: string): boolean {
    return this.activeEntities.has(entityId);
  }

  isDead(entityId: string): boolean {
    return this.deadEntities.has(entityId);
  }

  getActiveEntityIds(): string[] {
    return Array.from(this.activeEntities);
  }

  /** 모든 지정 store에 컴포넌트가 존재하는 active 엔티티 ID 반환 */
  query(...stores: ComponentStore<unknown>[]): string[] {
    const result: string[] = [];
    for (const entityId of this.activeEntities) {
      if (stores.every((store) => store.has(entityId))) {
        result.push(entityId);
      }
    }
    return result;
  }

  /** dead 엔티티를 정리하고 제거된 ID 목록을 반환 */
  flushDead(): string[] {
    const flushed = Array.from(this.deadEntities);
    for (const entityId of flushed) {
      this.activeEntities.delete(entityId);
      this.removeAllComponents(entityId);
    }
    this.deadEntities.clear();
    return flushed;
  }

  clear(): void {
    this.activeEntities.clear();
    this.deadEntities.clear();
    this.clearAllStores();
  }

  private removeAllComponents(entityId: string): void {
    this.allStores.forEach(s => s.delete(entityId));
  }

  private clearAllStores(): void {
    this.allStores.forEach(s => s.clear());
  }
}
