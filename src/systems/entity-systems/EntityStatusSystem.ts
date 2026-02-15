import type { EntitySystem } from './EntitySystem';
import type { World } from '../../world';
import type { StatusEffectManager } from '../StatusEffectManager';

export class EntityStatusSystem implements EntitySystem {
  readonly id = 'core:entity_status';
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly sem: StatusEffectManager,
  ) {}

  tick(_delta: number): void {
    this.world.statusCache.forEach((entityId, statusCache) => {
      if (!this.world.isActive(entityId)) return;

      statusCache.isFrozen = this.sem.hasEffect(entityId, 'freeze') || this.sem.hasEffect(entityId, 'slow');
      statusCache.slowFactor = this.sem.getMinEffectData(entityId, 'slow', 'factor', 1.0);
    });
  }
}
