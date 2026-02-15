import type { EntitySnapshot } from '../../../entities/EntitySnapshot';

interface DishDamagedPayloadParams {
  snapshot: EntitySnapshot;
  damage: number;
  currentHp: number;
  maxHp: number;
  isFirstHit: boolean;
  byAbility: boolean;
  isCritical?: boolean;
}

interface DishDestroyedPayloadParams {
  snapshot: EntitySnapshot;
  byAbility?: boolean;
}

interface DishMissedPayloadParams {
  snapshot: EntitySnapshot;
}

export class DishEventPayloadFactory {
  public static createDishDamagedPayload(params: DishDamagedPayloadParams) {
    return {
      snapshot: params.snapshot,
      x: params.snapshot.x,
      y: params.snapshot.y,
      type: params.snapshot.entityType,
      damage: params.damage,
      currentHp: params.currentHp,
      maxHp: params.maxHp,
      hpRatio: params.maxHp > 0 ? params.currentHp / params.maxHp : 1,
      isFirstHit: params.isFirstHit,
      isCritical: params.isCritical,
      byAbility: params.byAbility,
    };
  }

  public static createDishDestroyedPayload(params: DishDestroyedPayloadParams) {
    return {
      snapshot: params.snapshot,
      x: params.snapshot.x,
      y: params.snapshot.y,
      type: params.snapshot.entityType,
      byAbility: params.byAbility,
    };
  }

  public static createDishMissedPayload(params: DishMissedPayloadParams) {
    return {
      snapshot: params.snapshot,
      x: params.snapshot.x,
      y: params.snapshot.y,
      type: params.snapshot.entityType,
    };
  }
}
