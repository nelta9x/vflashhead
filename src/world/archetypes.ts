import type { ComponentDef } from './ComponentDef';
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

/** 아키타입 = ComponentDef 토큰 배열. 런타임 확장 가능. */
export interface ArchetypeDefinition {
  readonly id: string;
  readonly components: readonly ComponentDef[];
}

export class ArchetypeRegistry {
  private readonly archetypes = new Map<string, ArchetypeDefinition>();

  register(def: ArchetypeDefinition): void {
    if (this.archetypes.has(def.id)) {
      throw new Error(`ArchetypeRegistry: archetype "${def.id}" already registered`);
    }
    this.archetypes.set(def.id, def);
  }

  get(id: string): ArchetypeDefinition | undefined {
    return this.archetypes.get(id);
  }

  getRequired(id: string): ArchetypeDefinition {
    const arch = this.archetypes.get(id);
    if (!arch) {
      throw new Error(`ArchetypeRegistry: archetype "${id}" not found`);
    }
    return arch;
  }

  unregister(id: string): boolean {
    return this.archetypes.delete(id);
  }

  has(id: string): boolean {
    return this.archetypes.has(id);
  }

  getAll(): ReadonlyMap<string, ArchetypeDefinition> {
    return this.archetypes;
  }

  getIds(): string[] {
    return Array.from(this.archetypes.keys());
  }

  clear(): void {
    this.archetypes.clear();
  }
}

// === 빌트인 아키타입 ===

export const BUILTIN_ARCHETYPES: readonly ArchetypeDefinition[] = [
  {
    id: 'player',
    components: [C_Identity, C_Transform, C_Health, C_StatusCache, C_PlayerInput, C_PlayerRender],
  },
  {
    id: 'dish',
    components: [
      C_DishTag,
      C_Identity, C_Transform, C_Health, C_StatusCache,
      C_Lifetime, C_DishProps, C_CursorInteraction, C_VisualState, C_Movement, C_PhaserNode,
    ],
  },
  {
    id: 'boss',
    components: [
      C_BossTag,
      C_Identity, C_Transform, C_Health, C_StatusCache,
      C_Lifetime, C_DishProps, C_CursorInteraction, C_VisualState, C_Movement, C_PhaserNode, C_BossState,
    ],
  },
  {
    id: 'fallingBomb',
    components: [C_FallingBomb, C_Transform, C_PhaserNode],
  },
  {
    id: 'healthPack',
    components: [C_HealthPack, C_Transform, C_PhaserNode],
  },
];

export function registerBuiltinArchetypes(registry: ArchetypeRegistry): void {
  for (const arch of BUILTIN_ARCHETYPES) {
    registry.register(arch);
  }
}
