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
 * 폭탄 엔티티 타입 플러그인.
 * 커서 접촉 시 즉시 폭발 (explode 상호작용).
 * 'bomb' 아키타입을 사용하여 접시와 분리된 컴포넌트 구성을 갖는다.
 */
export class BombEntityPlugin implements EntityTypePlugin {
  readonly typeId = 'bomb';
  readonly config: EntityTypeConfig = {
    spawnCategory: 'pooled',
    poolSize: 10,
    defaultLifetime: 2800,
    isGatekeeper: false,
    cursorInteraction: 'explode',
    archetypeId: 'bomb',
  };

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
    const bombProps = world.bombProps.get(entityId);
    if (!pn || !bombProps) return;

    DishRenderer.renderDangerDish(pn.graphics, {
      size: bombProps.size,
      blinkPhase: 0,
    });
  }
}
