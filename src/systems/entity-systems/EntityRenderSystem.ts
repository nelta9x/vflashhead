import type { EntitySystem } from './EntitySystem';
import type { World } from '../../world';
import { DishRenderer } from '../../effects/DishRenderer';

export class EntityRenderSystem implements EntitySystem {
  readonly id = 'core:entity_render';
  enabled = true;

  constructor(private readonly world: World) {}

  tick(delta: number): void {
    this.world.phaserNode.forEach((entityId, node) => {
      if (this.world.playerInput.has(entityId)) return;
      if (!this.world.isActive(entityId)) return;

      // Skip FallingBomb/HealthPack (rendered by their own systems)
      if (this.world.fallingBomb.has(entityId) || this.world.healthPack.has(entityId)) return;

      // World transform <-> Phaser Container sync
      const transform = this.world.transform.get(entityId);
      if (transform) {
        node.container.x = transform.x;
        node.container.y = transform.y;

        if (node.spawnTween) {
          // spawn tween controls Container -> reverse-sync to World
          transform.alpha = node.container.alpha;
          transform.scaleX = node.container.scaleX;
          transform.scaleY = node.container.scaleY;
        } else {
          // normal: World SSOT -> Container
          node.container.alpha = transform.alpha;
          node.container.scaleX = transform.scaleX;
          node.container.scaleY = transform.scaleY;
        }
      }

      // Drawing: read from World stores
      const identity = this.world.identity.get(entityId);
      const dishProps = this.world.dishProps.get(entityId);
      const health = this.world.health.get(entityId);
      const statusCache = this.world.statusCache.get(entityId);
      const visualState = this.world.visualState.get(entityId);
      const cursorInteraction = this.world.cursorInteraction.get(entityId);
      const bossState = this.world.bossState.get(entityId);
      const lifetime = this.world.lifetime.get(entityId);

      if (identity?.isGatekeeper && bossState && node.bossRenderer) {
        const hpRatio = health && health.maxHp > 0 ? health.currentHp / health.maxHp : 1;
        node.bossRenderer.render({
          hpRatio,
          timeElapsed: lifetime?.movementTime ?? 0,
          armorPieceCount: bossState.armorPieceCount,
          filledArmorPieceCount: bossState.currentArmorCount,
        });
      } else if (dishProps?.dangerous) {
        DishRenderer.renderDangerDish(node.graphics, {
          size: dishProps.size,
          blinkPhase: visualState?.blinkPhase ?? 0,
        });
      } else if (dishProps && health && visualState) {
        DishRenderer.renderDish(node.graphics, {
          size: dishProps.size,
          baseColor: dishProps.color,
          currentHp: health.currentHp,
          maxHp: health.maxHp,
          isHovered: cursorInteraction?.isHovered ?? false,
          isBeingPulled: visualState.isBeingPulled,
          pullPhase: visualState.pullPhase,
          hitFlashPhase: visualState.hitFlashPhase,
          isFrozen: statusCache?.isFrozen ?? false,
          wobblePhase: visualState.wobblePhase,
          blinkPhase: visualState.blinkPhase,
        });
      }

      // plugin.onUpdate (typePlugin stored in PhaserNodeComponent)
      const plugin = node.typePlugin;
      plugin?.onUpdate?.(entityId, this.world, delta, lifetime?.movementTime ?? 0);
    });
  }
}
