import type { AbilityDefinition } from '../../data/types';

export interface AbilityIconPreloadResolution {
  readonly definitions: readonly AbilityDefinition[];
  readonly skippedAbilityIds: readonly string[];
}

export function resolveAbilityIconPreloadDefinitions(
  abilityDefinitions: readonly AbilityDefinition[],
  upgradeIds: readonly string[],
): AbilityIconPreloadResolution {
  const upgradeSet = new Set(upgradeIds);
  const seenAbilityIds = new Set<string>();
  const resolved: AbilityDefinition[] = [];
  const skipped: string[] = [];

  for (const definition of abilityDefinitions) {
    if (seenAbilityIds.has(definition.id)) continue;
    seenAbilityIds.add(definition.id);

    if (!upgradeSet.has(definition.upgradeId)) {
      skipped.push(definition.id);
      continue;
    }

    resolved.push(definition);
  }

  return {
    definitions: resolved,
    skippedAbilityIds: skipped,
  };
}
