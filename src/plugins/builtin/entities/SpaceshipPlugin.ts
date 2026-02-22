import Phaser from 'phaser';
import { SpaceshipRenderer } from './SpaceshipRenderer';
import entitiesJson from '../../../../data/entities.json';
import type { EntityId } from '../../../world/EntityId';
import type {
  EntityTypePlugin,
  EntityTypeConfig,
  EntityTypeRenderer,
} from '../../types';
import type { MovementComponent, World } from '../../../world';

interface SpaceshipMovementConfig {
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
  entry?: {
    offsetY: number;
    speed: number;
  };
}

interface EntryState {
  targetHomeY: number;
  originalMinY: number;
}

const spaceshipData = entitiesJson.types.spaceship;
const visualConfig = spaceshipData.visual;

const parsedCoreColor = Phaser.Display.Color.HexStringToColor(visualConfig.core.color).color;
const parsedArmorBodyColor = Phaser.Display.Color.HexStringToColor(visualConfig.armor.bodyColor).color;
const parsedArmorBorderColor = Phaser.Display.Color.HexStringToColor(visualConfig.armor.borderColor).color;
const parsedDepletedBodyColor = Phaser.Display.Color.HexStringToColor(visualConfig.armor.depletedBodyColor).color;
const parsedDepletedBorderColor = Phaser.Display.Color.HexStringToColor(visualConfig.armor.depletedBorderColor).color;

const coreConfig = {
  radius: visualConfig.core.radius,
  color: parsedCoreColor,
  initialAlpha: visualConfig.core.initialAlpha,
  pulseSpeed: visualConfig.core.pulseSpeed,
  pulseIntensity: visualConfig.core.pulseIntensity,
  lightRadiusRatio: visualConfig.core.lightRadiusRatio,
  glowLevels: visualConfig.core.glowLevels,
} as const;

const armorConfig = {
  pieces: visualConfig.armor.pieces,
  radius: visualConfig.armor.radius,
  innerRadius: visualConfig.armor.innerRadius,
  rotationSpeed: visualConfig.armor.rotationSpeed,
  gap: visualConfig.armor.gap,
  bodyColor: parsedArmorBodyColor,
  bodyAlpha: visualConfig.armor.bodyAlpha,
  borderColor: parsedArmorBorderColor,
  depletedBodyColor: parsedDepletedBodyColor,
  depletedBodyAlpha: visualConfig.armor.depletedBodyAlpha,
  depletedBorderColor: parsedDepletedBorderColor,
  depletedBorderAlpha: visualConfig.armor.depletedBorderAlpha,
} as const;

export class SpaceshipPlugin implements EntityTypePlugin {
  readonly typeId = 'spaceship';
  readonly config: EntityTypeConfig = {
    spawnCategory: 'pooled',
    poolSize: spaceshipData.poolSize,
    defaultLifetime: spaceshipData.lifetime,
    isGatekeeper: false,
    cursorInteraction: 'dps',
  };

  private readonly movementConfig: SpaceshipMovementConfig | null;
  private readonly entryState = new Map<EntityId, EntryState>();

  constructor(movementConfig?: SpaceshipMovementConfig) {
    this.movementConfig = movementConfig ?? null;
  }

  createRenderer(
    _scene: Phaser.Scene,
    _host: Phaser.GameObjects.Container,
  ): EntityTypeRenderer {
    return {
      render: () => {},
      destroy: () => {},
    };
  }

  onSpawn(entityId: EntityId, world: World): void {
    const pn = world.phaserNode.get(entityId);
    const health = world.health.get(entityId);
    if (!pn || !health) return;

    SpaceshipRenderer.render(pn.graphics, {
      currentHp: health.currentHp,
      maxHp: health.maxHp,
      hitFlashPhase: 0,
      timeElapsed: 0,
      core: coreConfig,
      armor: armorConfig,
    });
  }

  onUpdate(entityId: EntityId, world: World, delta: number, gameTime: number): void {
    const pn = world.phaserNode.get(entityId);
    const health = world.health.get(entityId);
    const visualState = world.visualState.get(entityId);
    if (!pn || !health) return;

    const entry = this.entryState.get(entityId);
    if (entry) {
      const mov = world.movement.get(entityId);
      if (mov) {
        const speed = this.movementConfig?.entry?.speed ?? 0.15;
        const step = speed * delta;
        if (mov.homeY < entry.targetHomeY - step) {
          mov.homeY += step;
        } else {
          mov.homeY = entry.targetHomeY;
          if (mov.drift) {
            mov.drift.bounds.minY = entry.originalMinY;
          }
          this.entryState.delete(entityId);
        }
      }
    }

    SpaceshipRenderer.render(pn.graphics, {
      currentHp: health.currentHp,
      maxHp: health.maxHp,
      hitFlashPhase: visualState?.hitFlashPhase ?? 0,
      timeElapsed: gameTime,
      core: coreConfig,
      armor: armorConfig,
    });
  }

  onDestroyed(entityId: EntityId, _world: World): void {
    this.entryState.delete(entityId);
  }

  onTimeout(entityId: EntityId, _world: World): void {
    this.entryState.delete(entityId);
  }

  isInEntry(entityId: EntityId): boolean {
    return this.entryState.has(entityId);
  }

  createMovementData(entityId: EntityId, homeX: number, homeY: number): MovementComponent {
    if (!this.movementConfig || this.movementConfig.type !== 'drift') {
      return { type: 'none', homeX, homeY, movementTime: 0, drift: null };
    }

    const d = this.movementConfig.drift;
    const b = this.movementConfig.bounds;
    const entry = this.movementConfig.entry;

    let startHomeY = homeY;
    let boundsMinY = b.minY;

    if (entry) {
      startHomeY = Math.min(0, homeY + entry.offsetY);
      boundsMinY = Math.min(b.minY, startHomeY - d.yAmplitude);
      this.entryState.set(entityId, {
        targetHomeY: homeY,
        originalMinY: b.minY,
      });
    }

    return {
      type: 'drift',
      homeX,
      homeY: startHomeY,
      movementTime: 0,
      drift: {
        xAmplitude: d.xAmplitude,
        xFrequency: d.xFrequency,
        yAmplitude: d.yAmplitude,
        yFrequency: d.yFrequency,
        phaseX: resolvePhase(entityId, 0),
        phaseY: resolvePhase(entityId, 1),
        bounds: { minX: b.minX, maxX: b.maxX, minY: boundsMinY, maxY: b.maxY },
      },
    };
  }
}

function resolvePhase(entityId: EntityId, axis: number): number {
  const hash = Math.imul(entityId, 2654435761) + axis;
  const normalized = ((hash & 0x7fffffff) >>> 0) / 0x7fffffff;
  return normalized * Math.PI * 2;
}
