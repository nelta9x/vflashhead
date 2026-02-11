import type { PluginRegistry } from '../PluginRegistry';
import type { ModSystemRegistry } from '../ModSystemRegistry';
import type { EntitySystemPipeline } from '../../systems/EntitySystemPipeline';
import type { StatusEffectManager } from '../../systems/StatusEffectManager';

type EventCallback = (...args: unknown[]) => void;

export interface ScopedEventBus {
  on(event: string, callback: EventCallback): void;
  once(event: string, callback: EventCallback): void;
  off(event: string, callback?: EventCallback): void;
  emit(event: string, ...args: unknown[]): void;
}

export interface ModContext {
  readonly pluginRegistry: PluginRegistry;
  readonly modSystemRegistry: ModSystemRegistry;
  readonly entitySystemPipeline: EntitySystemPipeline;
  readonly statusEffectManager: StatusEffectManager;
  readonly events: ScopedEventBus;
}

export interface ModModule {
  readonly id: string;
  readonly version?: string;
  registerMod(ctx: ModContext): void;
  unregisterMod?(ctx: ModContext): void;
}

export type ModFactory = () => ModModule;
