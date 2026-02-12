import type Phaser from 'phaser';
import type { EntityId } from '../../../world/EntityId';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';
import type { MovementComponent } from '../../../world';

interface BossMovementConfig {
  type: string;
  drift: {
    xAmplitude: number;
    xFrequency: number;
    yAmplitude: number;
    yFrequency: number;
  };
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * 표준 보스 타입 플러그인.
 * 드리프트 이동, 아머 HP 바, 피격 반응(push/shake/flash), 레이저 공격.
 */
export class StandardBossPlugin implements EntityTypePlugin {
  readonly typeId = 'boss_standard';
  readonly config: EntityTypeConfig = {
    poolSize: 0,
    defaultLifetime: null,
    isGatekeeper: true,
    cursorInteraction: 'contact',
  };

  private readonly movementConfig: BossMovementConfig | null;

  constructor(movementConfig?: BossMovementConfig) {
    this.movementConfig = movementConfig ?? null;
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

  createMovementData(entityId: EntityId, homeX: number, homeY: number): MovementComponent {
    if (!this.movementConfig || this.movementConfig.type !== 'drift') {
      return { type: 'none', homeX, homeY, movementTime: 0, drift: null };
    }

    const d = this.movementConfig.drift;
    const b = this.movementConfig.bounds;
    return {
      type: 'drift',
      homeX,
      homeY,
      movementTime: 0,
      drift: {
        xAmplitude: d.xAmplitude,
        xFrequency: d.xFrequency,
        yAmplitude: d.yAmplitude,
        yFrequency: d.yFrequency,
        phaseX: resolvePhase(entityId, 0),
        phaseY: resolvePhase(entityId, 1),
        bounds: { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY },
      },
    };
  }
}

function resolvePhase(entityId: EntityId, axis: number): number {
  const hash = Math.imul(entityId, 2654435761) + axis;
  const normalized = ((hash & 0x7fffffff) >>> 0) / 0x7fffffff;
  return normalized * Math.PI * 2;
}
