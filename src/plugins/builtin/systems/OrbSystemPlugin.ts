import { OrbSystem } from './OrbSystem';
import { UpgradeSystem } from '../services/UpgradeSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { OrbRenderer } from '../abilities/OrbRenderer';
import { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class OrbSystemPlugin implements SystemPlugin {
  readonly id = 'core:orb_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new OrbSystem(
        ctx.services.get(UpgradeSystem),
        ctx.world,
        ctx.services.get(EntityDamageService),
        ctx.services.get(BossCombatCoordinator),
        ctx.services.get(OrbRenderer),
      ),
    ];
  }
}
