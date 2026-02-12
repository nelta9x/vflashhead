import { CursorAttackSystem } from '../../../systems/entity-systems';
import { EntityDamageService } from '../../../systems/EntityDamageService';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { GetCursorToken } from '../../ServiceTokens';
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
        getCursor: ctx.services.get(GetCursorToken),
      }),
    ];
  }
}
