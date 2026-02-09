import type { DishUpgradeOptions } from '../Dish';

interface DishDamageConfig {
  playerDamage: number;
  criticalChance?: number;
  criticalMultiplier?: number;
}

interface DamageOutcome {
  damage: number;
  isCritical: boolean;
}

export class DishDamageResolver {
  public static resolveCursorDamage(
    damageConfig: DishDamageConfig,
    upgradeOptions: DishUpgradeOptions
  ): DamageOutcome {
    const baseDamage = damageConfig.playerDamage + (upgradeOptions.damageBonus || 0);
    const criticalChance = Math.min(
      1,
      (damageConfig.criticalChance || 0) + (upgradeOptions.criticalChance || 0)
    );
    const criticalMultiplier = damageConfig.criticalMultiplier || 2;

    return this.resolveDamage(baseDamage, criticalChance, criticalMultiplier);
  }

  public static resolveUpgradeDamage(
    damageConfig: DishDamageConfig,
    baseDamage: number,
    damageBonus: number,
    criticalChanceBonus: number
  ): DamageOutcome {
    const totalDamage = baseDamage + damageBonus;
    const criticalChance = Math.min(1, (damageConfig.criticalChance || 0) + criticalChanceBonus);
    const criticalMultiplier = damageConfig.criticalMultiplier || 2;

    return this.resolveDamage(totalDamage, criticalChance, criticalMultiplier);
  }

  private static resolveDamage(
    baseDamage: number,
    criticalChance: number,
    criticalMultiplier: number
  ): DamageOutcome {
    let damage = baseDamage;
    let isCritical = false;

    if (criticalChance > 0 && Math.random() < criticalChance) {
      damage *= criticalMultiplier;
      isCritical = true;
    }

    return { damage, isCritical };
  }
}
