import { HealthPackSystem } from './HealthPackSystem';
import { UpgradeSystem } from '../services/UpgradeSystem';
import { EntityPoolManager } from '../../../systems/EntityPoolManager';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class HealthPackSystemPlugin implements SystemPlugin {
  readonly id = 'core:health_pack';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [new HealthPackSystem(ctx.scene, ctx.services.get(UpgradeSystem), ctx.world, ctx.services.get(EntityPoolManager))];
  }
}
