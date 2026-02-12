import { PluginRegistry } from '../../PluginRegistry';
import { FallingBombSystemPlugin } from './FallingBombSystemPlugin';
import { HealthPackSystemPlugin } from './HealthPackSystemPlugin';

export function registerBuiltinSystemPlugins(): void {
  const registry = PluginRegistry.getInstance();
  registry.registerSystemPlugin(new FallingBombSystemPlugin());
  registry.registerSystemPlugin(new HealthPackSystemPlugin());
}
