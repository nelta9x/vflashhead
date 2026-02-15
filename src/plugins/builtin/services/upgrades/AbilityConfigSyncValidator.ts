import { Data } from '../../../../data/DataManager';
import type { AbilityDefinition, SystemUpgradeData } from '../../../../data/types';
import { PluginRegistry } from '../../../PluginRegistry';
import type { AbilityPlugin } from '../../../types';
import { ABILITY_FACTORIES } from '../../abilities';

interface AbilityConfigSyncValidatorOptions {
  definitions?: readonly AbilityDefinition[];
  upgrades?: readonly SystemUpgradeData[];
  abilityFactories?: Readonly<Record<string, () => AbilityPlugin>>;
  registry?: Pick<PluginRegistry, 'getAbility'>;
}

export function assertAbilityConfigSyncOrThrow(
  options: AbilityConfigSyncValidatorOptions = {}
): void {
  const definitions = options.definitions ?? Data.abilities.active;
  const upgrades = options.upgrades ?? Data.upgrades.system;
  const abilityFactories = options.abilityFactories ?? ABILITY_FACTORIES;
  const registry = options.registry ?? PluginRegistry.getInstance();
  const upgradeIdSet = new Set(upgrades.map((upgrade) => upgrade.id));

  const seenIds = new Set<string>();
  const seenPluginIds = new Set<string>();
  const seenIconKeys = new Set<string>();
  const errors: string[] = [];

  for (const definition of definitions) {
    if (seenIds.has(definition.id)) {
      errors.push(`Duplicate ability id: "${definition.id}"`);
    }
    seenIds.add(definition.id);

    if (seenPluginIds.has(definition.pluginId)) {
      errors.push(`Duplicate pluginId in abilities.active: "${definition.pluginId}"`);
    }
    seenPluginIds.add(definition.pluginId);

    if (seenIconKeys.has(definition.icon.key)) {
      errors.push(`Duplicate icon.key in abilities.active: "${definition.icon.key}"`);
    }
    seenIconKeys.add(definition.icon.key);

    if (!abilityFactories[definition.pluginId]) {
      errors.push(
        `Unknown ability pluginId "${definition.pluginId}" for ability "${definition.id}"`
      );
    }

    if (!upgradeIdSet.has(definition.upgradeId)) {
      errors.push(
        `Unknown upgradeId "${definition.upgradeId}" for ability "${definition.id}"`
      );
    }

    if (typeof definition.icon.path !== 'string' || definition.icon.path.trim().length === 0) {
      errors.push(`Invalid icon.path for ability "${definition.id}"`);
    }

    if (!Number.isFinite(definition.icon.width) || definition.icon.width <= 0) {
      errors.push(`Invalid icon.width for ability "${definition.id}": ${definition.icon.width}`);
    }

    if (!Number.isFinite(definition.icon.height) || definition.icon.height <= 0) {
      errors.push(
        `Invalid icon.height for ability "${definition.id}": ${definition.icon.height}`
      );
    }

    const plugin = registry.getAbility(definition.id);
    if (!plugin) {
      errors.push(`Ability plugin not registered for id "${definition.id}"`);
      continue;
    }

    if (plugin.id !== definition.id) {
      errors.push(
        `Registered ability id mismatch: expected "${definition.id}", got "${plugin.id}"`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`[AbilityConfigSyncValidator] ${errors.join(' | ')}`);
  }
}
