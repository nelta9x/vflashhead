import Phaser from 'phaser';
import { resolveBossHpSegmentState } from './bossHpSegments';
import { BossRenderer } from './BossRenderer';
import { Data } from '../../../data/DataManager';
import type { EntityId } from '../../../world/EntityId';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';
import type { MovementComponent, World } from '../../../world';

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
 * 관문 우주선 타입 플러그인.
 * 드리프트 이동, 아머 HP 바, 피격 반응(push/shake/flash), 레이저 공격.
 */
export class GatekeeperSpaceshipPlugin implements EntityTypePlugin {
  readonly typeId = 'gatekeeper_spaceship';
  readonly config: EntityTypeConfig = {
    spawnCategory: 'pooled',
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

  onSpawn(entityId: EntityId, world: World): void {
    const pn = world.phaserNode.get(entityId);
    const bs = world.bossState.get(entityId);
    const health = world.health.get(entityId);
    if (!pn || !bs || !health) return;

    // Segment calculation
    const bossConfig = Data.boss.visual;
    const segmentState = resolveBossHpSegmentState(health.currentHp, health.maxHp, {
      defaultPieces: bs.defaultArmorPieces,
      hpScale: bossConfig.armor.hpSegments,
    });

    bs.armorPieceCount = Math.max(1, segmentState.pieceCount);
    bs.currentArmorCount = Phaser.Math.Clamp(segmentState.filledPieces, 0, bs.armorPieceCount);
    bs.filledHpSlotCount = segmentState.filledPieces;

    // Renderer creation + depth
    pn.container.setDepth(Data.boss.depth);
    const renderer = new BossRenderer(pn.container.scene, pn.container);
    pn.bossRenderer = renderer;

    // Initial render
    renderer.render({
      hpRatio: 1,
      timeElapsed: 0,
      armorPieceCount: bs.armorPieceCount,
      filledArmorPieceCount: bs.currentArmorCount,
    });
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
