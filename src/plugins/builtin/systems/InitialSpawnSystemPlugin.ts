import { Data } from '../../../data/DataManager';
import { InitialEntitySpawnSystem } from './InitialEntitySpawnSystem';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class InitialSpawnSystemPlugin implements SystemPlugin {
  readonly id = 'core:initial_spawn';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [new InitialEntitySpawnSystem(ctx.world, Data.gameConfig.initialEntities)];
  }
}
