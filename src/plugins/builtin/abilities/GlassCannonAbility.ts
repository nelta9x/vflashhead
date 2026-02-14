import type { AbilityPlugin, AbilityContext, AbilityRenderer } from '../../types';
import type { GlassCannonLevelData } from '../../../data/types';

export class GlassCannonAbility implements AbilityPlugin {
  readonly id = 'glass_cannon';
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
    const data = this.ctx.upgradeSystem.getLevelData<GlassCannonLevelData>(this.id);
    if (!data) return 0;

    switch (key) {
      case 'damageMultiplier':
        return data.damageMultiplier;
      case 'hpPenalty':
        return data.hpPenalty;
      default:
        return 0;
    }
  }
}
