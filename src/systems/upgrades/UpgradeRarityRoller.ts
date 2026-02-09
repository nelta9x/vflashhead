export interface RollableUpgrade {
  id: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  maxStack: number;
}

type RarityWeightMap = Record<string, number>;

export class UpgradeRarityRoller {
  public selectRandomUpgrades<T extends RollableUpgrade>(
    upgrades: T[],
    getCurrentStack: (upgradeId: string) => number,
    count: number,
    rarityWeights: RarityWeightMap
  ): T[] {
    const availableUpgrades = upgrades.filter((upgrade) => {
      const currentStack = getCurrentStack(upgrade.id);
      return currentStack < upgrade.maxStack;
    });

    if (availableUpgrades.length === 0) {
      return upgrades.slice(0, count);
    }

    if (count >= availableUpgrades.length) {
      return this.shuffleArray([...availableUpgrades]);
    }

    const selected: T[] = [];
    const pool = [...availableUpgrades];

    while (selected.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, upgrade) => sum + (rarityWeights[upgrade.rarity] || 0), 0);
      let random = Math.random() * totalWeight;
      let selectedIndex = pool.length - 1;

      for (let i = 0; i < pool.length; i++) {
        random -= rarityWeights[pool[i].rarity] || 0;
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }

      selected.push(pool[selectedIndex]);
      pool.splice(selectedIndex, 1);
    }

    return selected;
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
