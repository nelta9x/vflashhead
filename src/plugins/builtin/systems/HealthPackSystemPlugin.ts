import { HealthPackSystem } from '../../../systems/HealthPackSystem';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class HealthPackSystemPlugin implements SystemPlugin {
  readonly id = 'core:health_pack';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [new HealthPackSystem(ctx.scene, ctx.upgradeSystem, ctx.world, ctx.entityPoolManager)];
  }
}
