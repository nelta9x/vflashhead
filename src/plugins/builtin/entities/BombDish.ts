import type Phaser from 'phaser';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';

/**
 * 폭탄 접시 타입 플러그인.
 * 커서 접촉 시 즉시 폭발 (explode 상호작용).
 */
export class BombDishPlugin implements EntityTypePlugin {
  readonly typeId = 'bomb';
  readonly config: EntityTypeConfig = {
    spawnCategory: 'pooled',
    poolSize: 10,
    defaultLifetime: 2800,
    isGatekeeper: false,
    cursorInteraction: 'explode',
  };

  createRenderer(
    _scene: Phaser.Scene,
    _host: Phaser.GameObjects.Container
  ): EntityTypeRenderer {
    return {
      render: () => {
        // Entity.update()에서 직접 DishRenderer.renderDangerDish() 호출
      },
      destroy: () => {},
    };
  }

}
