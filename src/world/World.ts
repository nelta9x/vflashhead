import { ComponentStore } from './ComponentStore';
import type { ComponentDef } from './ComponentDef';
import { ArchetypeRegistry, registerBuiltinArchetypes } from './archetypes';
import type { ArchetypeDefinition } from './archetypes'; // used in spawnFromArchetype
import {
  C_Identity,
  C_Transform,
  C_Health,
  C_StatusCache,
  C_Lifetime,
  C_DishProps,
  C_CursorInteraction,
  C_VisualState,
  C_Movement,
  C_PhaserNode,
  C_BossState,
  C_PlayerInput,
  C_PlayerRender,
  C_DishTag,
  C_BossTag,
  C_FallingBomb,
  C_HealthPack,
} from './components';
import type {
  DishTag,
  BossTag,
  FallingBombComponent,
  HealthPackComponent,
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
  BossStateComponent,
  PlayerInputComponent,
  PlayerRenderComponent,
} from './components';

/**
 * World: 동적 스토어 레지스트리 + entity lifecycle 관리.
 * - register(def)로 ComponentDef 토큰 기반 스토어 등록
 * - 빌트인 17개 스토어는 typed property로 직접 접근
 */
export class World {
  // 동적 스토어 레지스트리 (name → store)
  private readonly stores = new Map<string, ComponentStore<unknown>>();

  // 빌트인 스토어 — typed property로 직접 접근 (기존 코드 호환)
  readonly identity: ComponentStore<IdentityComponent>;
  readonly transform: ComponentStore<TransformComponent>;
  readonly health: ComponentStore<HealthComponent>;
  readonly statusCache: ComponentStore<StatusCacheComponent>;
  readonly lifetime: ComponentStore<LifetimeComponent>;
  readonly dishProps: ComponentStore<DishPropsComponent>;
  readonly cursorInteraction: ComponentStore<CursorInteractionComponent>;
  readonly visualState: ComponentStore<VisualStateComponent>;
  readonly movement: ComponentStore<MovementComponent>;
  readonly phaserNode: ComponentStore<PhaserNodeComponent>;
  readonly bossState: ComponentStore<BossStateComponent>;
  readonly dishTag: ComponentStore<DishTag>;
  readonly bossTag: ComponentStore<BossTag>;
  readonly playerInput: ComponentStore<PlayerInputComponent>;
  readonly playerRender: ComponentStore<PlayerRenderComponent>;
  readonly fallingBomb: ComponentStore<FallingBombComponent>;
  readonly healthPack: ComponentStore<HealthPackComponent>;

  // 아키타입 레지스트리
  readonly archetypeRegistry = new ArchetypeRegistry();

  // Active entity tracking
  private readonly activeEntities = new Set<string>();

  constructor() {
    // 빌트인 컴포넌트를 Def 토큰으로 등록
    this.identity = this.register(C_Identity);
    this.transform = this.register(C_Transform);
    this.health = this.register(C_Health);
    this.statusCache = this.register(C_StatusCache);
    this.lifetime = this.register(C_Lifetime);
    this.dishProps = this.register(C_DishProps);
    this.cursorInteraction = this.register(C_CursorInteraction);
    this.visualState = this.register(C_VisualState);
    this.movement = this.register(C_Movement);
    this.phaserNode = this.register(C_PhaserNode);
    this.bossState = this.register(C_BossState);
    this.dishTag = this.register(C_DishTag);
    this.bossTag = this.register(C_BossTag);
    this.playerInput = this.register(C_PlayerInput);
    this.playerRender = this.register(C_PlayerRender);
    this.fallingBomb = this.register(C_FallingBomb);
    this.healthPack = this.register(C_HealthPack);

    // 빌트인 아키타입 등록
    registerBuiltinArchetypes(this.archetypeRegistry);
  }

  /** ComponentDef 토큰으로 새 스토어 등록. 중복 시 에러. */
  register<T>(def: ComponentDef<T>): ComponentStore<T> {
    if (this.stores.has(def.name)) {
      throw new Error(`World: store "${def.name}" already registered`);
    }
    const store = new ComponentStore<T>();
    this.stores.set(def.name, store as ComponentStore<unknown>);
    return store;
  }

  /** 이름(string)으로 스토어 조회 — 아키타입 스폰용 (내부) */
  getStoreByName(name: string): ComponentStore<unknown> | undefined {
    return this.stores.get(name);
  }

  /** MOD 언로드 시 커스텀 스토어 제거 */
  unregisterStore(name: string): boolean {
    return this.stores.delete(name);
  }

  getStoreNames(): string[] {
    return Array.from(this.stores.keys());
  }

  /** 아키타입 기반 엔티티 스폰. values 키 = ComponentDef.name */
  spawnFromArchetype(
    archetype: ArchetypeDefinition,
    entityId: string,
    values: Record<string, unknown>,
  ): void {
    this.createEntity(entityId);
    for (const def of archetype.components) {
      const store = this.getStoreByName(def.name);
      if (!store) throw new Error(`spawnFromArchetype: store "${def.name}" not registered`);
      const value = values[def.name];
      if (value === undefined) throw new Error(`spawnFromArchetype: missing value for "${def.name}"`);
      store.set(entityId, value);
    }
  }

  createEntity(entityId: string): void {
    this.activeEntities.add(entityId);
  }

  destroyEntity(entityId: string): void {
    this.activeEntities.delete(entityId);
    this.removeAllComponents(entityId);
  }

  isActive(entityId: string): boolean {
    return this.activeEntities.has(entityId);
  }

  /** 지정 ComponentDef 토큰에 해당하는 active 엔티티의 [id, ...components] 튜플을 yield */
  query<A>(c1: ComponentDef<A>): IterableIterator<[string, A]>;
  query<A, B>(c1: ComponentDef<A>, c2: ComponentDef<B>): IterableIterator<[string, A, B]>;
  query<A, B, C>(c1: ComponentDef<A>, c2: ComponentDef<B>, c3: ComponentDef<C>): IterableIterator<[string, A, B, C]>;
  query<A, B, C, D>(c1: ComponentDef<A>, c2: ComponentDef<B>, c3: ComponentDef<C>, c4: ComponentDef<D>): IterableIterator<[string, A, B, C, D]>;
  query<A, B, C, D, E>(c1: ComponentDef<A>, c2: ComponentDef<B>, c3: ComponentDef<C>, c4: ComponentDef<D>, c5: ComponentDef<E>): IterableIterator<[string, A, B, C, D, E]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(...defs: ComponentDef<any>[]): IterableIterator<[string, ...unknown[]]> {
    return this.queryImpl(defs);
  }

  private *queryImpl(defs: ComponentDef[]): Generator<[string, ...unknown[]]> {
    if (defs.length === 0) return;

    // Resolve stores
    const stores: ComponentStore<unknown>[] = [];
    for (const def of defs) {
      const s = this.stores.get(def.name);
      if (!s) return; // store not registered → no results
      stores.push(s);
    }

    // Pivot on smallest store for efficiency
    let pivotIdx = 0;
    let pivotSize = stores[0].size();
    for (let i = 1; i < stores.length; i++) {
      const sz = stores[i].size();
      if (sz < pivotSize) {
        pivotSize = sz;
        pivotIdx = i;
      }
    }

    const pivot = stores[pivotIdx];
    for (const [entityId] of pivot.entries()) {
      if (!this.activeEntities.has(entityId)) continue;

      // Cross-validate all other stores
      let valid = true;
      for (let i = 0; i < stores.length; i++) {
        if (i === pivotIdx) continue;
        if (!stores[i].has(entityId)) { valid = false; break; }
      }
      if (!valid) continue;

      // Build tuple: [entityId, c1Data, c2Data, ...]
      const tuple: [string, ...unknown[]] = [entityId];
      for (const store of stores) {
        tuple.push(store.get(entityId)!);
      }
      yield tuple;
    }
  }

  clear(): void {
    this.activeEntities.clear();
    this.clearAllStores();
  }

  private removeAllComponents(entityId: string): void {
    this.stores.forEach(s => s.delete(entityId));
  }

  private clearAllStores(): void {
    this.stores.forEach(s => s.clear());
  }
}
