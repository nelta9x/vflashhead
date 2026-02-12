import { PlayerTickSystem } from '../../../systems/entity-systems';
import { CursorRenderer } from '../../../effects/CursorRenderer';
import { CursorTrail } from '../../../effects/CursorTrail';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class PlayerSystemPlugin implements SystemPlugin {
  readonly id = 'core:player_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new PlayerTickSystem(
        ctx.world,
        ctx.services.get(CursorRenderer),
        ctx.services.get(CursorTrail),
        ctx.services.get(UpgradeSystem),
        ctx.services.get(HealthSystem),
      ),
    ];
  }
}
