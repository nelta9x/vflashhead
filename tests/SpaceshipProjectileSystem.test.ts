import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
      },
    },
    Display: {
      Color: {
        HexStringToColor: () => ({ color: 0xff4444 }),
      },
    },
  },
}));

// Mock DataManager
vi.mock('../src/data/DataManager', () => ({
  Data: {
    gameConfig: {
      depths: { laser: 1500 },
    },
  },
}));

// Mock constants
vi.mock('../src/data/constants', () => ({
  CURSOR_HITBOX: { BASE_RADIUS: 30 },
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
}));

// Mock EventBus — use real implementation
vi.mock('../src/utils/EventBus', async () => {
  const actual = await vi.importActual('../src/utils/EventBus');
  return actual;
});

import { SpaceshipProjectileSystem } from '../src/plugins/builtin/systems/SpaceshipProjectileSystem';
import { EventBus, GameEvents } from '../src/utils/EventBus';
import type { SpaceshipFireProjectilePayload } from '../src/plugins/builtin/systems/SpaceshipAISystem';
import type { EntityId } from '../src/world/EntityId';
import entitiesJson from '../data/entities.json';

const projConfig = entitiesJson.types.spaceship.projectile;
const chargeDuration = projConfig.charge.duration;

function createMockScene() {
  const graphicsMock = {
    setDepth: vi.fn(),
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    add: { graphics: vi.fn(() => graphicsMock) },
    cameras: { main: { shake: vi.fn() } },
    _graphics: graphicsMock,
  };
}

function createMockWorld(playerX = 640, playerY = 360) {
  const context = { gameTime: 0, playerId: 'player', currentWave: 1 };
  const transforms = new Map<string | number, { x: number; y: number }>();
  transforms.set('player', { x: playerX, y: playerY });
  const dishPropsStore = new Map<string | number, { size: number }>();
  const activeSet = new Set<string | number>(['player']);

  return {
    context,
    transform: { get: (id: string | number) => transforms.get(id) },
    dishProps: { get: (id: string | number) => dishPropsStore.get(id) },
    isActive: (id: string | number) => activeSet.has(id),
    _transforms: transforms,
    _dishProps: dishPropsStore,
    _activeSet: activeSet,
  };
}

function createMockChargeHandle() {
  return {
    update: vi.fn(),
    destroy: vi.fn(),
  };
}

function createMockPlayerAttackRenderer() {
  const handle = createMockChargeHandle();
  return {
    renderer: {
      createChargeVisual: vi.fn(() => handle),
      createMissile: vi.fn(),
      destroyProjectile: vi.fn(),
      spawnMissileTrail: vi.fn(),
      showPreFireCursorGlow: vi.fn(),
      showBombWarning: vi.fn(),
      destroy: vi.fn(),
    },
    handle,
  };
}

const SHIP1: EntityId = 1;
const SHIP2: EntityId = 2;

/** Emit fire event and add spaceship entity to the world. */
function emitFireEvent(
  world: ReturnType<typeof createMockWorld>,
  opts: Partial<SpaceshipFireProjectilePayload> = {},
) {
  const entityId = opts.entityId ?? SHIP1;
  const fromX = opts.fromX ?? 100;
  const fromY = opts.fromY ?? 100;

  // Ensure spaceship exists in world
  world._transforms.set(entityId, { x: fromX, y: fromY });
  world._dishProps.set(entityId, { size: 35 });
  world._activeSet.add(entityId);

  const payload: SpaceshipFireProjectilePayload = {
    entityId,
    fromX,
    fromY,
    targetX: opts.targetX ?? 200,
    targetY: opts.targetY ?? 100,
    gameTime: opts.gameTime ?? world.context.gameTime,
  };
  EventBus.getInstance().emit(GameEvents.SPACESHIP_FIRE_PROJECTILE, payload);
}

/** Advance gameTime and tick(0) to complete charge without moving projectiles. */
function completeCharge(
  system: SpaceshipProjectileSystem,
  world: ReturnType<typeof createMockWorld>,
  startTime: number,
) {
  world.context.gameTime = startTime + chargeDuration;
  system.tick(0);
}

describe('SpaceshipProjectileSystem', () => {
  let system: SpaceshipProjectileSystem;
  let scene: ReturnType<typeof createMockScene>;
  let world: ReturnType<typeof createMockWorld>;
  let mockHealthSystem: { takeDamage: ReturnType<typeof vi.fn> };
  let mockFeedbackSystem: { onHpLost: ReturnType<typeof vi.fn> };
  let mockAbilityQuery: { getEffectValueOrThrow: ReturnType<typeof vi.fn> };
  let mockSoundSystem: { playSpaceshipChargeSound: ReturnType<typeof vi.fn> };
  let mockRendererCtx: ReturnType<typeof createMockPlayerAttackRenderer>;

  beforeEach(() => {
    EventBus.resetInstance();
    scene = createMockScene();
    world = createMockWorld();
    mockHealthSystem = { takeDamage: vi.fn() };
    mockFeedbackSystem = { onHpLost: vi.fn() };
    mockAbilityQuery = { getEffectValueOrThrow: vi.fn().mockReturnValue(0) };
    mockSoundSystem = { playSpaceshipChargeSound: vi.fn() };
    mockRendererCtx = createMockPlayerAttackRenderer();

    system = new SpaceshipProjectileSystem(
      scene as never,
      world as never,
      mockHealthSystem as never,
      mockFeedbackSystem as never,
      mockAbilityQuery as never,
      mockSoundSystem as never,
      mockRendererCtx.renderer as never,
    );
  });

  afterEach(() => {
    system.destroy();
    EventBus.resetInstance();
  });

  // --- Charge phase tests ---

  it('should start charge visual and play sound on fire event', () => {
    world.context.gameTime = 1000;
    emitFireEvent(world, { gameTime: 1000 });

    system.tick(16);

    expect(mockSoundSystem.playSpaceshipChargeSound).toHaveBeenCalledTimes(1);
    expect(mockRendererCtx.renderer.createChargeVisual).toHaveBeenCalledTimes(1);
    expect(mockRendererCtx.handle.update).toHaveBeenCalled();
  });

  it('should update charge progress each tick', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { gameTime: 0 });

    world.context.gameTime = chargeDuration / 2;
    system.tick(16);

    const updateCall = mockRendererCtx.handle.update.mock.calls[0];
    const progress = updateCall[0] as number;
    expect(progress).toBeCloseTo(0.5, 1);
  });

  it('should fire projectile after charge duration completes', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { gameTime: 0 });

    completeCharge(system, world, 0);

    expect(mockRendererCtx.handle.destroy).toHaveBeenCalled();

    // Tick again to move/render the projectile
    scene._graphics.fillCircle.mockClear();
    world.context.gameTime = chargeDuration + 16;
    system.tick(16);

    expect(scene._graphics.fillCircle).toHaveBeenCalled();
  });

  it('should NOT create projectile before charge completes', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { gameTime: 0 });

    world.context.gameTime = chargeDuration / 2;
    system.tick(16);

    expect(scene._graphics.fillCircle).not.toHaveBeenCalled();
  });

  it('should cancel charge if spaceship dies during charging', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { entityId: SHIP1, gameTime: 0 });

    world._activeSet.delete(SHIP1);

    world.context.gameTime = 100;
    system.tick(16);

    expect(mockRendererCtx.handle.destroy).toHaveBeenCalled();

    // Complete charge time — no projectile should exist
    scene._graphics.fillCircle.mockClear();
    world.context.gameTime = chargeDuration + 100;
    system.tick(16);
    expect(scene._graphics.fillCircle).not.toHaveBeenCalled();
  });

  it('should follow spaceship position during charge', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { entityId: SHIP1, fromX: 100, fromY: 100, gameTime: 0 });

    world._transforms.set(SHIP1, { x: 200, y: 200 });

    world.context.gameTime = chargeDuration / 2;
    system.tick(16);

    const updateCall = mockRendererCtx.handle.update.mock.calls[0];
    expect(updateCall[1]).toBe(200);
    expect(updateCall[2]).toBe(200);
  });

  // --- Projectile behavior tests (after charge) ---

  it('should move projectiles by velocity * dt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    world.context.gameTime = 0;
    emitFireEvent(world, { fromX: 100, fromY: 100, targetX: 200, targetY: 100, gameTime: 0 });

    completeCharge(system, world, 0);

    scene._graphics.fillCircle.mockClear();
    world.context.gameTime = chargeDuration + 1000;
    system.tick(1000);

    const fillCalls = scene._graphics.fillCircle.mock.calls;
    expect(fillCalls.length).toBeGreaterThan(0);
    const xPos = fillCalls[0][0] as number;
    expect(xPos).toBeCloseTo(100 + projConfig.speed, 0);

    vi.restoreAllMocks();
  });

  it('should remove projectiles that exceed lifetime', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { fromX: 640, fromY: 360, targetX: 641, targetY: 360, gameTime: 0 });

    completeCharge(system, world, 0);

    scene._graphics.fillCircle.mockClear();
    world.context.gameTime = chargeDuration + projConfig.lifetime + 1;
    system.tick(16);

    expect(scene._graphics.fillCircle).not.toHaveBeenCalled();
  });

  it('should remove projectiles that go offscreen', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    world.context.gameTime = 0;
    emitFireEvent(world, { fromX: 1280, fromY: 360, targetX: 1400, targetY: 360, gameTime: 0 });

    completeCharge(system, world, 0);

    scene._graphics.fillCircle.mockClear();
    world.context.gameTime = chargeDuration + 1000;
    system.tick(1000);

    expect(scene._graphics.fillCircle).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('should deal damage on cursor collision', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    world.context.gameTime = 0;
    emitFireEvent(world, { fromX: 640, fromY: 360, targetX: 641, targetY: 360, gameTime: 0 });

    completeCharge(system, world, 0);

    world.context.gameTime = chargeDuration + 10;
    system.tick(10);

    expect(mockHealthSystem.takeDamage).toHaveBeenCalledWith(projConfig.damage);
    expect(mockFeedbackSystem.onHpLost).toHaveBeenCalled();
    expect(scene.cameras.main.shake).toHaveBeenCalledWith(200, 0.008);

    vi.restoreAllMocks();
  });

  it('should respect invincibility cooldown after hit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // Emit two projectiles at the same time from different ships
    world.context.gameTime = 0;
    emitFireEvent(world, { entityId: SHIP1, fromX: 640, fromY: 360, targetX: 641, targetY: 360, gameTime: 0 });

    const handle2 = createMockChargeHandle();
    mockRendererCtx.renderer.createChargeVisual.mockReturnValueOnce(handle2);
    emitFireEvent(world, { entityId: SHIP2, fromX: 640, fromY: 360, targetX: 641, targetY: 360, gameTime: 0 });

    // Both charges complete at the same time
    completeCharge(system, world, 0);

    // First collision: one projectile hits
    world.context.gameTime = chargeDuration + 1;
    system.tick(0);
    expect(mockHealthSystem.takeDamage).toHaveBeenCalledTimes(1);

    // Second projectile still exists but invincibility blocks it
    mockHealthSystem.takeDamage.mockClear();
    world.context.gameTime = chargeDuration + 2;
    system.tick(0);
    expect(mockHealthSystem.takeDamage).not.toHaveBeenCalled();

    // After invincibility expires — second projectile hits
    world.context.gameTime = chargeDuration + 1 + projConfig.invincibilityDuration;
    system.tick(0);
    expect(mockHealthSystem.takeDamage).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it('should clear projectiles, charges, and reset state on clear()', () => {
    world.context.gameTime = 0;
    emitFireEvent(world, { gameTime: 0 });

    system.clear();

    expect(mockRendererCtx.handle.destroy).toHaveBeenCalled();

    world.context.gameTime = chargeDuration + 10;
    scene._graphics.fillCircle.mockClear();
    system.tick(10);
    expect(scene._graphics.fillCircle).not.toHaveBeenCalled();
  });

  it('should unsubscribe from EventBus and destroy graphics on destroy()', () => {
    system.destroy();

    EventBus.getInstance().emit(GameEvents.SPACESHIP_FIRE_PROJECTILE, {
      entityId: SHIP1,
      fromX: 100, fromY: 100, targetX: 200, targetY: 100, gameTime: 0,
    });

    expect(scene._graphics.destroy).toHaveBeenCalled();

    // Re-create system for afterEach cleanup
    const freshRendererCtx = createMockPlayerAttackRenderer();
    system = new SpaceshipProjectileSystem(
      scene as never,
      world as never,
      mockHealthSystem as never,
      mockFeedbackSystem as never,
      mockAbilityQuery as never,
      mockSoundSystem as never,
      freshRendererCtx.renderer as never,
    );
  });

  it('should apply aimVariance to projectile direction', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);

    world.context.gameTime = 0;
    emitFireEvent(world, { fromX: 0, fromY: 0, targetX: 100, targetY: 0, gameTime: 0 });

    completeCharge(system, world, 0);

    const varianceRad = (projConfig.aimVarianceDeg * Math.PI) / 180;
    const expectedAngle = 0 + varianceRad;

    scene._graphics.fillCircle.mockClear();
    world.context.gameTime = chargeDuration + 1000;
    system.tick(1000);

    const fillCalls = scene._graphics.fillCircle.mock.calls;
    expect(fillCalls.length).toBeGreaterThan(0);
    const xPos = fillCalls[0][0] as number;
    const yPos = fillCalls[0][1] as number;

    expect(xPos).toBeCloseTo(Math.cos(expectedAngle) * projConfig.speed, 0);
    expect(yPos).toBeCloseTo(Math.sin(expectedAngle) * projConfig.speed, 0);

    vi.restoreAllMocks();
  });
});
