import { describe, expect, it } from 'vitest';
import type { AbilityDefinition, SystemUpgradeData } from '../src/data/types';
import type { AbilityPlugin } from '../src/plugins/types';
import { assertAbilityConfigSyncOrThrow } from '../src/plugins/builtin/services/upgrades/AbilityConfigSyncValidator';

function createPlugin(id: string): AbilityPlugin {
  return {
    id,
    init: () => {},
    update: () => {},
    clear: () => {},
    destroy: () => {},
    createRenderer: () => null,
    getEffectValue: () => 0,
  };
}

function createDefinition(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  const id = overrides.id ?? 'cursor_size';
  const pluginId = overrides.pluginId ?? 'cursor_size';
  const upgradeId = overrides.upgradeId ?? 'cursor_size';
  return {
    id,
    pluginId,
    upgradeId,
    icon: overrides.icon ?? {
      key: `${id}_icon`,
      path: `assets/icons/${id}.svg`,
      width: 64,
      height: 64,
    },
  };
}

function createUpgrade(id: string): SystemUpgradeData {
  return {
    id,
    name: id,
    description: id,
    rarity: 'common',
    effectType: 'test',
    levels: [{ value: 1 }],
    previewDisplay: {
      stats: [{ id: 'damage', labelKey: 'upgrade.stat.damage' }],
    },
  } as unknown as SystemUpgradeData;
}

describe('AbilityConfigSyncValidator', () => {
  it('정상 구성에서는 통과해야 함', () => {
    const definitions = [createDefinition()];
    const upgrades = [createUpgrade('cursor_size')];
    const abilityFactories = { cursor_size: () => createPlugin('cursor_size') };
    const registry = { getAbility: (id: string) => createPlugin(id) };

    expect(() =>
      assertAbilityConfigSyncOrThrow({
        definitions,
        upgrades,
        abilityFactories,
        registry,
      })
    ).not.toThrow();
  });

  it('중복 id가 있으면 실패해야 함', () => {
    const definitions = [createDefinition({ id: 'cursor_size' }), createDefinition({ id: 'cursor_size' })];
    const upgrades = [createUpgrade('cursor_size')];
    const abilityFactories = { cursor_size: () => createPlugin('cursor_size') };
    const registry = { getAbility: (id: string) => createPlugin(id) };

    expect(() =>
      assertAbilityConfigSyncOrThrow({
        definitions,
        upgrades,
        abilityFactories,
        registry,
      })
    ).toThrow(/Duplicate ability id/);
  });

  it('미등록 pluginId가 있으면 실패해야 함', () => {
    const definitions = [createDefinition({ pluginId: 'missing_plugin' })];
    const upgrades = [createUpgrade('cursor_size')];
    const abilityFactories = { cursor_size: () => createPlugin('cursor_size') };
    const registry = { getAbility: (id: string) => createPlugin(id) };

    expect(() =>
      assertAbilityConfigSyncOrThrow({
        definitions,
        upgrades,
        abilityFactories,
        registry,
      })
    ).toThrow(/Unknown ability pluginId/);
  });

  it('미정의 upgradeId가 있으면 실패해야 함', () => {
    const definitions = [createDefinition({ upgradeId: 'missing_upgrade' })];
    const upgrades = [createUpgrade('cursor_size')];
    const abilityFactories = { cursor_size: () => createPlugin('cursor_size') };
    const registry = { getAbility: (id: string) => createPlugin(id) };

    expect(() =>
      assertAbilityConfigSyncOrThrow({
        definitions,
        upgrades,
        abilityFactories,
        registry,
      })
    ).toThrow(/Unknown upgradeId/);
  });

  it('아이콘 메타(path/size)가 잘못되면 실패해야 함', () => {
    const definitions = [
      createDefinition({
        icon: {
          key: 'cursor_size_icon',
          path: '',
          width: 0,
          height: -1,
        },
      }),
    ];
    const upgrades = [createUpgrade('cursor_size')];
    const abilityFactories = { cursor_size: () => createPlugin('cursor_size') };
    const registry = { getAbility: (id: string) => createPlugin(id) };

    expect(() =>
      assertAbilityConfigSyncOrThrow({
        definitions,
        upgrades,
        abilityFactories,
        registry,
      })
    ).toThrow(/Invalid icon\.(path|width|height)/);
  });
});
