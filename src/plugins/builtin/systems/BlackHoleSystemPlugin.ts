import { BlackHoleSystem } from './BlackHoleSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { SpatialIndex } from '../../../systems/SpatialIndex';
import { BlackHoleRenderer } from '../abilities/BlackHoleRenderer';
import { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import { AbilityProgressionService } from '../services/abilities/AbilityProgressionService';
import { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class BlackHoleSystemPlugin implements SystemPlugin {
  readonly id = 'core:black_hole_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    const system = new BlackHoleSystem(
      ctx.services.get(AbilityProgressionService),
      ctx.services.get(AbilityRuntimeQueryService),
      ctx.world,
      ctx.services.get(SpatialIndex),
      ctx.services.get(EntityDamageService),
      ctx.services.get(BossCombatCoordinator),
      ctx.services.get(BlackHoleRenderer),
    );
    ctx.services.set(BlackHoleSystem, system);
    return [system];
  }
}
