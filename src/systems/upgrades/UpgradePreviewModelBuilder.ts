import { Data } from '../../data/DataManager';
import type {
  SystemUpgradeData,
  SystemUpgradeLevelData,
  UpgradePreviewCardModel,
  UpgradePreviewRowModel,
  UpgradePreviewStatId,
} from '../../data/types/upgrades';

interface UpgradePreviewModelBuilderDeps {
  getUpgradeStack: (upgradeId: string) => number;
}

const INVERSE_IMPROVEMENT_STATS = new Set<UpgradePreviewStatId>(['damageInterval', 'spawnInterval', 'hpPenalty']);
const PERCENT_STATS = new Set<UpgradePreviewStatId>([
  'sizeBonus',
  'missileThicknessBonus',
  'criticalChance',
  'dropChanceBonus',
  'damageMultiplier',
  'missingHpDamagePercent',
  'nonCritPenalty',
]);

type NumericField =
  | 'sizeBonus'
  | 'damage'
  | 'missileThicknessBonus'
  | 'criticalChance'
  | 'radius'
  | 'force'
  | 'count'
  | 'hpBonus'
  | 'dropChanceBonus'
  | 'speed'
  | 'size'
  | 'damageInterval'
  | 'spawnInterval'
  | 'duration'
  | 'spawnCount'
  | 'damageMultiplier'
  | 'hpPenalty'
  | 'missingHpDamagePercent'
  | 'critMultiplier'
  | 'nonCritPenalty';

const NUMERIC_FIELDS: readonly NumericField[] = [
  'sizeBonus',
  'damage',
  'missileThicknessBonus',
  'criticalChance',
  'radius',
  'force',
  'count',
  'hpBonus',
  'dropChanceBonus',
  'speed',
  'size',
  'damageInterval',
  'spawnInterval',
  'duration',
  'spawnCount',
  'damageMultiplier',
  'hpPenalty',
  'missingHpDamagePercent',
  'critMultiplier',
  'nonCritPenalty',
];

export class UpgradePreviewModelBuilder {
  private readonly getUpgradeStack: (upgradeId: string) => number;

  constructor(deps: UpgradePreviewModelBuilderDeps) {
    this.getUpgradeStack = deps.getUpgradeStack;
  }

  public build(upgradeId: string): UpgradePreviewCardModel | null {
    const upgradeData = this.getUpgradeDataOrThrow(upgradeId);
    const levels = upgradeData.levels;
    if (!levels || levels.length === 0) {
      return null;
    }
    this.validatePreviewDisplay(upgradeData);

    const currentLevel = this.getUpgradeStack(upgradeId);
    const nextLevel = currentLevel + 1;
    if (nextLevel > levels.length) {
      return null;
    }

    const currentData = currentLevel > 0 ? levels[currentLevel - 1] : null;
    const nextData = levels[nextLevel - 1];
    const rows: UpgradePreviewRowModel[] = [];

    for (const stat of upgradeData.previewDisplay.stats) {
      const currentValue = this.resolveStatValue(upgradeId, stat.id, currentData, false);
      const nextValue = this.resolveStatValue(upgradeId, stat.id, nextData, true);
      if (currentValue === null || nextValue === null) {
        continue;
      }

      const deltaValue = nextValue - currentValue;
      if (Math.abs(deltaValue) < Number.EPSILON) {
        continue;
      }

      rows.push({
        id: stat.id,
        label: Data.t(stat.labelKey),
        currentValue,
        nextValue,
        deltaValue,
        currentDisplay: this.formatValue(stat.id, currentValue),
        nextDisplay: this.formatValue(stat.id, nextValue),
        deltaDisplay: this.formatDelta(stat.id, deltaValue),
        isImprovement: this.isImprovement(stat.id, deltaValue),
        isDerived: stat.id === 'cursorRadiusPx' || stat.id === 'orbFinalSizeWithMagnet',
      });
    }

    return {
      upgradeId,
      currentLevel,
      nextLevel,
      rows,
    };
  }

  private validatePreviewDisplay(upgradeData: SystemUpgradeData): void {
    const previewDisplay = upgradeData.previewDisplay;
    if (!previewDisplay || previewDisplay.stats.length === 0) {
      throw new Error(`upgrade.previewDisplay is required for "${upgradeData.id}"`);
    }
  }

  private resolveStatValue(
    upgradeId: string,
    statId: UpgradePreviewStatId,
    levelData: SystemUpgradeLevelData | null,
    isNextLevel: boolean
  ): number | null {
    if (statId === 'cursorRadiusPx') {
      const sizeBonus = this.resolveDirectNumeric('sizeBonus', levelData);
      if (sizeBonus === null) return null;
      const baseRadius = Data.gameConfig.player.cursorHitbox.baseRadius;
      return baseRadius * (1 + sizeBonus);
    }

    if (statId === 'orbFinalSizeWithMagnet') {
      const orbSize = this.resolveOrbSize(upgradeId, levelData);
      if (orbSize === null) return null;

      const magnetLevel = this.resolveMagnetLevel(upgradeId, isNextLevel);
      const upgradeData = this.getUpgradeDataOrThrow('orbiting_orb');
      const magnetSynergyPerLevel = upgradeData.magnetSynergyPerLevel ?? 0.2;
      return orbSize * (1 + magnetLevel * magnetSynergyPerLevel);
    }

    return this.resolveDirectNumeric(statId, levelData);
  }

  private resolveOrbSize(upgradeId: string, levelData: SystemUpgradeLevelData | null): number | null {
    if (upgradeId === 'orbiting_orb') {
      return this.resolveDirectNumeric('size', levelData);
    }

    const orbLevel = this.getUpgradeStack('orbiting_orb');
    if (orbLevel <= 0) {
      return null;
    }

    const orbLevelData = this.getLevelDataAt('orbiting_orb', orbLevel);
    return this.resolveDirectNumeric('size', orbLevelData);
  }

  private resolveMagnetLevel(upgradeId: string, isNextLevel: boolean): number {
    const currentMagnetLevel = this.getUpgradeStack('magnet');
    if (upgradeId !== 'magnet') {
      return currentMagnetLevel;
    }
    return isNextLevel ? currentMagnetLevel + 1 : currentMagnetLevel;
  }

  private resolveDirectNumeric(
    statId: UpgradePreviewStatId | NumericField,
    levelData: SystemUpgradeLevelData | null
  ): number | null {
    if (!levelData) {
      return 0;
    }

    if (!this.isNumericField(statId)) {
      return null;
    }

    switch (statId) {
      case 'sizeBonus':
        return 'sizeBonus' in levelData ? levelData.sizeBonus : null;
      case 'damage':
        return 'damage' in levelData ? levelData.damage : null;
      case 'missileThicknessBonus':
        return 'missileThicknessBonus' in levelData ? levelData.missileThicknessBonus : null;
      case 'criticalChance':
        return 'criticalChance' in levelData ? levelData.criticalChance : null;
      case 'radius':
        return 'radius' in levelData ? levelData.radius : null;
      case 'force':
        return 'force' in levelData ? levelData.force : null;
      case 'count':
        return 'count' in levelData ? levelData.count : null;
      case 'hpBonus':
        return 'hpBonus' in levelData ? levelData.hpBonus : null;
      case 'dropChanceBonus':
        return 'dropChanceBonus' in levelData ? levelData.dropChanceBonus : null;
      case 'speed':
        return 'speed' in levelData ? levelData.speed : null;
      case 'size':
        return 'size' in levelData ? levelData.size : null;
      case 'damageInterval':
        return 'damageInterval' in levelData ? levelData.damageInterval : null;
      case 'spawnInterval':
        return 'spawnInterval' in levelData ? levelData.spawnInterval : null;
      case 'duration':
        return 'duration' in levelData ? levelData.duration : null;
      case 'spawnCount':
        return 'spawnCount' in levelData ? levelData.spawnCount : null;
      case 'damageMultiplier':
        return 'damageMultiplier' in levelData ? levelData.damageMultiplier : null;
      case 'hpPenalty':
        return 'hpPenalty' in levelData ? levelData.hpPenalty : null;
      case 'missingHpDamagePercent':
        return 'missingHpDamagePercent' in levelData ? levelData.missingHpDamagePercent : null;
      case 'critMultiplier':
        return 'critMultiplier' in levelData ? levelData.critMultiplier : null;
      case 'nonCritPenalty':
        return 'nonCritPenalty' in levelData ? levelData.nonCritPenalty : null;
      default:
        return null;
    }
  }

  private isNumericField(statId: UpgradePreviewStatId | NumericField): statId is NumericField {
    return NUMERIC_FIELDS.includes(statId as NumericField);
  }

  private isImprovement(statId: UpgradePreviewStatId, deltaValue: number): boolean {
    if (INVERSE_IMPROVEMENT_STATS.has(statId)) {
      return deltaValue < 0;
    }
    return deltaValue > 0;
  }

  private formatValue(statId: UpgradePreviewStatId, value: number): string {
    if (PERCENT_STATS.has(statId)) {
      return `${Math.round(value * 100)}%`;
    }
    return `${Math.round(value)}`;
  }

  private formatDelta(statId: UpgradePreviewStatId, deltaValue: number): string {
    const sign = deltaValue >= 0 ? '+' : '-';
    const absDelta = Math.abs(deltaValue);
    if (PERCENT_STATS.has(statId)) {
      return `${sign}${Math.round(absDelta * 100)}%`;
    }
    return `${sign}${Math.round(absDelta)}`;
  }

  private getUpgradeDataOrThrow(upgradeId: string): SystemUpgradeData {
    const upgradeData = Data.upgrades.system.find((upgrade) => upgrade.id === upgradeId);
    if (!upgradeData) {
      throw new Error(`Unknown upgrade id: "${upgradeId}"`);
    }
    return upgradeData;
  }

  private getLevelDataAt(upgradeId: string, level: number): SystemUpgradeLevelData | null {
    const upgradeData = this.getUpgradeDataOrThrow(upgradeId);
    if (!upgradeData.levels || level <= 0 || level > upgradeData.levels.length) {
      return null;
    }
    return upgradeData.levels[level - 1];
  }
}
