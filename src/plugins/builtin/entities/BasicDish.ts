import type Phaser from 'phaser';
import type { EntityId } from '../../../world/EntityId';
import type { World } from '../../../world';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';
import { DishRenderer } from './DishRenderer';

/**
 * 기본 접시 타입 플러그인.
 * basic, golden, crystal, mini, amber 등 표준 접시 행동을 담당.
 * 정지 + 흔들림, DPS 커서 상호작용, 타임아웃 파괴.
 */
export class BasicDishPlugin implements EntityTypePlugin {
  readonly typeId: string;
  readonly config: EntityTypeConfig;

  constructor(typeId: string, config: Partial<EntityTypeConfig> = {}) {
    this.typeId = typeId;
    this.config = {
      spawnCategory: 'pooled',
      poolSize: config.poolSize ?? 50,
      defaultLifetime: config.defaultLifetime ?? 7000,
      isGatekeeper: false,
      cursorInteraction: 'dps',
    };
  }

  createRenderer(
    _scene: Phaser.Scene,
    _host: Phaser.GameObjects.Container
  ): EntityTypeRenderer {
    return {
      render: () => {},
      destroy: () => {},
    };
  }

  onSpawn(entityId: EntityId, world: World): void {
    const pn = world.phaserNode.get(entityId);
    const dishProps = world.dishProps.get(entityId);
    const health = world.health.get(entityId);
    if (!pn || !dishProps || !health) return;

    DishRenderer.renderDish(pn.graphics, {
      size: dishProps.size,
      baseColor: dishProps.color,
      currentHp: health.currentHp,
      maxHp: health.maxHp,
      isFrozen: false,
      blinkPhase: 0,
    });
  }
}
