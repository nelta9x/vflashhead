import type { EntityTypePlugin } from '../../types';
import { PluginRegistry } from '../../PluginRegistry';
import { BasicDishPlugin } from './BasicDish';
import { BombEntityPlugin } from './BombEntity';
import { GatekeeperSpaceshipPlugin } from './GatekeeperSpaceship';
import { SpaceshipPlugin } from './SpaceshipPlugin';
import { PlayerEntityPlugin } from './PlayerEntity';
import entitiesJson from '../../../../data/entities.json';

function createBasicDish(typeId: string): EntityTypePlugin {
  const data = entitiesJson.types[typeId as keyof typeof entitiesJson.types];
  if (!data || !('lifetime' in data) || typeof data.lifetime !== 'number') {
    throw new Error(`Invalid dish type data for "${typeId}"`);
  }
  return new BasicDishPlugin(typeId, {
    poolSize: data.poolSize ?? 50,
    defaultLifetime: data.lifetime,
  });
}

/** 빌트인 엔티티 타입 팩토리 맵. 새 타입 추가 시 여기에 한 줄 추가. */
const ENTITY_TYPE_FACTORIES: Record<string, () => EntityTypePlugin> = {
  player: () => new PlayerEntityPlugin(),
  basic: () => createBasicDish('basic'),
  golden: () => createBasicDish('golden'),
  crystal: () => createBasicDish('crystal'),
  mini: () => createBasicDish('mini'),
  amber: () => createBasicDish('amber'),
  bomb: () => new BombEntityPlugin(),
  spaceship: () => {
    const d = entitiesJson.types.spaceship;
    const mc = 'movement' in d ? d.movement : undefined;
    return new SpaceshipPlugin(
      mc as {
        type: string;
        drift: { xAmplitude: number; xFrequency: number; yAmplitude: number; yFrequency: number };
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
      },
    );
  },
  gatekeeper_spaceship: () => {
    const d = entitiesJson.types.gatekeeper_spaceship;
    const mc = 'movement' in d ? d.movement : undefined;
    return new GatekeeperSpaceshipPlugin(
      mc as {
        type: string;
        drift: { xAmplitude: number; xFrequency: number; yAmplitude: number; yFrequency: number };
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
      },
    );
  },
};

export { ENTITY_TYPE_FACTORIES };

export function registerBuiltinEntityTypes(ids: readonly string[]): void {
  const registry = PluginRegistry.getInstance();
  for (const id of ids) {
    const factory = ENTITY_TYPE_FACTORIES[id];
    if (!factory) throw new Error(`Unknown builtin entity type: "${id}"`);
    registry.registerEntityType(factory());
  }
}
