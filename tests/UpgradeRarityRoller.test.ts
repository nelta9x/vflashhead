import { describe, expect, it, vi } from 'vitest';
import { UpgradeRarityRoller } from '../src/systems/upgrades/UpgradeRarityRoller';

describe('UpgradeRarityRoller', () => {
  it('filters out upgrades that reached max stack', () => {
    const roller = new UpgradeRarityRoller();
    const upgrades = [
      { id: 'a', rarity: 'common' as const, maxStack: 1 },
      { id: 'b', rarity: 'rare' as const, maxStack: 3 },
    ];

    const result = roller.selectRandomUpgrades(
      upgrades,
      (id) => (id === 'a' ? 1 : 0),
      2,
      { common: 1, rare: 1, epic: 1, legendary: 1 }
    );

    expect(result).toEqual([{ id: 'b', rarity: 'rare', maxStack: 3 }]);
  });

  it('selects deterministically when random is mocked', () => {
    const roller = new UpgradeRarityRoller();
    const upgrades = [
      { id: 'common_upgrade', rarity: 'common' as const, maxStack: 3 },
      { id: 'epic_upgrade', rarity: 'epic' as const, maxStack: 3 },
    ];

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = roller.selectRandomUpgrades(
      upgrades,
      () => 0,
      1,
      { common: 10, rare: 1, epic: 1, legendary: 1 }
    );
    randomSpy.mockRestore();

    expect(result[0].id).toBe('common_upgrade');
  });
});
