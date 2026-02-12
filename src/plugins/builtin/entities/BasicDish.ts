import type Phaser from 'phaser';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';

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
    // DishRenderer는 기존 정적 메서드를 래핑
    // Phase 4 통합 시 EntityTypeRenderer 어댑터로 교체됨
    return {
      render: () => {
        // Entity.update()에서 직접 DishRenderer.renderDish() 호출
      },
      destroy: () => {},
    };
  }

}
