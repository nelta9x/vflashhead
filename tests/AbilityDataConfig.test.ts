import { describe, expect, it } from 'vitest';
import { Data } from '../src/data/DataManager';

describe('Ability data config', () => {
  it('abilities.json should have a valid top-level shape', () => {
    expect(typeof Data.abilities.version).toBe('number');
    expect(Data.abilities.version).toBeGreaterThan(0);
    expect(Array.isArray(Data.abilities.active)).toBe(true);
    expect(Data.abilities.active.length).toBeGreaterThan(0);
  });

  it('active entries should include required fields and valid icon metadata', () => {
    for (const definition of Data.abilities.active) {
      expect(definition.id.trim().length).toBeGreaterThan(0);
      expect(definition.pluginId.trim().length).toBeGreaterThan(0);
      expect(definition.upgradeId.trim().length).toBeGreaterThan(0);

      expect(definition.icon.key.trim().length).toBeGreaterThan(0);
      expect(definition.icon.path.trim().length).toBeGreaterThan(0);
      expect(definition.icon.width).toBeGreaterThan(0);
      expect(definition.icon.height).toBeGreaterThan(0);
    }
  });

  it('active entries should keep id/pluginId/icon.key unique', () => {
    const ids = new Set<string>();
    const pluginIds = new Set<string>();
    const iconKeys = new Set<string>();

    for (const definition of Data.abilities.active) {
      expect(ids.has(definition.id)).toBe(false);
      expect(pluginIds.has(definition.pluginId)).toBe(false);
      expect(iconKeys.has(definition.icon.key)).toBe(false);

      ids.add(definition.id);
      pluginIds.add(definition.pluginId);
      iconKeys.add(definition.icon.key);
    }
  });

  it('all ability upgradeIds should exist in upgrades.system', () => {
    const upgradeIds = new Set(Data.upgrades.system.map((upgrade) => upgrade.id));
    for (const definition of Data.abilities.active) {
      expect(upgradeIds.has(definition.upgradeId)).toBe(true);
    }
  });
});
