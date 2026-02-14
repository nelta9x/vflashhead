import { PluginRegistry } from '../../PluginRegistry';
import type { World } from '../../../world';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';

/**
 * Data-driven initial entity spawn system.
 * Spawns entities listed in game-config.json `initialEntities` during start().
 * tick() is a no-op — this system is spawn-only.
 */
export class InitialEntitySpawnSystem implements EntitySystem {
  readonly id = 'core:initial_spawn';
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly entityTypeIds: readonly string[],
  ) {}

  start(): void {
    const registry = PluginRegistry.getInstance();
    for (const typeId of this.entityTypeIds) {
      const plugin = registry.getEntityType(typeId);
      if (!plugin) throw new Error(`entity type "${typeId}" not registered`);
      if (!plugin.spawn) throw new Error(`entity type "${typeId}" has no spawn()`);
      plugin.spawn(this.world);
    }
  }

  tick(_delta: number): void { /* spawn-only system — no per-frame work */ }
}
