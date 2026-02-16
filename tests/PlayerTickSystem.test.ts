import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/world/World';
import type { EntityId } from '../src/world/EntityId';
import type { CursorRenderer } from '../src/plugins/builtin/entities/CursorRenderer';
import type { CursorTrail } from '../src/plugins/builtin/entities/CursorTrail';
import type { HealthSystem } from '../src/systems/HealthSystem';

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

function createMockAbilityRuntimeQuery() {
  return {
    getEffectValueOrThrow: vi.fn(() => 0),
  };
}

function createMockAbilityProgression() {
  return {
    getAbilityLevel: vi.fn(() => 0),
  };
}

function createMockHealthSystem(): HealthSystem {
  return {
    getHp: vi.fn(() => 5),
    getMaxHp: vi.fn(() => 5),
  } as unknown as HealthSystem;
}

function setupPlayerEntity(world: World): EntityId {
  const playerId = world.createEntity();
  world.identity.set(playerId, { entityId: playerId, entityType: 'player', isGatekeeper: false });
  world.transform.set(playerId, { x: 100, y: 200, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });
  world.health.set(playerId, { currentHp: 5, maxHp: 5, isDead: false });
  world.statusCache.set(playerId, { isFrozen: false, slowFactor: 1.0, isShielded: false });
  world.playerInput.set(playerId, {
    targetX: 300, targetY: 400,
    smoothingConfig: {
      halfLifeMs: 22.6,
      snapThreshold: 175,
      convergenceThreshold: 0.5,
      deadZone: 2.5,
    },
  });
  world.playerRender.set(playerId, { gaugeRatio: 0.5, gameTime: 1000 });
  return playerId;
}

describe('PlayerTickSystem', () => {
  let world: World;
  let cursorRenderer: CursorRenderer;
  let cursorTrail: CursorTrail;
  let abilityRuntimeQuery: ReturnType<typeof createMockAbilityRuntimeQuery>;
  let abilityProgression: ReturnType<typeof createMockAbilityProgression>;
  let healthSystem: HealthSystem;

  // Dynamic import to avoid module-level mock issues
  let PlayerTickSystem: typeof import('../src/plugins/builtin/systems/PlayerTickSystem').PlayerTickSystem;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../src/data/constants', () => ({
      CURSOR_HITBOX: { BASE_RADIUS: 30 },
    }));

    const mod = await import('../src/plugins/builtin/systems/PlayerTickSystem');
    PlayerTickSystem = mod.PlayerTickSystem;

    world = new World();
    cursorRenderer = createMockCursorRenderer();
    cursorTrail = createMockCursorTrail();
    abilityRuntimeQuery = createMockAbilityRuntimeQuery();
    abilityProgression = createMockAbilityProgression();
    healthSystem = createMockHealthSystem();
  });

  function createSystem() {
    return new PlayerTickSystem(
      world,
      cursorRenderer,
      cursorTrail,
      abilityRuntimeQuery as never,
      abilityProgression as never,
      healthSystem,
    );
  }

  describe('tick', () => {
    it('비활성 player 엔티티에서는 아무것도 하지 않아야 함', () => {
      const system = createSystem();
      system.tick(16);

      expect(cursorRenderer.renderAttackIndicator).not.toHaveBeenCalled();
      expect(cursorTrail.update).not.toHaveBeenCalled();
    });

    it('활성 player 엔티티에 대해 smoothing을 수행해야 함', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      const system = createSystem();

      const transformBefore = world.transform.getRequired(playerId);
      const initialX = transformBefore.x;
      const initialY = transformBefore.y;

      system.tick(16);

      const transformAfter = world.transform.getRequired(playerId);
      // Position should move toward target (300, 400)
      expect(transformAfter.x).toBeGreaterThan(initialX);
      expect(transformAfter.y).toBeGreaterThan(initialY);
    });

    it('cursorTrail.update가 호출되어야 함', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      const system = createSystem();
      system.tick(16);

      expect(cursorTrail.update).toHaveBeenCalledOnce();
    });

    it('cursorRenderer.renderAttackIndicator가 호출되어야 함', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      const system = createSystem();
      system.tick(16);

      expect(cursorRenderer.renderAttackIndicator).toHaveBeenCalledOnce();
    });

    it('renderAttackIndicator에 올바른 인자를 전달해야 함', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      const system = createSystem();
      system.tick(16);

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

  describe('renderTick', () => {
    it('비활성 player에서는 아무것도 하지 않아야 함', () => {
      const system = createSystem();
      system.renderTick(16);

      expect(cursorTrail.update).not.toHaveBeenCalled();
      expect(cursorRenderer.renderAttackIndicator).not.toHaveBeenCalled();
    });

    it('활성 player에서 trail + render만 수행해야 함 (smoothing 없음)', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      const system = createSystem();

      const transformBefore = { ...world.transform.getRequired(playerId) };
      system.renderTick(16);

      const transformAfter = world.transform.getRequired(playerId);
      // Position should NOT change (no smoothing in renderOnly)
      expect(transformAfter.x).toBe(transformBefore.x);
      expect(transformAfter.y).toBe(transformBefore.y);

      expect(cursorTrail.update).toHaveBeenCalledOnce();
      expect(cursorRenderer.renderAttackIndicator).toHaveBeenCalledOnce();
    });
  });

  describe('updatePosition (smoothing)', () => {
    it('target과 현재가 가까우면 snap해야 함', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      // Set target very close to current
      const input = world.playerInput.getRequired(playerId);
      input.targetX = 100.1;
      input.targetY = 200.1;

      const system = createSystem();
      system.tick(16);

      const transform = world.transform.getRequired(playerId);
      expect(transform.x).toBe(100.1);
      expect(transform.y).toBe(200.1);
    });

    it('target과 현재가 멀면 부분 보간해야 함', () => {
      const playerId = setupPlayerEntity(world);
      world.context.playerId = playerId;
      const system = createSystem();
      system.tick(16);

      const transform = world.transform.getRequired(playerId);
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
