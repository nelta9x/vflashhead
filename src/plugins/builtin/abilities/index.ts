import type { AbilityPlugin } from '../../types';
import type { AbilityDefinition } from '../../../data/types';
import { PluginRegistry } from '../../PluginRegistry';
import { CursorSizeAbility } from './CursorSizeAbility';
import { CriticalChanceAbility } from './CriticalChanceAbility';
import { MissileAbility } from './MissileAbility';
import { HealthPackAbility } from './HealthPackAbility';
import { MagnetAbility } from './MagnetAbility';
import { ElectricShockAbility } from './ElectricShockAbility';
import { OrbAbility } from './OrbAbility';
import { BlackHoleAbility } from './BlackHoleAbility';
import { GlassCannonAbility } from './GlassCannonAbility';
import { BerserkerAbility } from './BerserkerAbility';
import { VolatilityAbility } from './VolatilityAbility';

/** 빌트인 어빌리티 팩토리 맵. 새 어빌리티 추가 시 여기에 한 줄 추가. */
const ABILITY_FACTORIES: Record<string, () => AbilityPlugin> = {
  cursor_size: () => new CursorSizeAbility(),
  critical_chance: () => new CriticalChanceAbility(),
  missile: () => new MissileAbility(),
  health_pack: () => new HealthPackAbility(),
  magnet: () => new MagnetAbility(),
  electric_shock: () => new ElectricShockAbility(),
  orbiting_orb: () => new OrbAbility(),
  black_hole: () => new BlackHoleAbility(),
  glass_cannon: () => new GlassCannonAbility(),
  berserker: () => new BerserkerAbility(),
  volatility: () => new VolatilityAbility(),
};

export { ABILITY_FACTORIES };

export function registerBuiltinAbilities(definitions: readonly AbilityDefinition[]): void {
  const registry = PluginRegistry.getInstance();
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      throw new Error(`Duplicate ability id in abilities.json: "${definition.id}"`);
    }
    seen.add(definition.id);

    const factory = ABILITY_FACTORIES[definition.pluginId];
    if (!factory) {
      throw new Error(
        `Unknown ability pluginId "${definition.pluginId}" for ability "${definition.id}"`
      );
    }

    const plugin = factory();
    if (plugin.id !== definition.id) {
      throw new Error(
        `Ability id mismatch for plugin "${definition.pluginId}": plugin.id="${plugin.id}", definition.id="${definition.id}"`
      );
    }

    registry.registerAbility(plugin);
  }
}
