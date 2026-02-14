import { BlackHoleSystem } from './BlackHoleSystem';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { EntityDamageService } from '../../../systems/EntityDamageService';
import { BlackHoleRenderer } from '../abilities/BlackHoleRenderer';
import { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class BlackHoleSystemPlugin implements SystemPlugin {
  readonly id = 'core:black_hole_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new BlackHoleSystem(
        ctx.services.get(UpgradeSystem),
        ctx.world,
        ctx.services.get(EntityDamageService),
        ctx.services.get(BossCombatCoordinator),
        ctx.services.get(BlackHoleRenderer),
      ),
    ];
  }
}
