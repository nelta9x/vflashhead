import { MagnetSystem } from './MagnetSystem';
import { EntityDamageService } from '../services/EntityDamageService';
import { UpgradeSystem } from '../services/UpgradeSystem';
import { ParticleManager } from '../../../effects/ParticleManager';
import { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class MagnetSystemPlugin implements SystemPlugin {
  readonly id = 'core:magnet_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new MagnetSystem({
        world: ctx.world,
        damageService: ctx.services.get(EntityDamageService),
        upgradeSystem: ctx.services.get(UpgradeSystem),
        particleManager: ctx.services.get(ParticleManager),
        gameEnv: ctx.services.get(GameEnvironment),
      }),
    ];
  }
}
