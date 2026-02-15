import { CursorAttackSystem } from './CursorAttackSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { UpgradeSystem } from '../services/UpgradeSystem';
import { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class CursorAttackSystemPlugin implements SystemPlugin {
  readonly id = 'core:cursor_attack_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new CursorAttackSystem({
        world: ctx.world,
        damageService: ctx.services.get(EntityDamageService),
        upgradeSystem: ctx.services.get(UpgradeSystem),
        gameEnv: ctx.services.get(GameEnvironment),
      }),
    ];
  }
}
