import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/data/constants', () => ({}));
vi.mock('../src/utils/EventBus', async () => {
  const { EventBus: RealEventBus } = await import('../src/utils/EventBus');
  return { EventBus: RealEventBus, GameEvents: {} };
});

import { EventBus } from '../src/utils/EventBus';
import { PluginRegistry } from '../src/plugins/PluginRegistry';
import { ModSystemRegistry } from '../src/plugins/ModSystemRegistry';
import { EntitySystemPipeline } from '../src/systems/EntitySystemPipeline';
import { StatusEffectManager } from '../src/systems/StatusEffectManager';
import { ModRegistry } from '../src/plugins/ModRegistry';
import type { ModModule, ModContext } from '../src/plugins/types/ModTypes';
import type { AbilityPlugin, EntityTypePlugin } from '../src/plugins/types';
import type { EntitySystem } from '../src/systems/entity-systems/EntitySystem';

function createMockAbility(id: string): AbilityPlugin {
  return {
    id,
    displayName: id,
    maxStack: 1,
    getDescription: () => '',
    getDerivedStats: () => [],
    createRenderer: () => ({ render: () => {}, destroy: () => {} }),
  } as unknown as AbilityPlugin;
}

function createMockEntityType(typeId: string): EntityTypePlugin {
  return {
    typeId,
    displayName: typeId,
    createRenderer: () => ({ render: () => {}, destroy: () => {} }),
  } as unknown as EntityTypePlugin;
}

function createMockEntitySystem(id: string): EntitySystem {
  return { id, enabled: true, tick: vi.fn() };
}

describe('ModRegistry', () => {
  let pluginRegistry: PluginRegistry;
  let modSystemRegistry: ModSystemRegistry;
  let entitySystemPipeline: EntitySystemPipeline;
  let statusEffectManager: StatusEffectManager;
  let eventBus: EventBus;
  let registry: ModRegistry;

  beforeEach(() => {
    PluginRegistry.resetInstance();
    pluginRegistry = PluginRegistry.getInstance();
    modSystemRegistry = new ModSystemRegistry();
    entitySystemPipeline = new EntitySystemPipeline([]);
    statusEffectManager = new StatusEffectManager();
    EventBus.resetInstance();
    eventBus = EventBus.getInstance();
    registry = new ModRegistry(
      pluginRegistry,
      modSystemRegistry,
      entitySystemPipeline,
      statusEffectManager,
      eventBus,
    );
  });

  describe('loadMod', () => {
    it('정상 MOD를 로드하고 true를 반환해야 함', () => {
      const mod: ModModule = {
        id: 'test-mod',
        registerMod: vi.fn(),
      };
      expect(registry.loadMod(mod)).toBe(true);
      expect(registry.isLoaded('test-mod')).toBe(true);
    });

    it('스냅샷 diff로 ability 등록을 추적해야 함', () => {
      const mod: ModModule = {
        id: 'ability-mod',
        registerMod: (ctx: ModContext) => {
          ctx.pluginRegistry.registerAbility(createMockAbility('mod-missile'));
        },
      };
      registry.loadMod(mod);
      expect(pluginRegistry.getAbility('mod-missile')).toBeDefined();

      registry.unloadMod('ability-mod');
      expect(pluginRegistry.getAbility('mod-missile')).toBeUndefined();
    });

    it('스냅샷 diff로 entityType 등록을 추적해야 함', () => {
      const mod: ModModule = {
        id: 'entity-mod',
        registerMod: (ctx: ModContext) => {
          ctx.pluginRegistry.registerEntityType(createMockEntityType('mod-boss'));
        },
      };
      registry.loadMod(mod);
      expect(pluginRegistry.getEntityType('mod-boss')).toBeDefined();

      registry.unloadMod('entity-mod');
      expect(pluginRegistry.getEntityType('mod-boss')).toBeUndefined();
    });

    it('스냅샷 diff로 modSystem 등록을 추적해야 함', () => {
      const mod: ModModule = {
        id: 'system-mod',
        registerMod: (ctx: ModContext) => {
          ctx.modSystemRegistry.registerSystem('mod-sys', vi.fn());
        },
      };
      registry.loadMod(mod);
      expect(modSystemRegistry.getSystemIds()).toContain('mod-sys');

      registry.unloadMod('system-mod');
      expect(modSystemRegistry.getSystemIds()).not.toContain('mod-sys');
    });

    it('스냅샷 diff로 entitySystem 등록을 추적해야 함', () => {
      const mod: ModModule = {
        id: 'esys-mod',
        registerMod: (ctx: ModContext) => {
          ctx.entitySystemPipeline.register(createMockEntitySystem('mod-entity-sys'));
        },
      };
      registry.loadMod(mod);
      expect(entitySystemPipeline.getRegisteredIds()).toContain('mod-entity-sys');

      registry.unloadMod('esys-mod');
      expect(entitySystemPipeline.getRegisteredIds()).not.toContain('mod-entity-sys');
    });

    it('스냅샷 diff로 event 구독을 추적해야 함', () => {
      const cb = vi.fn();
      const mod: ModModule = {
        id: 'event-mod',
        registerMod: (ctx: ModContext) => {
          ctx.events.on('custom:event', cb);
        },
      };
      registry.loadMod(mod);
      eventBus.emit('custom:event', 'test');
      expect(cb).toHaveBeenCalledWith('test');

      registry.unloadMod('event-mod');
      cb.mockClear();
      eventBus.emit('custom:event', 'test2');
      expect(cb).not.toHaveBeenCalled();
    });

    it('중복 ID는 false를 반환해야 함', () => {
      const mod: ModModule = { id: 'dup', registerMod: vi.fn() };
      expect(registry.loadMod(mod)).toBe(true);
      expect(registry.loadMod(mod)).toBe(false);
    });

    it('registerMod 에러 시 롤백하고 false를 반환해야 함', () => {
      const mod: ModModule = {
        id: 'error-mod',
        registerMod: (ctx: ModContext) => {
          ctx.pluginRegistry.registerAbility(createMockAbility('error-ability'));
          ctx.modSystemRegistry.registerSystem('error-sys', vi.fn());
          throw new Error('registration failed');
        },
      };

      expect(registry.loadMod(mod)).toBe(false);
      expect(registry.isLoaded('error-mod')).toBe(false);
      expect(pluginRegistry.getAbility('error-ability')).toBeUndefined();
      expect(modSystemRegistry.getSystemIds()).not.toContain('error-sys');
    });

    it('기존 builtin 등록은 diff에서 제외해야 함', () => {
      pluginRegistry.registerAbility(createMockAbility('builtin-ability'));
      const mod: ModModule = {
        id: 'safe-mod',
        registerMod: (ctx: ModContext) => {
          ctx.pluginRegistry.registerAbility(createMockAbility('new-ability'));
        },
      };
      registry.loadMod(mod);
      registry.unloadMod('safe-mod');

      // builtin은 그대로, MOD 것만 제거
      expect(pluginRegistry.getAbility('builtin-ability')).toBeDefined();
      expect(pluginRegistry.getAbility('new-ability')).toBeUndefined();
    });
  });

  describe('unloadMod', () => {
    it('unregisterMod 콜백을 호출해야 함', () => {
      const unregister = vi.fn();
      const mod: ModModule = {
        id: 'clean-mod',
        registerMod: vi.fn(),
        unregisterMod: unregister,
      };
      registry.loadMod(mod);
      registry.unloadMod('clean-mod');
      expect(unregister).toHaveBeenCalled();
    });

    it('미존재 ID는 false를 반환해야 함', () => {
      expect(registry.unloadMod('nonexistent')).toBe(false);
    });

    it('unregisterMod 에러를 무시해야 함', () => {
      const mod: ModModule = {
        id: 'error-unload',
        registerMod: vi.fn(),
        unregisterMod: () => {
          throw new Error('unregister failed');
        },
      };
      registry.loadMod(mod);
      expect(() => registry.unloadMod('error-unload')).not.toThrow();
      expect(registry.isLoaded('error-unload')).toBe(false);
    });

    it('등록된 모든 리소스를 해제해야 함', () => {
      const mod: ModModule = {
        id: 'full-mod',
        registerMod: (ctx: ModContext) => {
          ctx.pluginRegistry.registerAbility(createMockAbility('fa'));
          ctx.pluginRegistry.registerEntityType(createMockEntityType('fe'));
          ctx.modSystemRegistry.registerSystem('fs', vi.fn());
          ctx.entitySystemPipeline.register(createMockEntitySystem('fes'));
          ctx.events.on('test:ev', vi.fn());
        },
      };
      registry.loadMod(mod);
      registry.unloadMod('full-mod');

      expect(pluginRegistry.getAbility('fa')).toBeUndefined();
      expect(pluginRegistry.getEntityType('fe')).toBeUndefined();
      expect(modSystemRegistry.getSystemIds()).not.toContain('fs');
      expect(entitySystemPipeline.getRegisteredIds()).not.toContain('fes');
    });
  });

  describe('unloadAll', () => {
    it('역순으로 모든 MOD를 해제해야 함', () => {
      const order: string[] = [];
      const mod1: ModModule = {
        id: 'mod-a',
        registerMod: vi.fn(),
        unregisterMod: () => order.push('mod-a'),
      };
      const mod2: ModModule = {
        id: 'mod-b',
        registerMod: vi.fn(),
        unregisterMod: () => order.push('mod-b'),
      };
      registry.loadMod(mod1);
      registry.loadMod(mod2);
      registry.unloadAll();

      expect(order).toEqual(['mod-b', 'mod-a']);
      expect(registry.getModCount()).toBe(0);
    });

    it('빈 상태에서 호출해도 안전해야 함', () => {
      expect(() => registry.unloadAll()).not.toThrow();
    });
  });

  describe('getLoadedModIds / isLoaded / getModCount', () => {
    it('로드된 MOD ID 목록을 반환해야 함', () => {
      registry.loadMod({ id: 'a', registerMod: vi.fn() });
      registry.loadMod({ id: 'b', registerMod: vi.fn() });
      expect(registry.getLoadedModIds()).toEqual(['a', 'b']);
    });

    it('isLoaded가 정확해야 함', () => {
      registry.loadMod({ id: 'x', registerMod: vi.fn() });
      expect(registry.isLoaded('x')).toBe(true);
      expect(registry.isLoaded('y')).toBe(false);
    });

    it('getModCount가 정확해야 함', () => {
      expect(registry.getModCount()).toBe(0);
      registry.loadMod({ id: 'a', registerMod: vi.fn() });
      expect(registry.getModCount()).toBe(1);
      registry.loadMod({ id: 'b', registerMod: vi.fn() });
      expect(registry.getModCount()).toBe(2);
      registry.unloadMod('a');
      expect(registry.getModCount()).toBe(1);
    });
  });
});
