import type Phaser from 'phaser';
import type { EntityId } from '../../../world/EntityId';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';
import type { World } from '../../../world';
import { INITIAL_HP } from '../../../data/constants';
import { Data } from '../../../data/DataManager';

/**
 * 플레이어 엔티티 타입 플러그인.
 * 싱글톤 엔티티 — 풀링 없이 단일 인스턴스만 존재.
 * 렌더링은 CursorRenderer + PlayerTickSystem이 담당.
 */
export class PlayerEntityPlugin implements EntityTypePlugin {
  readonly typeId = 'player';
  readonly config: EntityTypeConfig = {
    spawnCategory: 'singleton',
    poolSize: 0,
    defaultLifetime: null,
    isGatekeeper: false,
    cursorInteraction: 'none',
    archetypeId: 'player',
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

  spawn(world: World): EntityId {
    const archetype = world.archetypeRegistry.getRequired('player');
    const entityId = world.spawnFromArchetype(archetype, {
      identity: { entityId: 0, entityType: 'player', isGatekeeper: false },
      transform: { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 },
      health: { currentHp: INITIAL_HP, maxHp: INITIAL_HP, isDead: false },
      statusCache: { isFrozen: false, slowFactor: 1.0, isShielded: false },
      playerInput: {
        targetX: 0, targetY: 0,
        isKeyboardInput: false,
        smoothingConfig: Data.gameConfig.player.input.smoothing,
      },
      playerRender: { gaugeRatio: 0, gameTime: 0 },
    });

    const identity = world.identity.get(entityId);
    if (identity) identity.entityId = entityId;
    world.context.playerId = entityId;

    return entityId;
  }
}
