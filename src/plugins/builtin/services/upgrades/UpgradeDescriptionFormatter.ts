import { Data } from '../../../../data/DataManager';
import type { SystemUpgradeData, SystemUpgradeLevelData } from '../../../../data/types/upgrades';

export class UpgradeDescriptionFormatter {
  private readonly getAbilityLevel: (abilityId: string) => number;
  private readonly getSystemUpgrade: (abilityId: string) => SystemUpgradeData | undefined;

  constructor(
    getAbilityLevel: (abilityId: string) => number,
    getSystemUpgrade: (abilityId: string) => SystemUpgradeData | undefined
  ) {
    this.getAbilityLevel = getAbilityLevel;
    this.getSystemUpgrade = getSystemUpgrade;
  }

  public getFormattedDescription(abilityId: string): string {
    const upgradeData = this.getSystemUpgrade(abilityId);
    if (!upgradeData) {
      return Data.t(`upgrade.${abilityId}.desc`);
    }

    const stack = this.getAbilityLevel(abilityId);
    if (stack <= 0) {
      if (abilityId === 'health_pack') {
        return Data.formatTemplate(`upgrade.${abilityId}.desc`, this.getHealthPackBaseParams());
      }
      return Data.t(`upgrade.${abilityId}.desc`);
    }

    if (!upgradeData.descriptionTemplate) {
      return Data.t(`upgrade.${abilityId}.desc`);
    }

    if (!upgradeData.levels) {
      return Data.t(`upgrade.${abilityId}.desc`);
    }

    const index = Math.min(stack, upgradeData.levels.length) - 1;
    const levelData = upgradeData.levels[index];
    const params = this.extractTemplateParams(levelData);
    this.appendSharedTemplateParams(abilityId, params);

    return Data.formatTemplate(`upgrade.${abilityId}.desc_template`, params);
  }

  private normalizeTemplateNumericValue(key: string, value: number): number {
    if (
      key === 'chance' ||
      key === 'sizeBonus' ||
      key === 'missileThicknessBonus' ||
      key === 'dropChanceBonus' ||
      key === 'criticalChance' ||
      key === 'consumeRadiusGrowthRatio'
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
    abilityId: string,
    params: Record<string, number | string>
  ): void {
    if (abilityId !== 'health_pack') {
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
