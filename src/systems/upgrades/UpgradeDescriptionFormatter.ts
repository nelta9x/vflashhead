import { Data } from '../../data/DataManager';
import type { SystemUpgradeLevelData } from '../../data/types/upgrades';

export class UpgradeDescriptionFormatter {
  private readonly getUpgradeStack: (upgradeId: string) => number;

  constructor(getUpgradeStack: (upgradeId: string) => number) {
    this.getUpgradeStack = getUpgradeStack;
  }

  public getFormattedDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    if (!upgradeData) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    const stack = this.getUpgradeStack(upgradeId);
    if (stack <= 0) {
      if (upgradeId === 'health_pack') {
        return Data.formatTemplate(`upgrade.${upgradeId}.desc`, this.getHealthPackBaseParams());
      }
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    if (!upgradeData.descriptionTemplate) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    if (!upgradeData.levels) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    const index = Math.min(stack, upgradeData.levels.length) - 1;
    const levelData = upgradeData.levels[index];
    const params = this.extractTemplateParams(levelData);
    this.appendSharedTemplateParams(upgradeId, params);

    return Data.formatTemplate(`upgrade.${upgradeId}.desc_template`, params);
  }

  private normalizeTemplateNumericValue(key: string, value: number): number {
    if (
      key === 'chance' ||
      key === 'sizeBonus' ||
      key === 'missileThicknessBonus' ||
      key === 'dropChanceBonus' ||
      key === 'criticalChance'
    ) {
      return Math.round(value * 100);
    }
    return value;
  }

  private extractTemplateParams(levelData: SystemUpgradeLevelData): Record<string, number | string> {
    const params: Record<string, number | string> = {};
    const entries = Object.entries(levelData as unknown as Record<string, unknown>);
    for (const [key, value] of entries) {
      if (typeof value === 'number') {
        params[key] = this.normalizeTemplateNumericValue(key, value);
      } else if (typeof value === 'string') {
        params[key] = value;
      }
    }
    return params;
  }

  private appendSharedTemplateParams(
    upgradeId: string,
    params: Record<string, number | string>
  ): void {
    if (upgradeId !== 'health_pack') {
      return;
    }

    Object.assign(params, this.getHealthPackBaseParams());
  }

  private toSecondsLabel(milliseconds: number): number {
    return Number((milliseconds / 1000).toFixed(1).replace(/\.0$/, ''));
  }

  private getHealthPackBaseParams(): Record<string, number> {
    return {
      baseSpawnChance: Math.round(Data.healthPack.baseSpawnChance * 100),
      baseSpawnIntervalSec: this.toSecondsLabel(Data.healthPack.checkInterval),
    };
  }

}
