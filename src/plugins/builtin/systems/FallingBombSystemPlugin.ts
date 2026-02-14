import { FallingBombSystem } from './FallingBombSystem';
import { EntityPoolManager } from '../../../systems/EntityPoolManager';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class FallingBombSystemPlugin implements SystemPlugin {
  readonly id = 'core:falling_bomb';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [new FallingBombSystem(ctx.scene, ctx.world, ctx.services.get(EntityPoolManager), ctx.services.get(UpgradeSystem))];
  }
}
