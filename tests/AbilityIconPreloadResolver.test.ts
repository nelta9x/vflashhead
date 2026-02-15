import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '../src/data/types';
import { resolveAbilityIconPreloadDefinitions } from '../src/scenes/boot/AbilityIconPreloadResolver';

function def(id: string, upgradeId: string = id): AbilityDefinition {
  return {
    id,
    pluginId: id,
    upgradeId,
    icon: {
      key: `${id}_icon`,
      path: `assets/icons/${id}.svg`,
      width: 64,
      height: 64,
    },
  };
}

describe('AbilityIconPreloadResolver', () => {
  it('활성 ability 순서를 유지하면서 중복을 제거해야 함', () => {
    const result = resolveAbilityIconPreloadDefinitions(
      [def('cursor_size'), def('critical_chance'), def('cursor_size'), def('magnet')],
      ['magnet', 'cursor_size', 'critical_chance'],
    );

    expect(result.definitions.map((entry) => entry.id)).toEqual([
      'cursor_size',
      'critical_chance',
      'magnet',
    ]);
    expect(result.skippedAbilityIds).toEqual([]);
  });

  it('upgrades 목록에 없는 ability ID는 제외해야 함', () => {
    const result = resolveAbilityIconPreloadDefinitions(
      [def('cursor_size'), def('unknown_ability'), def('magnet')],
      ['cursor_size', 'magnet'],
    );

    expect(result.definitions.map((entry) => entry.id)).toEqual(['cursor_size', 'magnet']);
    expect(result.skippedAbilityIds).toEqual(['unknown_ability']);
  });

  it('빈 활성 ability 목록이면 빈 배열을 반환해야 함', () => {
    const result = resolveAbilityIconPreloadDefinitions([], ['cursor_size']);
    expect(result.definitions).toEqual([]);
    expect(result.skippedAbilityIds).toEqual([]);
  });

  it('활성 ability가 모두 미정의면 빈 배열을 반환해야 함', () => {
    const result = resolveAbilityIconPreloadDefinitions([def('x'), def('y')], ['cursor_size', 'magnet']);
    expect(result.definitions).toEqual([]);
    expect(result.skippedAbilityIds).toEqual(['x', 'y']);
  });
});
