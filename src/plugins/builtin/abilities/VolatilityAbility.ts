import type { AbilityPlugin, AbilityContext, AbilityRenderer } from '../../types';
import type { VolatilityLevelData } from '../../../data/types';

export class VolatilityAbility implements AbilityPlugin {
  readonly id = 'volatility';
  private ctx!: AbilityContext;

  init(ctx: AbilityContext): void {
    this.ctx = ctx;
  }

  update(): void {}
  clear(): void {}
  destroy(): void {}

  createRenderer(): AbilityRenderer | null {
    return null;
  }

  getEffectValue(key: string): number {
    const data = this.ctx.upgradeSystem.getLevelData<VolatilityLevelData>(this.id);
    if (!data) return 0;

    switch (key) {
      case 'critMultiplier':
        return data.critMultiplier;
      case 'nonCritPenalty':
        return data.nonCritPenalty;
      default:
        return 0;
    }
  }
}
