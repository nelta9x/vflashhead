import type { Entity } from './Entity';
import type { World } from '../world';
import type { StatusEffectManager } from '../systems/StatusEffectManager';

/**
 * Entity 비활성화 유틸리티.
 * 보스 트윈 정리, 스폰 트윈 정리, World 정리, StatusEffect 정리,
 * Phaser 시각/인터랙티브 정리, Physics body 비활성화를 수행한다.
 */
export function deactivateEntity(
  entity: Entity,
  world: World,
  sem: StatusEffectManager,
): void {
  const entityId = entity.getEntityId();

  // 1. 보스 트윈 정리
  const bs = world.bossState.get(entityId);
  if (bs) {
    for (const tw of bs.reactionTweens) { tw.stop(); tw.remove(); }
    bs.reactionTweens = [];
    if (bs.deathTween) { bs.deathTween.stop(); bs.deathTween = null; }
  }

  // 2. 스폰 트윈 정리
  const pn = world.phaserNode.get(entityId);
  if (pn?.spawnTween) {
    pn.spawnTween.stop();
    pn.spawnTween = null;
  }

  // 3. World entity 파괴
  world.destroyEntity(entityId);

  // 4. StatusEffect 정리
  sem.clearEntity(entityId);

  // 5. Phaser 시각/인터랙티브 정리
  entity.active = false;
  entity.setVisible(false);
  entity.setActive(false);
  entity.disableInteractive();
  entity.removeAllListeners();

  // 6. Physics body 비활성화
  const body = entity.body as Phaser.Physics.Arcade.Body | null;
  if (body) {
    body.enable = false;
    body.setVelocity(0, 0);
  }
}
