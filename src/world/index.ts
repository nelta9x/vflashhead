export type { EntityId } from './EntityId';
export { INVALID_ENTITY_ID } from './EntityId';
export { ComponentStore } from './ComponentStore';
export type { ComponentDef } from './ComponentDef';
export { defineComponent } from './ComponentDef';
export { World } from './World';
export type { GameContext } from './GameContext';
export { createDefaultGameContext } from './GameContext';
export { ArchetypeRegistry, registerBuiltinArchetypes, BUILTIN_ARCHETYPES } from './archetypes';
export type { ArchetypeDefinition } from './archetypes';
export {
  C_DishTag,
  C_BossTag,
  C_FallingBomb,
  C_HealthPack,
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
} from './components';
export type {
  DishTag,
  BossTag,
  FallingBombComponent,
  HealthPackComponent,
  DriftData,
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
