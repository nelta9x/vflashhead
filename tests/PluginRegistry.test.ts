import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../src/plugins/PluginRegistry';
import type { AbilityPlugin, EntityTypePlugin } from '../src/plugins/types';

function createMockAbility(id: string): AbilityPlugin {
  return {
    id,
    displayName: id,
    maxStack: 1,
    getDescription: () => '',
    getDerivedStats: () => [],
    createRenderer: () => ({
      render: () => {},
      destroy: () => {},
    }),
  } as unknown as AbilityPlugin;
}

function createMockEntityType(typeId: string): EntityTypePlugin {
  return {
    typeId,
    displayName: typeId,
    createRenderer: () => ({
      render: () => {},
      destroy: () => {},
    }),
  } as unknown as EntityTypePlugin;
}

describe('PluginRegistry - unregister', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    PluginRegistry.resetInstance();
    registry = PluginRegistry.getInstance();
  });

  describe('unregisterAbility', () => {
    it('등록된 능력을 삭제하고 true를 반환해야 함', () => {
      registry.registerAbility(createMockAbility('missile'));
      expect(registry.unregisterAbility('missile')).toBe(true);
    });

    it('삭제 후 getAbility는 undefined를 반환해야 함', () => {
      registry.registerAbility(createMockAbility('missile'));
      registry.unregisterAbility('missile');
      expect(registry.getAbility('missile')).toBeUndefined();
    });

    it('미존재 ID는 false를 반환해야 함', () => {
      expect(registry.unregisterAbility('nonexistent')).toBe(false);
    });

    it('다른 능력에 영향을 주지 않아야 함', () => {
      registry.registerAbility(createMockAbility('missile'));
      registry.registerAbility(createMockAbility('orb'));
      registry.unregisterAbility('missile');
      expect(registry.getAbility('orb')).toBeDefined();
    });
  });

  describe('unregisterEntityType', () => {
    it('등록된 엔티티 타입을 삭제하고 true를 반환해야 함', () => {
      registry.registerEntityType(createMockEntityType('basic'));
      expect(registry.unregisterEntityType('basic')).toBe(true);
    });

    it('삭제 후 getEntityType은 undefined를 반환해야 함', () => {
      registry.registerEntityType(createMockEntityType('basic'));
      registry.unregisterEntityType('basic');
      expect(registry.getEntityType('basic')).toBeUndefined();
    });

    it('미존재 ID는 false를 반환해야 함', () => {
      expect(registry.unregisterEntityType('nonexistent')).toBe(false);
    });

    it('다른 엔티티 타입에 영향을 주지 않아야 함', () => {
      registry.registerEntityType(createMockEntityType('basic'));
      registry.registerEntityType(createMockEntityType('bomb'));
      registry.unregisterEntityType('basic');
      expect(registry.getEntityType('bomb')).toBeDefined();
    });
  });
});
