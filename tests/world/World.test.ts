import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/world/World';

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('createEntity / isActive', () => {
    it('생성된 엔티티는 active 상태여야 함', () => {
      world.createEntity('e1');
      expect(world.isActive('e1')).toBe(true);
    });

    it('생성되지 않은 엔티티는 active가 아니어야 함', () => {
      expect(world.isActive('missing')).toBe(false);
    });
  });

  describe('destroyEntity', () => {
    it('엔티티를 파괴하면 active에서 제거되어야 함', () => {
      world.createEntity('e1');
      world.identity.set('e1', { entityId: 'e1', entityType: 'basic', isGatekeeper: false });
      world.transform.set('e1', { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });

      world.destroyEntity('e1');

      expect(world.isActive('e1')).toBe(false);
      expect(world.identity.has('e1')).toBe(false);
      expect(world.transform.has('e1')).toBe(false);
    });

    it('dead 상태인 엔티티도 파괴할 수 있어야 함', () => {
      world.createEntity('e1');
      world.markDead('e1');
      world.destroyEntity('e1');

      expect(world.isActive('e1')).toBe(false);
      expect(world.isDead('e1')).toBe(false);
    });
  });

  describe('markDead / isDead', () => {
    it('markDead로 dead 표시할 수 있어야 함', () => {
      world.createEntity('e1');
      world.markDead('e1');
      expect(world.isDead('e1')).toBe(true);
      expect(world.isActive('e1')).toBe(true); // still active until flushed
    });

    it('마크되지 않은 엔티티는 dead가 아니어야 함', () => {
      world.createEntity('e1');
      expect(world.isDead('e1')).toBe(false);
    });
  });

  describe('getActiveEntityIds', () => {
    it('모든 active 엔티티 ID를 반환해야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');
      world.createEntity('e3');

      const ids = world.getActiveEntityIds().sort();
      expect(ids).toEqual(['e1', 'e2', 'e3']);
    });

    it('파괴된 엔티티는 제외해야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');
      world.destroyEntity('e1');

      expect(world.getActiveEntityIds()).toEqual(['e2']);
    });
  });

  describe('query', () => {
    it('모든 store에 존재하는 active 엔티티만 반환해야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');
      world.createEntity('e3');

      world.identity.set('e1', { entityId: 'e1', entityType: 'a', isGatekeeper: false });
      world.identity.set('e2', { entityId: 'e2', entityType: 'b', isGatekeeper: false });

      world.health.set('e1', { currentHp: 10, maxHp: 10 });
      world.health.set('e3', { currentHp: 5, maxHp: 5 });

      // only e1 has both identity and health
      const result = world.query(world.identity, world.health);
      expect(result).toEqual(['e1']);
    });

    it('store가 없으면 모든 active 엔티티를 반환해야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');

      const result = world.query().sort();
      expect(result).toEqual(['e1', 'e2']);
    });

    it('비활성 엔티티는 반환하지 않아야 함', () => {
      world.createEntity('e1');
      world.identity.set('e1', { entityId: 'e1', entityType: 'a', isGatekeeper: false });
      world.destroyEntity('e1');

      expect(world.query(world.identity)).toEqual([]);
    });
  });

  describe('flushDead', () => {
    it('dead 엔티티를 정리하고 제거된 ID를 반환해야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');
      world.identity.set('e1', { entityId: 'e1', entityType: 'a', isGatekeeper: false });

      world.markDead('e1');

      const flushed = world.flushDead();
      expect(flushed).toEqual(['e1']);
      expect(world.isActive('e1')).toBe(false);
      expect(world.isDead('e1')).toBe(false);
      expect(world.identity.has('e1')).toBe(false);
    });

    it('dead가 없으면 빈 배열을 반환해야 함', () => {
      world.createEntity('e1');
      expect(world.flushDead()).toEqual([]);
    });

    it('flush 후 active 목록에서 제거되어야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');
      world.markDead('e1');
      world.flushDead();

      expect(world.getActiveEntityIds()).toEqual(['e2']);
    });
  });

  describe('clear', () => {
    it('모든 엔티티와 store 데이터를 제거해야 함', () => {
      world.createEntity('e1');
      world.createEntity('e2');
      world.identity.set('e1', { entityId: 'e1', entityType: 'a', isGatekeeper: false });
      world.health.set('e1', { currentHp: 10, maxHp: 10 });
      world.markDead('e2');

      world.clear();

      expect(world.getActiveEntityIds()).toEqual([]);
      expect(world.isActive('e1')).toBe(false);
      expect(world.isDead('e2')).toBe(false);
      expect(world.identity.size()).toBe(0);
      expect(world.health.size()).toBe(0);
    });
  });

  describe('player stores', () => {
    it('playerInput과 playerRender store를 사용할 수 있어야 함', () => {
      world.createEntity('player');
      world.playerInput.set('player', {
        targetX: 100,
        targetY: 200,
        smoothingConfig: { baseLerp: 0.4, snapThreshold: 175, convergenceThreshold: 0.5, deadZone: 2.5 },
      });
      world.playerRender.set('player', { gaugeRatio: 0.5, gameTime: 1000 });

      expect(world.playerInput.getRequired('player').targetX).toBe(100);
      expect(world.playerRender.getRequired('player').gaugeRatio).toBe(0.5);
    });

    it('destroyEntity로 player store도 정리되어야 함', () => {
      world.createEntity('player');
      world.playerInput.set('player', {
        targetX: 0, targetY: 0,
        smoothingConfig: { baseLerp: 0.4, snapThreshold: 175, convergenceThreshold: 0.5, deadZone: 2.5 },
      });
      world.playerRender.set('player', { gaugeRatio: 0, gameTime: 0 });

      world.destroyEntity('player');

      expect(world.playerInput.has('player')).toBe(false);
      expect(world.playerRender.has('player')).toBe(false);
    });
  });
});
