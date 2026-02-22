import type { EntitySystem } from './EntitySystem';
import type { World } from '../../world';
import { Data } from '../../data/DataManager';

export class EntityVisualSystem implements EntitySystem {
  readonly id = 'core:entity_visual';
  enabled = true;

  constructor(private readonly world: World) {}

  tick(delta: number): void {
    this.world.visualState.forEach((entityId, vs) => {
      if (this.world.playerInput.has(entityId)) return;
      if (!this.world.isActive(entityId)) return;

      // Hit flash decay
      if (vs.hitFlashPhase > 0) {
        vs.hitFlashPhase -= delta / 100;
        if (vs.hitFlashPhase < 0) vs.hitFlashPhase = 0;
      }

      // Lifetime blink
      const lifetime = this.world.lifetime.get(entityId);
      if (lifetime && lifetime.lifetime !== null) {
        const timeRatio = Math.max(0, 1 - lifetime.elapsedTime / lifetime.lifetime);
        if (timeRatio < 0.3) {
          vs.blinkPhase += 0.3;
          const transform = this.world.transform.get(entityId);
          if (transform) {
            transform.alpha = 0.5 + Math.sin(vs.blinkPhase) * 0.5;
          }
        }
      }

      // Boss vibration
      const identity = this.world.identity.get(entityId);
      if (identity?.isGatekeeper) {
        const health = this.world.health.get(entityId);
        if (health && health.maxHp > 0) {
          const dangerLevel = 1 - health.currentHp / health.maxHp;
          const bossFeedback = Data.boss.feedback;
          if (dangerLevel > bossFeedback.vibrationThreshold) {
            const intensity = bossFeedback.vibrationIntensity * dangerLevel;
            const transform = this.world.transform.get(entityId);
            if (transform) {
              transform.x += (Math.random() - 0.5) * intensity;
              transform.y += (Math.random() - 0.5) * intensity;
            }
          }
        }
      }
    });
  }
}
