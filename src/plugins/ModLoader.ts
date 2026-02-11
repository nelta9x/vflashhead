import type { ModModule, ModFactory } from './types/ModTypes';
import type { ModRegistry } from './ModRegistry';

/**
 * MOD 모듈 해석 + 에러 격리 전담.
 * ModFactory → ModModule 변환, 로딩 오케스트레이션을 담당한다.
 */
export class ModLoader {
  resolve(moduleOrFactory: ModModule | ModFactory): ModModule | null {
    if (this.isModModule(moduleOrFactory)) {
      return moduleOrFactory;
    }

    try {
      return moduleOrFactory();
    } catch {
      return null;
    }
  }

  load(moduleOrFactory: ModModule | ModFactory, registry: ModRegistry): boolean {
    const mod = this.resolve(moduleOrFactory);
    if (!mod) {
      return false;
    }
    return registry.loadMod(mod);
  }

  loadMultiple(
    modules: ReadonlyArray<ModModule | ModFactory>,
    registry: ModRegistry,
  ): string[] {
    const loaded: string[] = [];
    for (const moduleOrFactory of modules) {
      const mod = this.resolve(moduleOrFactory);
      if (mod && registry.loadMod(mod)) {
        loaded.push(mod.id);
      }
    }
    return loaded;
  }

  private isModModule(value: ModModule | ModFactory): value is ModModule {
    return typeof value === 'object' && value !== null && 'id' in value;
  }
}
