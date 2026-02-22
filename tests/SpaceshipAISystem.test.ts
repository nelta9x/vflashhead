import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
    },
  },
}));

vi.mock('../src/utils/EventBus', async () => {
  const actual = await vi.importActual('../src/utils/EventBus');
  return actual;
});

import { SpaceshipAISystem } from '../src/plugins/builtin/systems/SpaceshipAISystem';
import { EventBus, GameEvents } from '../src/utils/EventBus';
import entitiesJson from '../data/entities.json';

const dishAttack = entitiesJson.types.spaceship.dishAttack;
const SHIP_SIZE = 35;
const DISH_SIZE = 30;

interface MockTransform { x: number; y: number; baseX: number; baseY: number }
interface MockIdentity { entityType: string }
interface MockMovement {
  homeX: number; homeY: number; movementTime: number;
  drift: { xAmplitude: number; yAmplitude: number; xFrequency: number; yFrequency: number; phaseX: number; phaseY: number; bounds: { minX: number; maxX: number; minY: number; maxY: number } } | null;
}

interface AddEntityOpts { mov?: MockMovement; hasDishTag?: boolean; size?: number }

const defaultBounds = { minX: 0, maxX: 1280, minY: 0, maxY: 720 };

function shipMov(homeX: number, homeY: number, bounds = defaultBounds): AddEntityOpts {
  return {
    mov: {
      homeX, homeY, movementTime: 0,
      drift: { xAmplitude: 0, yAmplitude: 0, xFrequency: 0, yFrequency: 0, phaseX: 0, phaseY: 0, bounds },
    },
    hasDishTag: true, size: SHIP_SIZE,
  };
}

function dishOpts(size = DISH_SIZE): AddEntityOpts {
  return { hasDishTag: true, size };
}

function createTestWorld() {
  const transforms = new Map<string, MockTransform>();
  const identities = new Map<string, MockIdentity>();
  const movements = new Map<string, MockMovement>();
  const dishPropsStore = new Map<string, { size: number }>();
  const dishTags = new Set<string>();
  const activeSet = new Set<string>();
  const context = { gameTime: 0, playerId: 'player', currentWave: 1 };

  const world = {
    context,
    transform: { get: (id: string) => transforms.get(id) },
    identity: { get: (id: string) => identities.get(id) },
    movement: { get: (id: string) => movements.get(id) },
    dishProps: { get: (id: string) => dishPropsStore.get(id) },
    phaserNode: { get: () => undefined },
    isActive: (id: string) => activeSet.has(id),
    query: vi.fn((...defs: Array<{ name?: string }>) => {
      const firstName = defs[0]?.name;
      if (firstName === 'identity') {
        return (function* () {
          for (const [id, identity] of identities) {
            if (!activeSet.has(id)) continue;
            const t = transforms.get(id);
            if (!t) continue;
            yield [id, identity, t];
          }
        })();
      }
      if (firstName === 'dishTag') {
        return (function* () {
          for (const id of dishTags) {
            if (!activeSet.has(id)) continue;
            const identity = identities.get(id);
            const t = transforms.get(id);
            if (!identity || !t) continue;
            yield [id, {}, identity, t];
          }
        })();
      }
      return (function* () {})();
    }),
  };

  const addEntity = (id: string, type: string, x: number, y: number, opts: AddEntityOpts = {}) => {
    activeSet.add(id);
    identities.set(id, { entityType: type });
    transforms.set(id, { x, y, baseX: x, baseY: y });
    if (opts.mov) movements.set(id, opts.mov);
    if (opts.hasDishTag) dishTags.add(id);
    if (opts.size !== undefined) dishPropsStore.set(id, { size: opts.size });
  };

  const removeEntity = (id: string) => { activeSet.delete(id); };

  const mockSpatialIndex = {
    dishGrid: {
      forEachInRadius: (_cx: number, _cy: number, _r: number, cb: (id: string) => void) => {
        for (const id of dishTags) {
          if (activeSet.has(id)) cb(id);
        }
      },
      forEachEntity: (cb: (id: string) => void) => {
        for (const id of dishTags) {
          if (activeSet.has(id)) cb(id);
        }
      },
    },
    bombGrid: {
      forEachInRadius: vi.fn(),
      forEachEntity: vi.fn(),
    },
    rebuild: vi.fn(),
    clear: vi.fn(),
  };

  return { world, addEntity, removeEntity, activeSet, mockSpatialIndex };
}

describe('SpaceshipAISystem', () => {
  let system: SpaceshipAISystem;
  let mockDamageService: { applyDamage: ReturnType<typeof vi.fn> };
  let env: ReturnType<typeof createTestWorld>;
  let fireListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    EventBus.resetInstance();
    env = createTestWorld();
    mockDamageService = { applyDamage: vi.fn() };
    system = new SpaceshipAISystem(env.world as never, env.mockSpatialIndex as never, mockDamageService as never);
    fireListener = vi.fn();
    EventBus.getInstance().on(GameEvents.SPACESHIP_FIRE_PROJECTILE, fireListener);
    env.addEntity('player', 'player', 640, 360);
  });

  afterEach(() => {
    system.destroy();
    EventBus.resetInstance();
  });

  // --- Stale cleanup ---
  it('should clean stale states when spaceship becomes inactive', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 200, 200, dishOpts());
    system.tick(16);
    env.removeEntity('ship1');
    system.tick(16);
    system.clear();
  });

  // --- CHASING ---
  it('should chase nearest dish by moving homeX/homeY', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('dish1', 'basic', 300, 100, dishOpts());
    system.tick(1000);
    expect(opts.mov!.homeX).toBeCloseTo(220, 0);
  });

  it('should exclude other spaceships from chase targets', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('ship2', 'spaceship', 110, 100, shipMov(110, 100));
    system.tick(1000);
    expect(opts.mov!.homeX).toBe(100);
  });

  it('should switch to closer dish each frame', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('dish1', 'basic', 300, 100, dishOpts());

    system.tick(1000);
    const homeAfterTick1 = opts.mov!.homeX; // moved toward dish1 (300)

    // dish2 spawns much closer
    env.addEntity('dish2', 'basic', 150, 100, dishOpts());

    system.tick(1000);
    // should have moved toward dish2 (150), not continued toward dish1 (300)
    // homeX was ~220 after tick1, dish2 is at 150 → homeX should decrease
    expect(opts.mov!.homeX).toBeLessThan(homeAfterTick1);
  });

  // --- Entry check (transform-based) ---
  it('should enter eating when transform distance ≤ threshold', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledWith('dish1', dishAttack.hitDamage);
  });

  it('should NOT eat when transform distance exceeds threshold', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 170, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();
  });

  // --- EATING ---
  it('should exit eating when transform moves out of range', () => {
    env.addEntity('ship1', 'spaceship', 130, 100, shipMov(130, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledTimes(1);
    mockDamageService.applyDamage.mockClear();

    const t = env.world.transform.get('ship1')!;
    t.x = 500; t.y = 500;
    env.world.context.gameTime = 1000 + dishAttack.hitInterval;
    system.tick(16);
    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();
  });

  it('should apply damage on hitInterval timer', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledTimes(1);

    mockDamageService.applyDamage.mockClear();
    env.world.context.gameTime = 1000 + dishAttack.hitInterval;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledTimes(1);
  });

  it('should respect hitInterval cooldown', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    mockDamageService.applyDamage.mockClear();

    env.world.context.gameTime = 1000 + dishAttack.hitInterval - 1;
    system.tick(16);
    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();
  });

  it('should not switch target while eating', () => {
    env.addEntity('ship1', 'spaceship', 130, 100, shipMov(130, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.addEntity('dish2', 'basic', 300, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledWith('dish1', dishAttack.hitDamage);
    mockDamageService.applyDamage.mockClear();

    const dish2T = env.world.transform.get('dish2')!;
    dish2T.x = 131;
    env.world.context.gameTime = 1000 + dishAttack.hitInterval;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledWith('dish1', dishAttack.hitDamage);
  });

  // --- Fire projectile ---
  it('should emit SPACESHIP_FIRE_PROJECTILE when dish is destroyed', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    mockDamageService.applyDamage.mockImplementation(() => { env.removeEntity('dish1'); });

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(fireListener).toHaveBeenCalledTimes(1);
    const payload = fireListener.mock.calls[0][0];
    expect(payload.entityId).toBe('ship1');
    expect(payload.fromX).toBe(100);
    expect(payload.fromY).toBe(100);
    expect(payload.targetX).toBe(640);
    expect(payload.targetY).toBe(360);
  });

  it('should NOT emit fire event when dish survives', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(fireListener).not.toHaveBeenCalled();
  });

  // --- State transitions ---
  it('should transition to CHASING when target becomes inactive', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.addEntity('dish2', 'basic', 200, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);

    env.removeEntity('dish1');
    const opts = env.world.movement.get('ship1')!;
    const prevHomeX = opts.homeX;
    env.world.context.gameTime = 1001;
    system.tick(1000);
    expect(opts.homeX).toBeGreaterThan(prevHomeX);
  });

  // --- Entry animation skip ---
  it('should skip AI when typePlugin.isInEntry returns true', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    // isInEntry → true: phaserNode에 entry 중인 plugin 설정
    (env.world as Record<string, unknown>).phaserNode = {
      get: (id: string) => id === 'ship1'
        ? { typePlugin: { isInEntry: () => true } }
        : undefined,
    };

    env.world.context.gameTime = 1000;
    system.tick(16);

    // entry 중이므로 chase 안 함, damage도 없음
    expect(opts.mov!.homeX).toBe(100);
    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();
  });

  it('should resume AI after entry completes (isInEntry returns false)', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    // entry 완료: isInEntry → false
    (env.world as Record<string, unknown>).phaserNode = {
      get: (id: string) => id === 'ship1'
        ? { typePlugin: { isInEntry: () => false } }
        : undefined,
    };

    env.world.context.gameTime = 1000;
    system.tick(16);

    // entry 완료 → 정상 chase + damage
    expect(mockDamageService.applyDamage).toHaveBeenCalledWith('dish1', dishAttack.hitDamage);
  });

  // --- Clear ---
  it('should reset state on clear()', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());
    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledTimes(1);

    system.clear();
    mockDamageService.applyDamage.mockClear();
    env.world.context.gameTime = 1001;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalled();
  });
});
