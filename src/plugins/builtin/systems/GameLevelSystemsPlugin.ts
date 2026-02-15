import { ComboSystem } from '../services/ComboSystem';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import { ComboTickSystem } from './ComboTickSystem';
import { StatusEffectTickSystem } from '../../../systems/entity-systems/StatusEffectTickSystem';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class GameLevelSystemsPlugin implements SystemPlugin {
  readonly id = 'core:game_level_systems';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new ComboTickSystem(ctx.services.get(ComboSystem), ctx.world),
      new StatusEffectTickSystem(ctx.services.get(StatusEffectManager)),
    ];
  }
}
