import { describe, expect, it } from 'vitest';
import { Data } from '../src/data/DataManager';
import { getUpgradeFallbackSymbol } from '../src/ui/upgrade/UpgradeIconCatalog';

describe('UpgradeIconCatalog', () => {
  it('should provide non-default symbols for all current system upgrades', () => {
    for (const upgrade of Data.upgrades.system) {
      const symbol = getUpgradeFallbackSymbol(upgrade.id);
      expect(symbol).not.toBe('★');
    }
  });

  it('should fallback to default symbol for unknown upgrade ids', () => {
    expect(getUpgradeFallbackSymbol('unknown_upgrade_id')).toBe('★');
  });
});
