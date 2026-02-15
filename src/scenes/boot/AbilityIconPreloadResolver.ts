export function resolveAbilityIconPreloadIds(
  gameConfigAbilityIds: readonly string[],
  upgradeIds: readonly string[],
): string[] {
  const upgradeSet = new Set(upgradeIds);
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const abilityId of gameConfigAbilityIds) {
    if (seen.has(abilityId)) continue;
    seen.add(abilityId);
    if (!upgradeSet.has(abilityId)) continue;
    resolved.push(abilityId);
  }

  return resolved;
}
