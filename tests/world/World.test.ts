import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/world/World';
import { C_Identity, C_Health, C_DishTag, C_BossTag } from '../../src/world/components';

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('createEntity / isActive', () => {
    it('생성된 엔티티는 active 상태여야 함', () => {
      const e1 = world.createEntity();
      expect(world.isActive(e1)).toBe(true);
    });

    it('생성되지 않은 엔티티는 active가 아니어야 함', () => {
      expect(world.isActive(999)).toBe(false);
    });
  });

  describe('destroyEntity', () => {
    it('엔티티를 파괴하면 active에서 제거되어야 함', () => {
      const e1 = world.createEntity();
      world.identity.set(e1, { entityId: e1, entityType: 'basic', isGatekeeper: false });
      world.transform.set(e1, { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });

      world.destroyEntity(e1);

      expect(world.isActive(e1)).toBe(false);
      expect(world.identity.has(e1)).toBe(false);
      expect(world.transform.has(e1)).toBe(false);
    });
  });

  describe('query', () => {
    it('모든 ComponentDef에 존재하는 active 엔티티만 반환해야 함', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.identity.set(e1, { entityId: e1, entityType: 'a', isGatekeeper: false });
      world.identity.set(e2, { entityId: e2, entityType: 'b', isGatekeeper: false });

      world.health.set(e1, { currentHp: 10, maxHp: 10, isDead: false });
      world.health.set(e3, { currentHp: 5, maxHp: 5, isDead: false });

      // only e1 has both identity and health
      const result = [...world.query(C_Identity, C_Health)];
      expect(result.length).toBe(1);
      expect(result[0][0]).toBe(e1);
      expect(result[0][1]).toEqual({ entityId: e1, entityType: 'a', isGatekeeper: false });
      expect(result[0][2]).toEqual({ currentHp: 10, maxHp: 10, isDead: false });
    });

    it('비활성 엔티티는 반환하지 않아야 함', () => {
      const e1 = world.createEntity();
      world.identity.set(e1, { entityId: e1, entityType: 'a', isGatekeeper: false });
      world.destroyEntity(e1);

      const result = [...world.query(C_Identity)];
      expect(result).toEqual([]);
    });

    it('태그 기반 쿼리가 동작해야 함', () => {
      const dish1 = world.createEntity();
      const boss1 = world.createEntity();
      const dish2 = world.createEntity();

      world.dishTag.set(dish1, {} as Record<string, never>);
      world.dishTag.set(dish2, {} as Record<string, never>);
      world.bossTag.set(boss1, {} as Record<string, never>);

      world.health.set(dish1, { currentHp: 10, maxHp: 10, isDead: false });
      world.health.set(boss1, { currentHp: 50, maxHp: 50, isDead: false });
      world.health.set(dish2, { currentHp: 5, maxHp: 5, isDead: false });

      const dishes = [...world.query(C_DishTag, C_Health)];
      expect(dishes.length).toBe(2);
      const dishIds = dishes.map(([id]) => id).sort();
      expect(dishIds).toEqual([dish1, dish2].sort());

      const bosses = [...world.query(C_BossTag, C_Health)];
      expect(bosses.length).toBe(1);
      expect(bosses[0][0]).toBe(boss1);
    });

    it('가장 작은 스토어를 pivot으로 사용해야 함', () => {
      // Health가 더 작은 스토어
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.identity.set(e1, { entityId: e1, entityType: 'a', isGatekeeper: false });
      world.identity.set(e2, { entityId: e2, entityType: 'b', isGatekeeper: false });
      world.identity.set(e3, { entityId: e3, entityType: 'c', isGatekeeper: false });

      world.health.set(e2, { currentHp: 20, maxHp: 20, isDead: false });

      const result = [...world.query(C_Identity, C_Health)];
      expect(result.length).toBe(1);
      expect(result[0][0]).toBe(e2);
    });
  });

  describe('clear', () => {
    it('모든 엔티티와 store 데이터를 제거해야 함', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      world.identity.set(e1, { entityId: e1, entityType: 'a', isGatekeeper: false });
      world.health.set(e1, { currentHp: 10, maxHp: 10, isDead: false });

      world.clear();

      expect(world.isActive(e1)).toBe(false);
      expect(world.isActive(e2)).toBe(false);
      expect(world.identity.size()).toBe(0);
      expect(world.health.size()).toBe(0);
    });
  });

  describe('player stores', () => {
    it('playerInput과 playerRender store를 사용할 수 있어야 함', () => {
      const player = world.createEntity();
      world.playerInput.set(player, {
        targetX: 100,
        targetY: 200,
        isKeyboardInput: false, smoothingConfig: { halfLifeMs: 22.6, keyboardHalfLifeMs: 8, snapThreshold: 175, convergenceThreshold: 0.5, deadZone: 2.5 },
      });
      world.playerRender.set(player, { gaugeRatio: 0.5, gameTime: 1000 });

      expect(world.playerInput.getRequired(player).targetX).toBe(100);
      expect(world.playerRender.getRequired(player).gaugeRatio).toBe(0.5);
    });

    it('destroyEntity로 player store도 정리되어야 함', () => {
      const player = world.createEntity();
      world.playerInput.set(player, {
        targetX: 0, targetY: 0,
        isKeyboardInput: false, smoothingConfig: { halfLifeMs: 22.6, keyboardHalfLifeMs: 8, snapThreshold: 175, convergenceThreshold: 0.5, deadZone: 2.5 },
      });
      world.playerRender.set(player, { gaugeRatio: 0, gameTime: 0 });

      world.destroyEntity(player);

      expect(world.playerInput.has(player)).toBe(false);
      expect(world.playerRender.has(player)).toBe(false);
    });
  });
});
