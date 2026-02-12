import Phaser from 'phaser';
import type { ServicePlugin } from '../../types/SystemPlugin';
import type { ServiceEntry } from '../../ServiceRegistry';
import { World } from '../../../world';
import { Entity } from '../../../entities/Entity';
import { EntityPoolManager } from '../../../systems/EntityPoolManager';
import { EntityDamageService } from '../../../systems/EntityDamageService';
import { EntityQueryService } from '../../../systems/EntityQueryService';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import { setSpawnDamageServiceGetter } from '../../../entities/EntitySpawnInitializer';

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
        return svc;
      },
    },
    {
      key: EntityQueryService,
      factory: (r) => {
        return new EntityQueryService(r.get(EntityPoolManager).getPool('dish')!);
      },
    },
  ];
}
