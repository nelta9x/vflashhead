import type Phaser from 'phaser';
import type { ServiceRegistry, ServiceEntry } from '../ServiceRegistry';
import type { EntitySystem } from '../../systems/entity-systems/EntitySystem';
import type { World } from '../../world';

/** ServicePlugin: declarative service list. Actual creation is handled by ServiceRegistry.resolveEntries(). */
export interface ServicePlugin {
  readonly id: string;
  readonly services: ServiceEntry[];
}

/** Context provided to SystemPlugin.createSystems(). */
export interface SystemPluginContext {
  scene: Phaser.Scene;
  world: World;
  services: ServiceRegistry;
}

/**
 * SystemPlugin: EntitySystem creation as a plugin.
 * createSystems() returns an EntitySystem array to register in the pipeline.
 */
export interface SystemPlugin {
  readonly id: string;
  createSystems(ctx: SystemPluginContext): EntitySystem[];
  destroy?(): void;
}
