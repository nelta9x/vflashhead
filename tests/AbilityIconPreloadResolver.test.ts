import { describe, expect, it } from 'vitest';
import { resolveAbilityIconPreloadIds } from '../src/scenes/boot/AbilityIconPreloadResolver';

describe('AbilityIconPreloadResolver', () => {
  it('활성 ability 순서를 유지하면서 중복을 제거해야 함', () => {
    const result = resolveAbilityIconPreloadIds(
      ['cursor_size', 'critical_chance', 'cursor_size', 'magnet'],
      ['magnet', 'cursor_size', 'critical_chance'],
    );

    expect(result).toEqual(['cursor_size', 'critical_chance', 'magnet']);
  });

  it('upgrades 목록에 없는 ability ID는 제외해야 함', () => {
    const result = resolveAbilityIconPreloadIds(
      ['cursor_size', 'unknown_ability', 'magnet'],
      ['cursor_size', 'magnet'],
    );

    expect(result).toEqual(['cursor_size', 'magnet']);
  });

  it('빈 활성 ability 목록이면 빈 배열을 반환해야 함', () => {
    const result = resolveAbilityIconPreloadIds([], ['cursor_size']);
    expect(result).toEqual([]);
  });

  it('활성 ability가 모두 미정의면 빈 배열을 반환해야 함', () => {
    const result = resolveAbilityIconPreloadIds(['x', 'y'], ['cursor_size', 'magnet']);
    expect(result).toEqual([]);
  });
});
