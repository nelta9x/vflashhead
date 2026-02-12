import type { EntityId } from '../world/EntityId';
import type { DishUpgradeOptions } from './EntityTypes';

export interface EntitySpawnConfig {
  entityId: EntityId;
  entityType: string;
  hp: number;
  lifetime: number | null;
  isGatekeeper: boolean;
  spawnAnimation?: { duration: number; ease: string };
  upgradeOptions?: DishUpgradeOptions;
  /** waves.json boss config ID (e.g. "boss_center"). Spawn-time parameter for event matching. */
  bossDataId?: string;
}
