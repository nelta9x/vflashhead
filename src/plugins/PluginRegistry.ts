import type { AbilityPlugin, EntityTypePlugin, SystemPlugin } from './types';

export class PluginRegistry {
  private static instance: PluginRegistry;

  private readonly abilities = new Map<string, AbilityPlugin>();
  private readonly entityTypes = new Map<string, EntityTypePlugin>();
  private readonly systemPlugins = new Map<string, SystemPlugin>();

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

  registerSystemPlugin(plugin: SystemPlugin): void {
    this.systemPlugins.set(plugin.id, plugin);
  }

  getSystemPlugin(id: string): SystemPlugin | undefined {
    return this.systemPlugins.get(id);
  }

  getAllSystemPlugins(): ReadonlyMap<string, SystemPlugin> {
    return this.systemPlugins;
  }

  unregisterSystemPlugin(id: string): boolean {
    return this.systemPlugins.delete(id);
  }
}
