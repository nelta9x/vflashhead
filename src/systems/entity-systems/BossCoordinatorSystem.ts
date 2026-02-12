import type { BossCombatCoordinator } from '../../scenes/game/BossCombatCoordinator';
import type { World } from '../../world';
import type { EntitySystem } from './EntitySystem';

export class BossCoordinatorSystem implements EntitySystem {
  readonly id = 'core:boss_coordinator';
  enabled = true;

  private readonly coordinator: BossCombatCoordinator;
  private readonly world: World;

  constructor(coordinator: BossCombatCoordinator, world: World) {
    this.coordinator = coordinator;
    this.world = world;
  }

  tick(delta: number): void {
    const t = this.world.transform.get(this.world.context.playerId);
    if (!t) return;
    this.coordinator.update(delta, this.world.context.gameTime, { x: t.x, y: t.y });
  }
}
