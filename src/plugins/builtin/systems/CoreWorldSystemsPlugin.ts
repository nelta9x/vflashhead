import {
  EntityStatusSystem,
  EntityTimingSystem,
  EntityMovementSystem,
  EntityVisualSystem,
} from '../../../systems/entity-systems';
import { EntityRenderSystem } from './EntityRenderSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class CoreWorldSystemsPlugin implements SystemPlugin {
  readonly id = 'core:world_systems';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    const sem = ctx.services.get(StatusEffectManager);
    const dmg = ctx.services.get(EntityDamageService);
    return [
      new EntityStatusSystem(ctx.world, sem),
      new EntityTimingSystem(ctx.world, dmg),
      new EntityMovementSystem(ctx.world),
      new EntityVisualSystem(ctx.world),
      new EntityRenderSystem(ctx.world),
    ];
  }
}
