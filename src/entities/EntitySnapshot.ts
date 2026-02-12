import type { EntityId } from '../world/EntityId';
import type { World } from '../world';

/**
 * Entity 상태의 순수 값 스냅샷.
 * 이벤트 페이로드에서 Entity 참조 대신 사용한다.
 */
export interface EntitySnapshot {
  entityId: EntityId;
  x: number;
  y: number;
  entityType: string;
  dangerous: boolean;
  color: number;
  size: number;
  currentHp: number;
  maxHp: number;
  hpRatio: number;
}

export function createEntitySnapshot(world: World, entityId: EntityId): EntitySnapshot {
  const t = world.transform.get(entityId);
  const identity = world.identity.get(entityId);
  const health = world.health.get(entityId);
  const dp = world.dishProps.get(entityId);

  const currentHp = health?.currentHp ?? 0;
  const maxHp = health?.maxHp ?? 1;

  return {
    entityId,
    x: t?.x ?? 0,
    y: t?.y ?? 0,
    entityType: identity?.entityType ?? 'basic',
    dangerous: dp?.dangerous ?? false,
    color: dp?.color ?? 0x00ffff,
    size: dp?.size ?? 30,
    currentHp,
    maxHp,
    hpRatio: maxHp > 0 ? currentHp / maxHp : 1,
  };
}
