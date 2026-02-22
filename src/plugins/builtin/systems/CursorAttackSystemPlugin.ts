import { CursorAttackSystem } from './CursorAttackSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { SpatialIndex } from '../../../systems/SpatialIndex';
import { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class CursorAttackSystemPlugin implements SystemPlugin {
  readonly id = 'core:cursor_attack_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new CursorAttackSystem({
        world: ctx.world,
        spatialIndex: ctx.services.get(SpatialIndex),
        damageService: ctx.services.get(EntityDamageService),
        abilityRuntimeQuery: ctx.services.get(AbilityRuntimeQueryService),
        gameEnv: ctx.services.get(GameEnvironment),
      }),
    ];
  }
}
