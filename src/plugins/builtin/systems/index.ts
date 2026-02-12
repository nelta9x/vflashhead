import { PluginRegistry } from '../../PluginRegistry';
import { CoreWorldSystemsPlugin } from './CoreWorldSystemsPlugin';
import { PlayerSystemPlugin } from './PlayerSystemPlugin';
import { BossReactionSystemPlugin } from './BossReactionSystemPlugin';
import { MagnetSystemPlugin } from './MagnetSystemPlugin';
import { CursorAttackSystemPlugin } from './CursorAttackSystemPlugin';
import { BlackHoleSystemPlugin } from './BlackHoleSystemPlugin';
import { OrbSystemPlugin } from './OrbSystemPlugin';
import { FallingBombSystemPlugin } from './FallingBombSystemPlugin';
import { HealthPackSystemPlugin } from './HealthPackSystemPlugin';

export function registerBuiltinSystemPlugins(): void {
  const registry = PluginRegistry.getInstance();
  registry.registerSystemPlugin(new CoreWorldSystemsPlugin());
  registry.registerSystemPlugin(new PlayerSystemPlugin());
  registry.registerSystemPlugin(new BossReactionSystemPlugin());
  registry.registerSystemPlugin(new MagnetSystemPlugin());
  registry.registerSystemPlugin(new CursorAttackSystemPlugin());
  registry.registerSystemPlugin(new BlackHoleSystemPlugin());
  registry.registerSystemPlugin(new OrbSystemPlugin());
  registry.registerSystemPlugin(new FallingBombSystemPlugin());
  registry.registerSystemPlugin(new HealthPackSystemPlugin());
}
