import { SpaceshipProjectileSystem } from './SpaceshipProjectileSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { FeedbackSystem } from '../services/FeedbackSystem';
import { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import { EntityDamageService } from '../services/EntityDamageService';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class SpaceshipProjectileSystemPlugin implements SystemPlugin {
  readonly id = 'core:spaceship_projectile';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new SpaceshipProjectileSystem(
        ctx.scene,
        ctx.world,
        ctx.services.get(HealthSystem),
        ctx.services.get(FeedbackSystem),
        ctx.services.get(AbilityRuntimeQueryService),
        ctx.services.get(EntityDamageService),
      ),
    ];
  }
}
