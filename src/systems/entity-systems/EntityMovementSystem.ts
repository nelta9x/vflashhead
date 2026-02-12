import Phaser from 'phaser';
import type { EntitySystem } from './EntitySystem';
import type { World } from '../../world';

export class EntityMovementSystem implements EntitySystem {
  readonly id = 'core:entity_movement';
  enabled = true;

  constructor(private readonly world: World) {}

  tick(delta: number): void {
    this.world.movement.forEach((entityId, mov) => {
      if (this.world.playerInput.has(entityId)) return;
      if (!this.world.isActive(entityId)) return;

      const statusCache = this.world.statusCache.get(entityId);
      const isFrozen = statusCache?.isFrozen ?? false;
      const slowFactor = statusCache?.slowFactor ?? 1.0;
      const bs = this.world.bossState.get(entityId);
      const isStunned = bs?.isHitStunned ?? false;
      const transform = this.world.transform.get(entityId);
      if (!transform) return;

      if (mov.type === 'drift' && mov.drift && !isFrozen && !isStunned) {
        // Advance movement time
        mov.movementTime += delta;

        // Sine-wave drift calculation (inlined from DriftMovement)
        const d = mov.drift;
        const baseX = mov.homeX +
          Math.sin(mov.movementTime * d.xFrequency + d.phaseX) * d.xAmplitude;
        const baseY = mov.homeY +
          Math.sin(mov.movementTime * d.yFrequency + d.phaseY) * d.yAmplitude;

        transform.baseX = Phaser.Math.Clamp(baseX, d.bounds.minX, d.bounds.maxX);
        transform.baseY = Phaser.Math.Clamp(baseY, d.bounds.minY, d.bounds.maxY);

        const shakeX = bs?.shakeOffsetX ?? 0;
        const shakeY = bs?.shakeOffsetY ?? 0;
        const pushX = bs?.pushOffsetX ?? 0;
        const pushY = bs?.pushOffsetY ?? 0;
        transform.x = transform.baseX + shakeX + pushX;
        transform.y = transform.baseY + shakeY + pushY;
      } else if (mov.type === 'none') {
        const visualState = this.world.visualState.get(entityId);
        if (visualState) {
          visualState.wobblePhase += 0.1 * slowFactor;
        }
      }
    });
  }
}
