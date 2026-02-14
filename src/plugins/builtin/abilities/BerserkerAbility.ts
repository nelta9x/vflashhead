import type { AbilityPlugin, AbilityContext, AbilityRenderer } from '../../types';
import type { BerserkerLevelData } from '../../../data/types';

export class BerserkerAbility implements AbilityPlugin {
  readonly id = 'berserker';
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
    const data = this.ctx.upgradeSystem.getLevelData<BerserkerLevelData>(this.id);
    if (!data) return 0;

    switch (key) {
      case 'missingHpDamagePercent':
        return data.missingHpDamagePercent;
      default:
        return 0;
    }
  }
}
