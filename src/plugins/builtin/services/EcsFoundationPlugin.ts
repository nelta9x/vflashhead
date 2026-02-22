import Phaser from 'phaser';
import type { ServicePlugin } from '../../types/SystemPlugin';
import type { ServiceEntry } from '../../ServiceRegistry';
import { World } from '../../../world';
import { Entity } from '../../../entities/Entity';
import { EntityPoolManager } from '../../../systems/EntityPoolManager';
import { EntityDamageService } from './EntityDamageService';
import { EntityQueryService } from '../../../systems/EntityQueryService';
import { SpatialIndex } from '../../../systems/SpatialIndex';
import { HealthSystem } from '../../../systems/HealthSystem';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import { AbilityRuntimeQueryService } from './abilities/AbilityRuntimeQueryService';
import { setSpawnDamageServiceGetter } from '../../../entities/EntitySpawnInitializer';
import {
  ABILITY_IDS,
  BERSERKER_EFFECT_KEYS,
  GLASS_CANNON_EFFECT_KEYS,
  VOLATILITY_EFFECT_KEYS,
} from './upgrades/AbilityEffectCatalog';
import { computeGlobalDamageMultiplier } from './upgrades/CurseEffectMath';
import { GAME_WIDTH, GAME_HEIGHT } from '../../../data/constants';

export class EcsFoundationPlugin implements ServicePlugin {
  readonly id = 'core:ecs';
  readonly services: ServiceEntry[] = [
    World,
    {
      key: EntityPoolManager,
      factory: (r) => {
        const scene = r.get(Phaser.Scene);
        const epm = new EntityPoolManager();
        epm.registerPool('dish', () => new Entity(scene), 10, 50);
        epm.registerPool('boss', () => new Entity(scene), 2, 5);
        epm.registerPool('fallingBomb', () => new Entity(scene, { physics: false }), 3, 10);
        epm.registerPool('healthPack', () => new Entity(scene, { physics: false }), 2, 5);
        return epm;
      },
    },
    {
      key: EntityDamageService,
      factory: (r) => {
        const world = r.get(World);
        const svc = new EntityDamageService(
          world,
          r.get(StatusEffectManager),
          (id) => {
            const n = world.phaserNode.get(id);
            return n ? (n.container as Entity) : undefined;
          },
          r.get(Phaser.Scene),
        );
        setSpawnDamageServiceGetter(() => svc);
        svc.setCurseModifiersProvider(() => {
          const query = r.get(AbilityRuntimeQueryService);
          const hs = r.get(HealthSystem);
          return {
            globalDamageMultiplier: computeGlobalDamageMultiplier({
              currentHp: hs.getHp(),
              maxHp: hs.getMaxHp(),
              glassCannonDamageMultiplier: query.getEffectValueOrThrow(
                ABILITY_IDS.GLASS_CANNON,
                GLASS_CANNON_EFFECT_KEYS.DAMAGE_MULTIPLIER,
              ),
              berserkerMissingHpDamagePercent: query.getEffectValueOrThrow(
                ABILITY_IDS.BERSERKER,
                BERSERKER_EFFECT_KEYS.MISSING_HP_DAMAGE_PERCENT,
              ),
            }),
            volatilityCritMultiplier: query.getEffectValueOrThrow(
              ABILITY_IDS.VOLATILITY,
              VOLATILITY_EFFECT_KEYS.CRIT_MULTIPLIER,
            ),
            volatilityNonCritPenalty: query.getEffectValueOrThrow(
              ABILITY_IDS.VOLATILITY,
              VOLATILITY_EFFECT_KEYS.NON_CRIT_PENALTY,
            ),
          };
        });
        return svc;
      },
    },
    {
      key: EntityQueryService,
      factory: (r) => {
        return new EntityQueryService(r.get(EntityPoolManager).getPool('dish')!);
      },
    },
    {
      key: SpatialIndex,
      factory: () => new SpatialIndex(GAME_WIDTH, GAME_HEIGHT),
    },
  ];
}
