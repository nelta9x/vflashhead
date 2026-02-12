import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusEffectManager, StatusEffect } from '../src/systems/StatusEffectManager';
import type { EntityId } from '../src/world/EntityId';

function createEffect(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id: overrides.id ?? 'effect-1',
    type: overrides.type ?? 'poison',
    duration: overrides.duration ?? 1000,
    remaining: overrides.remaining ?? overrides.duration ?? 1000,
    data: overrides.data ?? {},
    onTick: overrides.onTick,
    onExpire: overrides.onExpire,
  };
}

const ENTITY_1: EntityId = 1;
const ENTITY_2: EntityId = 2;
const NONEXISTENT: EntityId = 999;

describe('StatusEffectManager', () => {
  let manager: StatusEffectManager;

  beforeEach(() => {
    manager = new StatusEffectManager();
  });

  describe('applyEffect / getEffects', () => {
    it('엔티티에 효과를 부착하고 조회할 수 있어야 함', () => {
      const effect = createEffect();
      manager.applyEffect(ENTITY_1, effect);

      const effects = manager.getEffects(ENTITY_1);
      expect(effects).toHaveLength(1);
      expect(effects[0].id).toBe('effect-1');
    });

    it('같은 엔티티에 여러 효과를 부착할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1', type: 'poison' }));
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e2', type: 'burn' }));

      expect(manager.getEffects(ENTITY_1)).toHaveLength(2);
    });

    it('존재하지 않는 엔티티 조회 시 빈 배열 반환', () => {
      expect(manager.getEffects(NONEXISTENT)).toHaveLength(0);
    });
  });

  describe('removeEffect', () => {
    it('특정 효과를 제거할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1' }));
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e2' }));

      manager.removeEffect(ENTITY_1, 'e1');

      const effects = manager.getEffects(ENTITY_1);
      expect(effects).toHaveLength(1);
      expect(effects[0].id).toBe('e2');
    });

    it('마지막 효과 제거 시 엔티티 항목이 정리되어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1' }));
      manager.removeEffect(ENTITY_1, 'e1');

      expect(manager.getEffects(ENTITY_1)).toHaveLength(0);
    });

    it('존재하지 않는 효과 제거는 무해해야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1' }));
      manager.removeEffect(ENTITY_1, 'nonexistent');

      expect(manager.getEffects(ENTITY_1)).toHaveLength(1);
    });
  });

  describe('tick', () => {
    it('매 틱마다 remaining이 감소해야 함', () => {
      const effect = createEffect({ duration: 1000 });
      manager.applyEffect(ENTITY_1, effect);

      manager.tick(100);

      expect(effect.remaining).toBe(900);
    });

    it('매 틱마다 onTick이 호출되어야 함', () => {
      const onTick = vi.fn();
      const effect = createEffect({ duration: 1000, onTick });
      manager.applyEffect(ENTITY_1, effect);

      manager.tick(100);

      expect(onTick).toHaveBeenCalledWith(ENTITY_1, 100, effect.data);
    });

    it('만료 시 onExpire가 호출되어야 함', () => {
      const onExpire = vi.fn();
      const effect = createEffect({ duration: 500, onExpire });
      manager.applyEffect(ENTITY_1, effect);

      manager.tick(600);

      expect(onExpire).toHaveBeenCalledWith(ENTITY_1, effect.data);
    });

    it('만료된 효과는 자동 제거되어야 함', () => {
      const effect = createEffect({ duration: 500 });
      manager.applyEffect(ENTITY_1, effect);

      manager.tick(600);

      expect(manager.getEffects(ENTITY_1)).toHaveLength(0);
    });

    it('만료된 효과의 onTick은 호출되지 않아야 함', () => {
      const onTick = vi.fn();
      const effect = createEffect({ duration: 100, onTick });
      manager.applyEffect(ENTITY_1, effect);

      manager.tick(200);

      expect(onTick).not.toHaveBeenCalled();
    });

    it('여러 엔티티의 효과가 독립적으로 틱되어야 함', () => {
      const onTick1 = vi.fn();
      const onTick2 = vi.fn();
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1', duration: 1000, onTick: onTick1 }));
      manager.applyEffect(ENTITY_2, createEffect({ id: 'e2', duration: 1000, onTick: onTick2 }));

      manager.tick(100);

      expect(onTick1).toHaveBeenCalledWith(ENTITY_1, 100, {});
      expect(onTick2).toHaveBeenCalledWith(ENTITY_2, 100, {});
    });
  });

  describe('clearEntity', () => {
    it('엔티티의 모든 효과를 제거해야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1' }));
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e2' }));

      manager.clearEntity(ENTITY_1);

      expect(manager.getEffects(ENTITY_1)).toHaveLength(0);
    });

    it('다른 엔티티의 효과에는 영향이 없어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1' }));
      manager.applyEffect(ENTITY_2, createEffect({ id: 'e2' }));

      manager.clearEntity(ENTITY_1);

      expect(manager.getEffects(ENTITY_2)).toHaveLength(1);
    });
  });

  describe('hasEffect / getEffectsByType', () => {
    it('특정 타입 효과 존재 여부를 확인할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ type: 'poison' }));

      expect(manager.hasEffect(ENTITY_1, 'poison')).toBe(true);
      expect(manager.hasEffect(ENTITY_1, 'burn')).toBe(false);
    });

    it('타입별로 효과를 필터링할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1', type: 'poison' }));
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e2', type: 'burn' }));
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e3', type: 'poison' }));

      const poisons = manager.getEffectsByType(ENTITY_1, 'poison');
      expect(poisons).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('모든 엔티티의 모든 효과를 제거해야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({ id: 'e1' }));
      manager.applyEffect(ENTITY_2, createEffect({ id: 'e2' }));

      manager.clear();

      expect(manager.getEffects(ENTITY_1)).toHaveLength(0);
      expect(manager.getEffects(ENTITY_2)).toHaveLength(0);
    });
  });

  describe('freeze/slow 내장 효과', () => {
    it('freeze 효과를 부착하고 hasEffect로 확인할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:freeze`,
        type: 'freeze',
        duration: Infinity,
        remaining: Infinity,
      }));

      expect(manager.hasEffect(ENTITY_1, 'freeze')).toBe(true);
      expect(manager.hasEffect(ENTITY_1, 'slow')).toBe(false);
    });

    it('freeze 효과가 Infinity이면 tick으로 만료되지 않아야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:freeze`,
        type: 'freeze',
        duration: Infinity,
        remaining: Infinity,
      }));

      manager.tick(100000);

      expect(manager.hasEffect(ENTITY_1, 'freeze')).toBe(true);
    });

    it('freeze 효과를 수동 제거할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:freeze`,
        type: 'freeze',
        duration: Infinity,
        remaining: Infinity,
      }));

      manager.removeEffect(ENTITY_1, `${ENTITY_1}:freeze`);

      expect(manager.hasEffect(ENTITY_1, 'freeze')).toBe(false);
    });

    it('slow 효과를 부착하고 factor 데이터를 조회할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:slow`,
        type: 'slow',
        duration: 2000,
        data: { factor: 0.3 },
      }));

      const slowEffects = manager.getEffectsByType(ENTITY_1, 'slow');
      expect(slowEffects).toHaveLength(1);
      expect(slowEffects[0].data['factor']).toBe(0.3);
    });

    it('slow 효과가 duration 후 자동 만료되어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:slow`,
        type: 'slow',
        duration: 500,
        data: { factor: 0.3 },
      }));

      manager.tick(600);

      expect(manager.hasEffect(ENTITY_1, 'slow')).toBe(false);
    });

    it('여러 slow 효과 중 가장 낮은 factor를 구할 수 있어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: 'slow-1',
        type: 'slow',
        duration: 1000,
        data: { factor: 0.5 },
      }));
      manager.applyEffect(ENTITY_1, createEffect({
        id: 'slow-2',
        type: 'slow',
        duration: 1000,
        data: { factor: 0.3 },
      }));

      const slowEffects = manager.getEffectsByType(ENTITY_1, 'slow');
      const minFactor = Math.min(
        ...slowEffects.map((e) => (e.data['factor'] as number) ?? 1.0)
      );
      expect(minFactor).toBe(0.3);
    });

    it('clearEntity로 freeze/slow 모두 제거되어야 함', () => {
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:freeze`,
        type: 'freeze',
        duration: Infinity,
        remaining: Infinity,
      }));
      manager.applyEffect(ENTITY_1, createEffect({
        id: `${ENTITY_1}:slow`,
        type: 'slow',
        duration: 1000,
        data: { factor: 0.3 },
      }));

      manager.clearEntity(ENTITY_1);

      expect(manager.hasEffect(ENTITY_1, 'freeze')).toBe(false);
      expect(manager.hasEffect(ENTITY_1, 'slow')).toBe(false);
    });
  });
});
