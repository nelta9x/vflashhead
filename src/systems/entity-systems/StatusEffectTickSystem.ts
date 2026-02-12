import type { StatusEffectManager } from '../StatusEffectManager';
import type { EntitySystem } from './EntitySystem';

export class StatusEffectTickSystem implements EntitySystem {
  readonly id = 'core:status_effect_tick';
  enabled = true;

  private readonly statusEffectManager: StatusEffectManager;

  constructor(statusEffectManager: StatusEffectManager) {
    this.statusEffectManager = statusEffectManager;
  }

  tick(delta: number): void {
    this.statusEffectManager.tick(delta);
  }
}
