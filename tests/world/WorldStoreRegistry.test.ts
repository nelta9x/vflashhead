import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/world/World';
import { defineComponent } from '../../src/world/ComponentDef';

describe('World Store Registry', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('빌트인 스토어', () => {
    it('18개 빌트인 스토어가 등록되어야 함', () => {
      const names = world.getStoreNames();
      expect(names).toContain('dishTag');
      expect(names).toContain('bossTag');
      expect(names).toContain('identity');
      expect(names).toContain('transform');
      expect(names).toContain('health');
      expect(names).toContain('statusCache');
      expect(names).toContain('lifetime');
      expect(names).toContain('dishProps');
      expect(names).toContain('bombProps');
      expect(names).toContain('cursorInteraction');
      expect(names).toContain('visualState');
      expect(names).toContain('movement');
      expect(names).toContain('phaserNode');
      expect(names).toContain('bossState');
      expect(names).toContain('playerInput');
      expect(names).toContain('playerRender');
      expect(names).toContain('fallingBomb');
      expect(names).toContain('healthPack');
      expect(names).toHaveLength(18);
    });

    it('getStoreByName으로 빌트인 스토어에 접근할 수 있어야 함', () => {
      expect(world.getStoreByName('identity')).toBe(world.identity);
      expect(world.getStoreByName('transform')).toBe(world.transform);
      expect(world.getStoreByName('health')).toBe(world.health);
    });
  });

  describe('register', () => {
    it('새 커스텀 스토어를 등록할 수 있어야 함', () => {
      interface PoisonComponent { dps: number; }
      const C_Poison = defineComponent<PoisonComponent>('mod:poison');

      const store = world.register(C_Poison);
      const e1 = world.createEntity();
      store.set(e1, { dps: 5 });

      expect(world.getStoreByName('mod:poison')?.get(e1)).toEqual({ dps: 5 });
      expect(world.getStoreNames()).toContain('mod:poison');
    });

    it('중복 이름 등록 시 에러를 던져야 함', () => {
      const dup = defineComponent('identity');
      expect(() => world.register(dup)).toThrow('already registered');
    });
  });

  describe('getStoreByName', () => {
    it('이름으로 빌트인 스토어를 조회할 수 있어야 함', () => {
      const store = world.getStoreByName('identity');
      expect(store).toBe(world.identity);
    });

    it('없는 이름이면 undefined 반환', () => {
      expect(world.getStoreByName('missing')).toBeUndefined();
    });
  });

  describe('unregisterStore', () => {
    it('커스텀 스토어를 제거할 수 있어야 함', () => {
      const C_Custom = defineComponent('mod:custom');
      world.register(C_Custom);
      expect(world.getStoreNames()).toContain('mod:custom');

      expect(world.unregisterStore('mod:custom')).toBe(true);
      expect(world.getStoreNames()).not.toContain('mod:custom');
    });

    it('없는 스토어 제거 시 false 반환', () => {
      expect(world.unregisterStore('missing')).toBe(false);
    });
  });

  describe('spawnFromArchetype', () => {
    it('아키타입 기반으로 엔티티를 스폰해야 함', () => {
      const playerArch = world.archetypeRegistry.getRequired('player');

      const p1 = world.spawnFromArchetype(playerArch, {
        identity: { entityId: 0, entityType: 'player', isGatekeeper: false },
        transform: { x: 10, y: 20, baseX: 10, baseY: 20, alpha: 1, scaleX: 1, scaleY: 1 },
        health: { currentHp: 100, maxHp: 100 },
        statusCache: { isFrozen: false, slowFactor: 1.0, isShielded: false },
        playerInput: { targetX: 10, targetY: 20, smoothingConfig: { halfLifeMs: 22.6, snapThreshold: 175, convergenceThreshold: 0.5, deadZone: 2.5 } },
        playerRender: { gaugeRatio: 0, gameTime: 0 },
      });

      expect(world.isActive(p1)).toBe(true);
      expect(world.identity.getRequired(p1).entityType).toBe('player');
      expect(world.transform.getRequired(p1).x).toBe(10);
      expect(world.health.getRequired(p1).currentHp).toBe(100);
      expect(world.playerInput.getRequired(p1).targetX).toBe(10);
      expect(world.playerRender.getRequired(p1).gaugeRatio).toBe(0);
    });

    it('누락된 컴포넌트 값이 있으면 에러를 던져야 함', () => {
      const playerArch = world.archetypeRegistry.getRequired('player');

      expect(() => world.spawnFromArchetype(playerArch, {
        identity: { entityId: 0, entityType: 'player', isGatekeeper: false },
        // missing transform, health, statusCache, playerInput, playerRender
      })).toThrow('missing value');
    });

    it('미등록 스토어 사용 시 에러를 던져야 함', () => {
      const unknownArch = {
        id: 'unknown',
        components: ['notRegistered'],
      };

      expect(() => world.spawnFromArchetype(unknownArch, {
        notRegistered: {},
      })).toThrow('store "notRegistered" not registered');
    });
  });

  describe('archetypeRegistry', () => {
    it('entities.json의 6종 아키타입이 자동 등록되어야 함', () => {
      expect(world.archetypeRegistry.has('player')).toBe(true);
      expect(world.archetypeRegistry.has('dish')).toBe(true);
      expect(world.archetypeRegistry.has('boss')).toBe(true);
      expect(world.archetypeRegistry.has('bomb')).toBe(true);
      expect(world.archetypeRegistry.has('fallingBomb')).toBe(true);
      expect(world.archetypeRegistry.has('healthPack')).toBe(true);
      expect(world.archetypeRegistry.getIds()).toHaveLength(6);
    });
  });

  describe('커스텀 스토어 + removeAllComponents', () => {
    it('destroyEntity가 커스텀 스토어도 정리해야 함', () => {
      const C_Custom = defineComponent<{ val: number }>('mod:custom');
      const customStore = world.register(C_Custom);

      const e1 = world.createEntity();
      customStore.set(e1, { val: 42 });
      world.identity.set(e1, { entityId: e1, entityType: 'test', isGatekeeper: false });

      world.destroyEntity(e1);

      expect(customStore.has(e1)).toBe(false);
      expect(world.identity.has(e1)).toBe(false);
    });
  });

  describe('clear', () => {
    it('커스텀 스토어 포함 전체 정리', () => {
      const C_Custom = defineComponent<{ val: number }>('mod:custom');
      const customStore = world.register(C_Custom);

      const e1 = world.createEntity();
      customStore.set(e1, { val: 1 });
      world.identity.set(e1, { entityId: e1, entityType: 'a', isGatekeeper: false });

      world.clear();

      expect(customStore.size()).toBe(0);
      expect(world.identity.size()).toBe(0);
      expect(world.isActive(e1)).toBe(false);
    });
  });
});
