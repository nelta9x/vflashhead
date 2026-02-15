import type { EntitySystem } from './EntitySystem';
import type { World } from '../../world';
import type { EntityDamageService } from '../../plugins/builtin/services/EntityDamageService';

export class EntityTimingSystem implements EntitySystem {
  readonly id = 'core:entity_timing';
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly damageService: EntityDamageService,
  ) {}

  tick(delta: number): void {
    this.world.lifetime.forEach((entityId, lifetime) => {
      if (this.world.playerInput.has(entityId)) return;
      if (!this.world.isActive(entityId)) return;

      const statusCache = this.world.statusCache.get(entityId);
      const slowFactor = statusCache?.slowFactor ?? 1.0;
      const globalSlowFactor = 1 - lifetime.globalSlowPercent;
      const effectiveDelta = delta * slowFactor * globalSlowFactor;

      lifetime.elapsedTime += effectiveDelta;
      lifetime.movementTime += delta;

      if (lifetime.lifetime !== null && lifetime.elapsedTime >= lifetime.lifetime) {
        this.damageService.handleTimeout(entityId);
      }
    });
  }
}
