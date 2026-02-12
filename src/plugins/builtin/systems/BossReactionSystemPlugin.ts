import { BossReactionSystem } from '../../../systems/entity-systems';
import { FeedbackSystem } from '../../../systems/FeedbackSystem';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { SystemPlugin, SystemPluginContext } from '../../types/SystemPlugin';

export class BossReactionSystemPlugin implements SystemPlugin {
  readonly id = 'core:boss_reaction_system';

  createSystems(ctx: SystemPluginContext): EntitySystem[] {
    return [
      new BossReactionSystem({
        world: ctx.world,
        scene: ctx.scene,
        feedbackSystem: ctx.services.get(FeedbackSystem),
      }),
    ];
  }
}
