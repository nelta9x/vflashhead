import type { ModSystemRegistry, ModSystemContext } from '../../plugins/ModSystemRegistry';
import type { EntitySystem } from './EntitySystem';

export class ModTickSystem implements EntitySystem {
  readonly id = 'core:mod_tick';
  enabled = true;

  private readonly modSystemRegistry: ModSystemRegistry;
  private readonly getContext: () => ModSystemContext;

  constructor(modSystemRegistry: ModSystemRegistry, getContext: () => ModSystemContext) {
    this.modSystemRegistry = modSystemRegistry;
    this.getContext = getContext;
  }

  tick(delta: number): void {
    this.modSystemRegistry.runAll(delta, this.getContext());
  }
}
