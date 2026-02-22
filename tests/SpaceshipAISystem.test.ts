import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
    },
  },
}));

// Mock EventBus - use real instance for emit verification
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

interface MockTransform { x: number; y: number }
interface MockIdentity { entityType: string }
interface MockMovement { homeX: number; homeY: number; drift: { bounds: { minX: number; maxX: number; minY: number; maxY: number } } | null }

interface AddEntityOpts {
  mov?: MockMovement;
  hasDishTag?: boolean;
  size?: number;
}

const defaultBounds = { minX: 0, maxX: 1280, minY: 0, maxY: 720 };

function shipMov(homeX: number, homeY: number, bounds = defaultBounds): AddEntityOpts {
  return { mov: { homeX, homeY, drift: { bounds } }, hasDishTag: true, size: SHIP_SIZE };
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
    transform: {
      get: (id: string) => transforms.get(id),
    },
    movement: {
      get: (id: string) => movements.get(id),
    },
    dishProps: {
      get: (id: string) => dishPropsStore.get(id),
    },
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
    transforms.set(id, { x, y });
    if (opts.mov) movements.set(id, opts.mov);
    if (opts.hasDishTag) dishTags.add(id);
    if (opts.size !== undefined) dishPropsStore.set(id, { size: opts.size });
  };

  const removeEntity = (id: string) => {
    activeSet.delete(id);
  };

  return { world, addEntity, removeEntity, activeSet };
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

    system = new SpaceshipAISystem(
      env.world as never,
      mockDamageService as never,
    );

    fireListener = vi.fn();
    EventBus.getInstance().on(GameEvents.SPACESHIP_FIRE_PROJECTILE, fireListener);

    env.addEntity('player', 'player', 640, 360);
  });

  afterEach(() => {
    system.destroy();
    EventBus.resetInstance();
  });

  it('should clean stale spaceship states when spaceship becomes inactive', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 200, 200, dishOpts());

    env.world.context.gameTime = 0;
    system.tick(16);

    env.removeEntity('ship1');

    env.world.context.gameTime = 100;
    system.tick(16);

    system.clear();
  });

  it('should chase nearest dish by moving homeX/homeY toward it', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('dish1', 'basic', 300, 100, dishOpts());

    env.world.context.gameTime = 0;
    system.tick(1000); // 1 second delta

    // homeX should have moved toward 300 (chaseSpeed * 1s = 120)
    expect(opts.mov!.homeX).toBeCloseTo(220, 0);
    expect(opts.mov!.homeY).toBeCloseTo(100, 0);
  });

  it('should exclude other spaceships from chase targets', () => {
    const opts = shipMov(100, 100);
    env.addEntity('ship1', 'spaceship', 100, 100, opts);
    env.addEntity('ship2', 'spaceship', 110, 100, shipMov(110, 100));

    env.world.context.gameTime = 0;
    system.tick(1000);

    expect(opts.mov!.homeX).toBe(100);
    expect(opts.mov!.homeY).toBe(100);
  });

  it('should apply damage when anchor within shipSize + dishSize', () => {
    // anchor dist = 30 < 35 + 30 = 65
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(mockDamageService.applyDamage).toHaveBeenCalledWith('dish1', dishAttack.hitDamage);
  });

  it('should NOT eat when anchor distance exceeds shipSize + dishSize', () => {
    // anchor dist = 70 > 35 + 30 = 65
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 170, 100, dishOpts());

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();
  });

  it('should respect hitInterval cooldown', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    env.world.context.gameTime = 1000;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledTimes(1);

    mockDamageService.applyDamage.mockClear();
    env.world.context.gameTime = 1000 + dishAttack.hitInterval - 1;
    system.tick(16);
    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();

    env.world.context.gameTime = 1000 + dishAttack.hitInterval;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalledTimes(1);
  });

  it('should emit SPACESHIP_FIRE_PROJECTILE when dish is destroyed', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    mockDamageService.applyDamage.mockImplementation(() => {
      env.removeEntity('dish1');
    });

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(fireListener).toHaveBeenCalledTimes(1);
    const payload = fireListener.mock.calls[0][0];
    expect(payload.fromX).toBe(100);
    expect(payload.fromY).toBe(100);
    expect(payload.targetX).toBe(640);
    expect(payload.targetY).toBe(360);
    expect(payload.gameTime).toBe(1000);
  });

  it('should NOT emit fire event when dish survives damage', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(mockDamageService.applyDamage).toHaveBeenCalled();
    expect(fireListener).not.toHaveBeenCalled();
  });

  it('should use anchor distance (not transform) for eat check', () => {
    // Transform far from dish (drift offset), but anchor close
    env.addEntity('ship1', 'spaceship', 500, 100, shipMov(130, 100));
    env.addEntity('dish1', 'basic', 140, 100, dishOpts());
    // anchorDist = 10 < 65 (shipSize+dishSize), transform dist = 360

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(mockDamageService.applyDamage).toHaveBeenCalledWith('dish1', dishAttack.hitDamage);
  });

  it('should NOT eat when anchor is outside collision range even if transform is close', () => {
    env.addEntity('ship1', 'spaceship', 140, 100, shipMov(500, 100));
    env.addEntity('dish1', 'basic', 140, 100, dishOpts());
    // anchorDist = 360 >> 65, transform dist = 0

    env.world.context.gameTime = 1000;
    system.tick(16);

    expect(mockDamageService.applyDamage).not.toHaveBeenCalled();
  });

  it('should clamp homeX/homeY to bounds', () => {
    const bounds = { minX: 60, maxX: 1220, minY: 60, maxY: 500 };
    const opts = shipMov(10, 10, bounds);
    env.addEntity('ship1', 'spaceship', 10, 10, opts);
    env.addEntity('dish1', 'basic', 0, 0, dishOpts());

    env.world.context.gameTime = 0;
    system.tick(1000);

    expect(opts.mov!.homeX).toBeGreaterThanOrEqual(60);
    expect(opts.mov!.homeY).toBeGreaterThanOrEqual(60);
  });

  it('should clear spaceship states on clear()', () => {
    env.addEntity('ship1', 'spaceship', 100, 100, shipMov(100, 100));
    env.addEntity('dish1', 'basic', 130, 100, dishOpts());

    env.world.context.gameTime = 1000;
    system.tick(16);

    system.clear();

    mockDamageService.applyDamage.mockClear();
    env.world.context.gameTime = 1001;
    system.tick(16);
    expect(mockDamageService.applyDamage).toHaveBeenCalled();
  });
});
