import type { DishUpgradeOptions } from './EntityTypes';

export interface EntitySpawnConfig {
  entityId: string;
  entityType: string;
  hp: number;
  lifetime: number | null;
  isGatekeeper: boolean;
  spawnAnimation?: { duration: number; ease: string };
  upgradeOptions?: DishUpgradeOptions;
}
