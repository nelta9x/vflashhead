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

    return Data.formatTemplate(`upgrade.${upgradeId}.desc_template`, params);
  }

  public getPreviewDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);

    if (!upgradeData) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    if (!upgradeData.levels) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    const currentStack = this.getUpgradeStack(upgradeId);
    const nextStack = currentStack + 1;

    if (nextStack > upgradeData.levels.length) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    const nextData = upgradeData.levels[nextStack - 1];

    if (currentStack === 0) {
      return this.formatLevelPreview(upgradeData.effectType, null, nextData);
    }

    const currentData = upgradeData.levels[currentStack - 1];
    return this.formatLevelPreview(upgradeData.effectType, currentData, nextData);
  }

  private formatLevelPreview(
    effectType: string,
    current: SystemUpgradeLevelData | null,
    next: SystemUpgradeLevelData
  ): string {
    const params: Record<string, number | string> = {};

    const process = (prefix: string, data: SystemUpgradeLevelData) => {
      const entries = Object.entries(data as unknown as Record<string, unknown>);
      for (const [key, value] of entries) {
        if (typeof value === 'number') {
          const val = this.normalizeTemplateNumericValue(key, value);
          params[`${prefix}${key}`] = val;

          if (key === 'sizeBonus') params[`${prefix}Size`] = val;
          if (key === 'damage') params[`${prefix}Dmg`] = val;
          if (key === 'radius') params[`${prefix}Radius`] = val;
          if (key === 'chance') params[`${prefix}Chance`] = val;
          if (key === 'range') params[`${prefix}Range`] = val;
          if (key === 'force') params[`${prefix}Force`] = val;
          if (key === 'count') params[`${prefix}Count`] = val;
          if (key === 'speed') params[`${prefix}Speed`] = val;
          if (key === 'hpBonus') params[`${prefix}Hp`] = val;
          if (key === 'dropChanceBonus') params[`${prefix}Drop`] = val;
          if (key === 'size') params[`${prefix}OrbSize`] = val;
          if (key === 'criticalChance') params[`${prefix}CriticalChance`] = val;
          if (key === 'missileThicknessBonus') params[`${prefix}MissileThickness`] = val;
          if (key === 'damageInterval') params[`${prefix}DamageInterval`] = val;
          if (key === 'spawnInterval') params[`${prefix}SpawnInterval`] = val;
          if (key === 'spawnCount') params[`${prefix}SpawnCount`] = val;
        } else {
          params[`${prefix}${key}`] = String(value);
        }
      }
    };

    if (current) process('cur', current);
    process(current ? 'next' : '', next);

    if (!current) {
      const entries = Object.entries(next as unknown as Record<string, unknown>);
      for (const [key, value] of entries) {
        if (typeof value === 'number') {
          params[key] = this.normalizeTemplateNumericValue(key, value);
        }
      }
    }

    switch (effectType) {
      case 'cursorSizeBonus':
        return current
          ? Data.formatTemplate('upgrade.preview.cursor_size.upgrade', params)
          : Data.formatTemplate('upgrade.preview.cursor_size.new', params);

      case 'criticalChanceBonus':
        return current
          ? Data.formatTemplate('upgrade.preview.critical_chance.upgrade', params)
          : Data.formatTemplate('upgrade.preview.critical_chance.new', params);

      case 'electricShockLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.electric_shock.upgrade', params)
          : Data.formatTemplate('upgrade.preview.electric_shock.new', params);

      case 'magnetLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.magnet.upgrade', params)
          : Data.formatTemplate('upgrade.preview.magnet.new', params);

      case 'missileLevel':
        if (!current) return Data.formatTemplate('upgrade.preview.missile.new', params);
        if (this.getNumericField(current, 'damage') !== this.getNumericField(next, 'damage')) {
          return Data.formatTemplate('upgrade.preview.missile.upgrade', params);
        }
        return Data.formatTemplate('upgrade.preview.missile.upgrade_count', params);

      case 'healthPackLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.health_pack.upgrade', params)
          : Data.formatTemplate('upgrade.preview.health_pack.new', params);

      case 'orbitingOrbLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.orbiting_orb.upgrade', params)
          : Data.formatTemplate('upgrade.preview.orbiting_orb.new', params);

      case 'blackHoleLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.black_hole.upgrade', params)
          : Data.formatTemplate('upgrade.preview.black_hole.new', params);

      default:
        return '';
    }
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

  private getNumericField(data: SystemUpgradeLevelData, key: string): number | null {
    const value = (data as unknown as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : null;
  }
}
