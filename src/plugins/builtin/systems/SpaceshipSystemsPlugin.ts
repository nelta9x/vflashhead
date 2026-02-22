import { SpaceshipAISystem } from './SpaceshipAISystem';
import { SpaceshipProjectileSystem } from './SpaceshipProjectileSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { FeedbackSystem } from '../services/FeedbackSystem';
import { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import { EntityDamageService } from '../services/EntityDamageService';
import { SoundSystem } from '../services/SoundSystem';
import { PlayerAttackRenderer } from '../abilities/PlayerAttackRenderer';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class SpaceshipSystemsPlugin implements SystemPlugin {
  readonly id = 'core:spaceship_systems';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new SpaceshipAISystem(
        ctx.world,
        ctx.services.get(EntityDamageService),
      ),
      new SpaceshipProjectileSystem(
        ctx.scene,
        ctx.world,
        ctx.services.get(HealthSystem),
        ctx.services.get(FeedbackSystem),
        ctx.services.get(AbilityRuntimeQueryService),
        ctx.services.get(SoundSystem),
        ctx.services.get(PlayerAttackRenderer),
      ),
    ];
  }
}
