import type { AbilityPlugin, EntityTypePlugin } from './types';

export class PluginRegistry {
  private static instance: PluginRegistry;

  private readonly abilities = new Map<string, AbilityPlugin>();
  private readonly entityTypes = new Map<string, EntityTypePlugin>();

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  static resetInstance(): void {
    PluginRegistry.instance = new PluginRegistry();
  }

  registerAbility(plugin: AbilityPlugin): void {
    this.abilities.set(plugin.id, plugin);
  }

  registerEntityType(plugin: EntityTypePlugin): void {
    this.entityTypes.set(plugin.typeId, plugin);
  }

  getAbility(id: string): AbilityPlugin | undefined {
    return this.abilities.get(id);
  }

  getEntityType(id: string): EntityTypePlugin | undefined {
    return this.entityTypes.get(id);
  }

  getAllAbilities(): ReadonlyMap<string, AbilityPlugin> {
    return this.abilities;
  }

  getAllEntityTypes(): ReadonlyMap<string, EntityTypePlugin> {
    return this.entityTypes;
  }

  unregisterAbility(id: string): boolean {
    return this.abilities.delete(id);
  }

  unregisterEntityType(typeId: string): boolean {
    return this.entityTypes.delete(typeId);
  }
}
