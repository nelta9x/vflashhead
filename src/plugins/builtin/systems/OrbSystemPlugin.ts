import { OrbSystem } from './OrbSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { SpatialIndex } from '../../../systems/SpatialIndex';
import { OrbRenderer } from '../abilities/OrbRenderer';
import { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import { AbilityProgressionService } from '../services/abilities/AbilityProgressionService';
import { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class OrbSystemPlugin implements SystemPlugin {
  readonly id = 'core:orb_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new OrbSystem(
        ctx.services.get(AbilityProgressionService),
        ctx.services.get(AbilityRuntimeQueryService),
        ctx.world,
        ctx.services.get(SpatialIndex),
        ctx.services.get(EntityDamageService),
        ctx.services.get(BossCombatCoordinator),
        ctx.services.get(OrbRenderer),
      ),
    ];
  }
}
