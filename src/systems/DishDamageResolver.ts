import type { DishUpgradeOptions } from '../entities/EntityTypes';

interface DishDamageConfig {
  playerDamage: number;
  criticalChance?: number;
  criticalMultiplier?: number;
}

interface DamageOutcome {
  damage: number;
  isCritical: boolean;
}

export interface CurseModifiers {
  globalDamageMultiplier: number;
  volatilityCritMultiplier: number;
  volatilityNonCritPenalty: number;
}

export class DishDamageResolver {
  public static resolveCursorDamage(
    damageConfig: DishDamageConfig,
    upgradeOptions: DishUpgradeOptions,
    curseModifiers?: CurseModifiers
  ): DamageOutcome {
    const baseDamage = damageConfig.playerDamage + (upgradeOptions.damageBonus || 0);
    const criticalChance = Math.min(
      1,
      (damageConfig.criticalChance || 0) + (upgradeOptions.criticalChance || 0)
    );
    const criticalMultiplier = damageConfig.criticalMultiplier || 2;

    return this.resolveDamage(baseDamage, criticalChance, criticalMultiplier, curseModifiers);
  }

  public static resolveUpgradeDamage(
    damageConfig: DishDamageConfig,
    baseDamage: number,
    damageBonus: number,
    criticalChanceBonus: number,
    curseModifiers?: CurseModifiers
  ): DamageOutcome {
    const totalDamage = baseDamage + damageBonus;
    const criticalChance = Math.min(1, (damageConfig.criticalChance || 0) + criticalChanceBonus);
    const criticalMultiplier = damageConfig.criticalMultiplier || 2;

    return this.resolveDamage(totalDamage, criticalChance, criticalMultiplier, curseModifiers);
  }

  private static resolveDamage(
    baseDamage: number,
    criticalChance: number,
    criticalMultiplier: number,
    curseModifiers?: CurseModifiers
  ): DamageOutcome {
    let damage = baseDamage;
    let isCritical = false;

    if (criticalChance > 0 && Math.random() < criticalChance) {
      const effectiveCritMult = curseModifiers && curseModifiers.volatilityCritMultiplier > 0
        ? curseModifiers.volatilityCritMultiplier
        : criticalMultiplier;
      damage *= effectiveCritMult;
      isCritical = true;
    } else if (curseModifiers && curseModifiers.volatilityNonCritPenalty > 0) {
      damage *= curseModifiers.volatilityNonCritPenalty;
    }

    // 글로벌 데미지 승수 (글래스 캐논 + 광전사)
    if (curseModifiers && curseModifiers.globalDamageMultiplier !== 1) {
      damage *= curseModifiers.globalDamageMultiplier;
    }

    return { damage, isCritical };
  }
}
