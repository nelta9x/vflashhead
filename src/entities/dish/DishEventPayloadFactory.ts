interface DishLike {
  x: number;
  y: number;
}

interface DishDamagedPayloadParams {
  dish: DishLike;
  type: string;
  damage: number;
  currentHp: number;
  maxHp: number;
  isFirstHit: boolean;
  byAbility: boolean;
  isCritical?: boolean;
}

interface DishDestroyedPayloadParams {
  dish: DishLike;
  type: string;
  byAbility?: boolean;
}

interface DishMissedPayloadParams {
  dish: DishLike;
  type: string;
  isDangerous: boolean;
}

export class DishEventPayloadFactory {
  public static createDishDamagedPayload(params: DishDamagedPayloadParams) {
    return {
      dish: params.dish,
      x: params.dish.x,
      y: params.dish.y,
      type: params.type,
      damage: params.damage,
      currentHp: params.currentHp,
      maxHp: params.maxHp,
      hpRatio: params.currentHp / params.maxHp,
      isFirstHit: params.isFirstHit,
      isCritical: params.isCritical,
      byAbility: params.byAbility,
    };
  }

  public static createDishDestroyedPayload(params: DishDestroyedPayloadParams) {
    return {
      dish: params.dish,
      x: params.dish.x,
      y: params.dish.y,
      type: params.type,
      byAbility: params.byAbility,
    };
  }

  public static createDishMissedPayload(params: DishMissedPayloadParams) {
    return {
      dish: params.dish,
      x: params.dish.x,
      y: params.dish.y,
      type: params.type,
      isDangerous: params.isDangerous,
    };
  }
}
