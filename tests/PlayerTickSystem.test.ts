import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/world/World';
import type { StatusEffectManager, StatusEffect } from '../src/systems/StatusEffectManager';
import type { CursorRenderer } from '../src/effects/CursorRenderer';
import type { CursorTrail } from '../src/effects/CursorTrail';
import type { UpgradeSystem } from '../src/systems/UpgradeSystem';
import type { HealthSystem } from '../src/systems/HealthSystem';
import type { Entity } from '../src/entities/Entity';

function createMockSEM(overrides: Partial<StatusEffectManager> = {}): StatusEffectManager {
  return {
    hasEffect: vi.fn(() => false),
    getEffectsByType: vi.fn(() => []),
    applyEffect: vi.fn(),
    removeEffect: vi.fn(),
    tick: vi.fn(),
    clearEntity: vi.fn(),
    getEffects: vi.fn(() => []),
    clear: vi.fn(),
    ...overrides,
  } as unknown as StatusEffectManager;
}

function createMockCursorRenderer(): CursorRenderer {
  return {
    renderAttackIndicator: vi.fn(),
    renderMenuCursor: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
  } as unknown as CursorRenderer;
}

function createMockCursorTrail(): CursorTrail {
  return {
    update: vi.fn(),
    destroy: vi.fn(),
  } as unknown as CursorTrail;
}

function createMockUpgradeSystem(): UpgradeSystem {
  return {
    getCursorSizeBonus: vi.fn(() => 0),
    getMagnetLevel: vi.fn(() => 0),
    getMagnetRadius: vi.fn(() => 0),
    getElectricShockLevel: vi.fn(() => 0),
    update: vi.fn(),
  } as unknown as UpgradeSystem;
}

function createMockHealthSystem(): HealthSystem {
  return {
    getHp: vi.fn(() => 5),
    getMaxHp: vi.fn(() => 5),
  } as unknown as HealthSystem;
}

function setupPlayerEntity(world: World): void {
  world.createEntity('player');
  world.identity.set('player', { entityId: 'player', entityType: 'player', isGatekeeper: false });
  world.transform.set('player', { x: 100, y: 200, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });
  world.health.set('player', { currentHp: 5, maxHp: 5 });
  world.statusCache.set('player', { isFrozen: false, slowFactor: 1.0, isShielded: false });
  world.playerInput.set('player', {
    targetX: 300, targetY: 400,
    smoothingConfig: {
      baseLerp: 0.4,
      snapThreshold: 175,
      convergenceThreshold: 0.5,
      deadZone: 2.5,
    },
  });
  world.playerRender.set('player', { gaugeRatio: 0.5, gameTime: 1000 });
}

describe('PlayerTickSystem', () => {
  let world: World;
  let sem: StatusEffectManager;
  let cursorRenderer: CursorRenderer;
  let cursorTrail: CursorTrail;
  let upgradeSystem: UpgradeSystem;
  let healthSystem: HealthSystem;

  // Dynamic import to avoid module-level mock issues
  let PlayerTickSystem: typeof import('../src/systems/entity-systems/PlayerTickSystem').PlayerTickSystem;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../src/data/constants', () => ({
      CURSOR_HITBOX: { BASE_RADIUS: 30 },
    }));

    const mod = await import('../src/systems/entity-systems/PlayerTickSystem');
    PlayerTickSystem = mod.PlayerTickSystem;

    world = new World();
    sem = createMockSEM();
    cursorRenderer = createMockCursorRenderer();
    cursorTrail = createMockCursorTrail();
    upgradeSystem = createMockUpgradeSystem();
    healthSystem = createMockHealthSystem();
  });

  function createSystem() {
    return new PlayerTickSystem(world, sem, cursorRenderer, cursorTrail, upgradeSystem, healthSystem);
  }

  describe('tick', () => {
    it('비활성 player 엔티티에서는 아무것도 하지 않아야 함', () => {
      const system = createSystem();
      system.tick([] as Entity[], 16);

      expect(cursorRenderer.renderAttackIndicator).not.toHaveBeenCalled();
      expect(cursorTrail.update).not.toHaveBeenCalled();
    });

    it('활성 player 엔티티에 대해 smoothing을 수행해야 함', () => {
      setupPlayerEntity(world);
      const system = createSystem();

      const transformBefore = world.transform.getRequired('player');
      const initialX = transformBefore.x;
      const initialY = transformBefore.y;

      system.tick([] as Entity[], 16);

      const transformAfter = world.transform.getRequired('player');
      // Position should move toward target (300, 400)
      expect(transformAfter.x).toBeGreaterThan(initialX);
      expect(transformAfter.y).toBeGreaterThan(initialY);
    });

    it('cursorTrail.update가 호출되어야 함', () => {
      setupPlayerEntity(world);
      const system = createSystem();
      system.tick([] as Entity[], 16);

      expect(cursorTrail.update).toHaveBeenCalledOnce();
    });

    it('cursorRenderer.renderAttackIndicator가 호출되어야 함', () => {
      setupPlayerEntity(world);
      const system = createSystem();
      system.tick([] as Entity[], 16);

      expect(cursorRenderer.renderAttackIndicator).toHaveBeenCalledOnce();
    });

    it('renderAttackIndicator에 올바른 인자를 전달해야 함', () => {
      setupPlayerEntity(world);
      const system = createSystem();
      system.tick([] as Entity[], 16);

      const call = (cursorRenderer.renderAttackIndicator as ReturnType<typeof vi.fn>).mock.calls[0];
      // x, y are smoothed positions (not exact 100, 200 or 300, 400)
      expect(typeof call[0]).toBe('number');
      expect(typeof call[1]).toBe('number');
      expect(call[2]).toBe(30); // cursorRadius = BASE_RADIUS * (1 + 0)
      expect(call[3]).toBe(0.5); // gaugeRatio
      expect(call[7]).toBe(1000); // gameTime
      expect(call[8]).toBe(5); // currentHp
      expect(call[9]).toBe(5); // maxHp
    });
  });

  describe('syncStatusEffects', () => {
    it('SEM에서 freeze/slow 상태를 statusCache에 반영해야 함', () => {
      setupPlayerEntity(world);
      const frozenSem = createMockSEM({
        hasEffect: vi.fn((_id: string, type: string) => type === 'freeze' || type === 'slow'),
        getEffectsByType: vi.fn((_id: string, type: string) => {
          if (type === 'slow') {
            return [{ id: 'player:slow', type: 'slow', data: { factor: 0.5 }, duration: 1000, remaining: 500 }] as StatusEffect[];
          }
          return [];
        }),
      });

      const system = new PlayerTickSystem(world, frozenSem, cursorRenderer, cursorTrail, upgradeSystem, healthSystem);
      system.tick([] as Entity[], 16);

      const statusCache = world.statusCache.getRequired('player');
      expect(statusCache.isFrozen).toBe(true);
      expect(statusCache.slowFactor).toBe(0.5);
    });

    it('SEM에 효과가 없으면 기본값을 유지해야 함', () => {
      setupPlayerEntity(world);
      const system = createSystem();
      system.tick([] as Entity[], 16);

      const statusCache = world.statusCache.getRequired('player');
      expect(statusCache.isFrozen).toBe(false);
      expect(statusCache.slowFactor).toBe(1.0);
    });
  });

  describe('renderOnly', () => {
    it('비활성 player에서는 아무것도 하지 않아야 함', () => {
      const system = createSystem();
      system.renderOnly(16);

      expect(cursorTrail.update).not.toHaveBeenCalled();
      expect(cursorRenderer.renderAttackIndicator).not.toHaveBeenCalled();
    });

    it('활성 player에서 trail + render만 수행해야 함 (smoothing 없음)', () => {
      setupPlayerEntity(world);
      const system = createSystem();

      const transformBefore = { ...world.transform.getRequired('player') };
      system.renderOnly(16);

      const transformAfter = world.transform.getRequired('player');
      // Position should NOT change (no smoothing in renderOnly)
      expect(transformAfter.x).toBe(transformBefore.x);
      expect(transformAfter.y).toBe(transformBefore.y);

      expect(cursorTrail.update).toHaveBeenCalledOnce();
      expect(cursorRenderer.renderAttackIndicator).toHaveBeenCalledOnce();
    });
  });

  describe('updatePosition (smoothing)', () => {
    it('target과 현재가 가까우면 snap해야 함', () => {
      setupPlayerEntity(world);
      // Set target very close to current
      const input = world.playerInput.getRequired('player');
      input.targetX = 100.1;
      input.targetY = 200.1;

      const system = createSystem();
      system.tick([] as Entity[], 16);

      const transform = world.transform.getRequired('player');
      expect(transform.x).toBe(100.1);
      expect(transform.y).toBe(200.1);
    });

    it('target과 현재가 멀면 부분 보간해야 함', () => {
      setupPlayerEntity(world);
      const system = createSystem();
      system.tick([] as Entity[], 16);

      const transform = world.transform.getRequired('player');
      // Should move toward target but not reach it (unless snap threshold)
      expect(transform.x).toBeGreaterThan(100);
      expect(transform.x).toBeLessThanOrEqual(300);
      expect(transform.y).toBeGreaterThan(200);
      expect(transform.y).toBeLessThanOrEqual(400);
    });
  });

  describe('system interface', () => {
    it('id가 core:player여야 함', () => {
      const system = createSystem();
      expect(system.id).toBe('core:player');
    });

    it('기본적으로 enabled여야 함', () => {
      const system = createSystem();
      expect(system.enabled).toBe(true);
    });

    it('enabled=false이면 tick이 호출되지 않아야 함 (pipeline에서 처리)', () => {
      // PlayerTickSystem 자체는 enabled 체크를 하지 않음 (pipeline이 함)
      const system = createSystem();
      system.enabled = false;
      expect(system.enabled).toBe(false);
    });
  });
});
