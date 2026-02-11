import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ModLoader } from '../src/plugins/ModLoader';
import type { ModModule, ModFactory } from '../src/plugins/types/ModTypes';
import type { ModRegistry } from '../src/plugins/ModRegistry';

function createMockMod(id: string): ModModule {
  return {
    id,
    registerMod: vi.fn(),
  };
}

function createMockRegistry(): ModRegistry {
  return {
    loadMod: vi.fn(() => true),
    unloadMod: vi.fn(() => true),
    unloadAll: vi.fn(),
    getLoadedModIds: vi.fn(() => []),
    isLoaded: vi.fn(() => false),
    getModCount: vi.fn(() => 0),
  } as unknown as ModRegistry;
}

describe('ModLoader', () => {
  let loader: ModLoader;

  beforeAll(() => {
    loader = new ModLoader();
  });

  describe('resolve', () => {
    it('ModModule을 직접 반환해야 함', () => {
      const mod = createMockMod('test');
      expect(loader.resolve(mod)).toBe(mod);
    });

    it('ModFactory 호출 후 ModModule을 반환해야 함', () => {
      const mod = createMockMod('factory-mod');
      const factory: ModFactory = () => mod;
      expect(loader.resolve(factory)).toBe(mod);
    });

    it('Factory 에러 시 null을 반환해야 함', () => {
      const factory: ModFactory = () => {
        throw new Error('factory error');
      };
      expect(loader.resolve(factory)).toBeNull();
    });
  });

  describe('load', () => {
    it('ModRegistry.loadMod에 위임해야 함', () => {
      const mod = createMockMod('test');
      const registry = createMockRegistry();
      const result = loader.load(mod, registry);
      expect(registry.loadMod).toHaveBeenCalledWith(mod);
      expect(result).toBe(true);
    });

    it('resolve 실패 시 false를 반환해야 함', () => {
      const factory: ModFactory = () => {
        throw new Error('fail');
      };
      const registry = createMockRegistry();
      const result = loader.load(factory, registry);
      expect(registry.loadMod).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('registry.loadMod이 false를 반환하면 false를 반환해야 함', () => {
      const mod = createMockMod('dup');
      const registry = createMockRegistry();
      vi.mocked(registry.loadMod).mockReturnValue(false);
      expect(loader.load(mod, registry)).toBe(false);
    });
  });

  describe('loadMultiple', () => {
    it('다수 MOD를 순차 로드하고 성공 ID를 반환해야 함', () => {
      const mod1 = createMockMod('mod1');
      const mod2 = createMockMod('mod2');
      const registry = createMockRegistry();

      const result = loader.loadMultiple([mod1, mod2], registry);
      expect(result).toEqual(['mod1', 'mod2']);
    });

    it('1개 실패 시 나머지를 계속 로드해야 함', () => {
      const mod1 = createMockMod('mod1');
      const badFactory: ModFactory = () => {
        throw new Error('fail');
      };
      const mod3 = createMockMod('mod3');
      const registry = createMockRegistry();

      const result = loader.loadMultiple([mod1, badFactory, mod3], registry);
      expect(result).toEqual(['mod1', 'mod3']);
    });

    it('빈 배열은 빈 결과를 반환해야 함', () => {
      const registry = createMockRegistry();
      expect(loader.loadMultiple([], registry)).toEqual([]);
    });
  });
});
