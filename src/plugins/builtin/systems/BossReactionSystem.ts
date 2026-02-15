import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { COLORS } from '../../../data/constants';
import { BossRenderer } from '../entities/BossRenderer';
import { resolveBossHpSegmentState } from '../entities/bossHpSegments';
import type { IBossRenderer } from '../../types';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World, BossStateComponent } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { FeedbackSystem } from '../services/FeedbackSystem';

interface BossReactionSystemDeps {
  world: World;
  scene: Phaser.Scene;
  feedbackSystem: FeedbackSystem;
}

/**
 * BossReactionSystem: 보스 피격 반응 / 사망 애니메이션 / 아머 세그먼트.
 * BossStateComponent의 플래그를 읽고 Phaser tween을 생성한다.
 */
export class BossReactionSystem implements EntitySystem {
  readonly id = 'core:boss_reaction';
  enabled = true;

  private readonly world: World;
  private readonly scene: Phaser.Scene;
  private readonly feedbackSystem: FeedbackSystem;

  constructor(deps: BossReactionSystemDeps) {
    this.world = deps.world;
    this.scene = deps.scene;
    this.feedbackSystem = deps.feedbackSystem;
  }

  tick(_delta: number): void {
    this.world.bossState.forEach((entityId, bs) => {
      if (!this.world.isActive(entityId)) return;

      // Refresh armor segments every frame (HP 비율 기반)
      const health = this.world.health.get(entityId);
      if (health) {
        this.refreshArmorSegments(entityId, bs, health.currentHp, health.maxHp);
      }

      // Pending damage reaction → tween 생성
      if (bs.pendingDamageReaction) {
        bs.pendingDamageReaction = false;
        this.createDamageReaction(entityId, bs, bs.damageSourceX, bs.damageSourceY);
      }

      // Pending death animation → tween 생성
      if (bs.pendingDeathAnimation && !bs.deathAnimationPlaying) {
        bs.pendingDeathAnimation = false;
        bs.deathAnimationPlaying = true;
        this.createDeathAnimation(entityId, bs);
      }
    });
  }

  private refreshArmorSegments(
    entityId: EntityId,
    bs: BossStateComponent,
    currentHp: number,
    maxHp: number,
  ): void {
    const segmentState = resolveBossHpSegmentState(currentHp, maxHp, {
      defaultPieces: bs.defaultArmorPieces,
      hpScale: Data.boss.visual.armor.hpSegments,
    });

    const oldFilledCount = bs.filledHpSlotCount;
    const newPieceCount = segmentState.pieceCount;
    const newFilledPieces = segmentState.filledPieces;
    bs.armorPieceCount = Math.max(1, newPieceCount);
    bs.currentArmorCount = Phaser.Math.Clamp(newFilledPieces, 0, bs.armorPieceCount);
    bs.filledHpSlotCount = newFilledPieces;

    if (newFilledPieces < oldFilledCount) {
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        const config = Data.boss.visual.armor;
        this.feedbackSystem.onBossArmorBreak(
          node.container.x,
          node.container.y,
          config.innerRadius,
          config.radius,
          BossRenderer.resolveColor(config.bodyColor, COLORS.RED),
        );
      }
    }
  }

  private createDamageReaction(
    entityId: EntityId,
    bs: BossStateComponent,
    sourceX: number,
    sourceY: number,
  ): void {
    const reaction = Data.boss.feedback.hitReaction;
    if (!reaction) return;

    const node = this.world.phaserNode.get(entityId);
    if (!node) return;

    // Hit flash
    const renderer = node.bossRenderer as IBossRenderer | null;
    renderer?.playHitFlash(reaction.flashDuration);

    if (sourceX === 0 && sourceY === 0) return;

    // Stop existing reaction tweens
    this.stopReactionTweens(bs);
    bs.isHitStunned = true;

    const host = node.container;
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, host.x, host.y);
    const pushX = Math.cos(angle) * reaction.pushDistance;
    const pushY = Math.sin(angle) * reaction.pushDistance;
    const hitRotation = (sourceX < host.x ? 1 : -1) * reaction.hitRotation;

    // Push tween (targets bossState data directly)
    bs.reactionTweens.push(
      this.scene.tweens.add({
        targets: bs,
        pushOffsetX: pushX,
        pushOffsetY: pushY,
        duration: reaction.pushDuration,
        ease: reaction.pushEase,
      })
    );

    // Rotation tween (targets container)
    bs.reactionTweens.push(
      this.scene.tweens.add({
        targets: host,
        rotation: hitRotation,
        duration: reaction.pushDuration,
        ease: reaction.pushEase,
      })
    );

    // Shake tween
    bs.reactionTweens.push(
      this.scene.tweens.add({
        targets: bs,
        shakeOffsetX: { from: -reaction.shakeIntensity, to: reaction.shakeIntensity },
        shakeOffsetY: { from: reaction.shakeIntensity, to: -reaction.shakeIntensity },
        duration: reaction.shakeFrequency,
        yoyo: true,
        repeat: Math.floor(reaction.shakeDuration / reaction.shakeFrequency),
        onComplete: () => {
          if (!this.scene) return;
          bs.shakeOffsetX = 0;
          bs.shakeOffsetY = 0;
          // Return tween
          bs.reactionTweens.push(
            this.scene.tweens.add({
              targets: bs,
              pushOffsetX: 0,
              pushOffsetY: 0,
              duration: reaction.returnDuration,
              ease: reaction.returnEase,
              onComplete: () => {
                bs.isHitStunned = false;
              },
            })
          );
          bs.reactionTweens.push(
            this.scene.tweens.add({
              targets: host,
              rotation: 0,
              duration: reaction.returnDuration,
              ease: reaction.returnEase,
            })
          );
        },
      })
    );
  }

  private createDeathAnimation(entityId: EntityId, bs: BossStateComponent): void {
    this.stopAllTweens(bs);
    const deathAnim = Data.boss.feedback.deathAnimation;
    const node = this.world.phaserNode.get(entityId);
    if (!node) return;

    bs.deathTween = this.scene.tweens.add({
      targets: node.container,
      scale: deathAnim.scale,
      alpha: 0,
      duration: deathAnim.duration,
      ease: deathAnim.ease,
      onComplete: () => {
        node.container.setVisible(false);
        bs.deathTween = null;
        bs.deathAnimationPlaying = false;
      },
    });
  }

  private stopReactionTweens(bs: BossStateComponent): void {
    for (const tween of bs.reactionTweens) {
      tween.stop();
      tween.remove();
    }
    bs.reactionTweens = [];
    bs.shakeOffsetX = 0;
    bs.shakeOffsetY = 0;
    bs.pushOffsetX = 0;
    bs.pushOffsetY = 0;
    bs.isHitStunned = false;
  }

  private stopAllTweens(bs: BossStateComponent): void {
    this.stopReactionTweens(bs);
    if (bs.deathTween) {
      bs.deathTween.stop();
      bs.deathTween = null;
    }
  }
}
