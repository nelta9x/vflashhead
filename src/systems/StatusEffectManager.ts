import type { EntityId } from '../world/EntityId';

/**
 * StatusEffectManager: 엔티티에 상태효과(독/화상/버프/실드 등)를 부착·관리하는 시스템.
 * MOD가 커스텀 StatusEffect 구현체를 등록하여 새로운 상태효과를 추가할 수 있다.
 */

export interface StatusEffect {
  /** 고유 인스턴스 ID (같은 type이라도 중복 부착 가능) */
  readonly id: string;
  /** 효과 종류 식별자 (e.g. 'poison', 'burn', 'shield') */
  readonly type: string;
  /** 총 지속시간 (ms). Infinity이면 수동 제거까지 영구 */
  readonly duration: number;
  /** 남은 지속시간 (ms) */
  remaining: number;
  /** 매 tick마다 호출. delta는 ms 단위 */
  onTick?: (entityId: EntityId, delta: number, data: Record<string, unknown>) => void;
  /** 만료 시 호출 (수동 제거 시에는 호출되지 않음) */
  onExpire?: (entityId: EntityId, data: Record<string, unknown>) => void;
  /** MOD가 자유롭게 사용하는 임의 데이터 */
  data: Record<string, unknown>;
}

export class StatusEffectManager {
  private readonly effects = new Map<EntityId, StatusEffect[]>();

  applyEffect(entityId: EntityId, effect: StatusEffect): void {
    let list = this.effects.get(entityId);
    if (!list) {
      list = [];
      this.effects.set(entityId, list);
    }
    list.push(effect);
  }

  removeEffect(entityId: EntityId, effectId: string): void {
    const list = this.effects.get(entityId);
    if (!list) return;

    const idx = list.findIndex((e) => e.id === effectId);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this.effects.delete(entityId);
    }
  }

  tick(delta: number): void {
    for (const [entityId, list] of this.effects) {
      let i = 0;
      while (i < list.length) {
        const effect = list[i];
        effect.remaining -= delta;

        if (effect.remaining <= 0) {
          effect.onExpire?.(entityId, effect.data);
          list.splice(i, 1);
        } else {
          effect.onTick?.(entityId, delta, effect.data);
          i++;
        }
      }

      if (list.length === 0) {
        this.effects.delete(entityId);
      }
    }
  }

  clearEntity(entityId: EntityId): void {
    this.effects.delete(entityId);
  }

  getEffects(entityId: EntityId): readonly StatusEffect[] {
    return this.effects.get(entityId) ?? [];
  }

  getEffectsByType(entityId: EntityId, type: string): readonly StatusEffect[] {
    const list = this.effects.get(entityId);
    if (!list) return [];
    return list.filter((e) => e.type === type);
  }

  getMinEffectData(entityId: EntityId, type: string, key: string, fallback: number): number {
    const list = this.effects.get(entityId);
    if (!list) return fallback;
    let min = fallback;
    let found = false;
    for (const e of list) {
      if (e.type === type) {
        const val = (e.data[key] as number) ?? fallback;
        if (!found || val < min) {
          min = val;
          found = true;
        }
      }
    }
    return min;
  }

  hasEffect(entityId: EntityId, type: string): boolean {
    const list = this.effects.get(entityId);
    if (!list) return false;
    return list.some((e) => e.type === type);
  }

  clear(): void {
    this.effects.clear();
  }
}
