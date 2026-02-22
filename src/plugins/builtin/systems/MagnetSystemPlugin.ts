import { MagnetSystem } from './MagnetSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { SpatialIndex } from '../../../systems/SpatialIndex';
import { ParticleManager } from '../../../effects/ParticleManager';
import { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import { AbilityProgressionService } from '../services/abilities/AbilityProgressionService';
import { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class MagnetSystemPlugin implements SystemPlugin {
  readonly id = 'core:magnet_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new MagnetSystem({
        world: ctx.world,
        spatialIndex: ctx.services.get(SpatialIndex),
        damageService: ctx.services.get(EntityDamageService),
        abilityProgression: ctx.services.get(AbilityProgressionService),
        abilityRuntimeQuery: ctx.services.get(AbilityRuntimeQueryService),
        particleManager: ctx.services.get(ParticleManager),
        gameEnv: ctx.services.get(GameEnvironment),
      }),
    ];
  }
}
