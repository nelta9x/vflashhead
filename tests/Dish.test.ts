import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EventBus
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
      on: mockOn,
      off: mockOff,
    }),
  },
  GameEvents: {
    DISH_SPAWNED: 'dish_spawned',
    DISH_DESTROYED: 'dish_destroyed',
    DISH_DAMAGED: 'dish_damaged',
    DISH_MISSED: 'dish_missed',
  },
}));

// Mock dishes data
vi.mock('../data/dishes.json', () => ({
  default: {
    dishes: {
      basic: {
        hp: 30,
        points: 100,
        color: '#00ffff',
        chainReaction: false,
        dangerous: false,
        lifetime: 2000,
        size: 30,
      },
      golden: {
        hp: 20,
        points: 400,
        color: '#ffff00',
        chainReaction: false,
        dangerous: false,
        lifetime: 1500,
        size: 35,
      },
      crystal: {
        hp: 40,
        points: 250,
        color: '#ff00ff',
        chainReaction: true,
        dangerous: false,
        lifetime: 1800,
        size: 25,
      },
      bomb: {
        hp: 1,
        points: 0,
        color: '#ff0044',
        chainReaction: false,
        dangerous: true,
        lifetime: 1200,
        size: 40,
      },
      mini: {
        hp: 15,
        points: 50,
        color: '#00ff88',
        chainReaction: false,
        dangerous: false,
        lifetime: 1500,
        size: 20,
      },
    },
    damage: {
      playerDamage: 10,
      damageInterval: 200,
      criticalChance: 0.1,
      criticalMultiplier: 1.5,
    },
  },
}));

// Mock other data files for DataManager
vi.mock('../data/game-config.json', () => ({
  default: {
    screen: { width: 1280, height: 720 },
    player: { initialHp: 5, cursorHitbox: { baseRadius: 30 } },
    upgradeUI: {},
    waveTransition: {},
    magnet: {},
  },
}));
vi.mock('../data/spawn.json', () => ({ default: { area: {}, dynamicSpawn: {} } }));
vi.mock('../data/combo.json', () => ({ default: { timeout: {}, milestones: [], multiplier: {} } }));
vi.mock('../data/health-pack.json', () => ({ default: { spawnChanceByHp: {} } }));
vi.mock('../data/feedback.json', () => ({
  default: {
    comboMilestones: {},
    particles: {},
    damageText: { normal: {}, critical: {}, combo: { colors: {}, thresholds: {} }, animation: {} },
  },
}));
vi.mock('../data/colors.json', () => ({ default: { hex: {}, numeric: {} } }));
vi.mock('../data/waves.json', () => ({ default: { waves: [], duration: 20000 } }));
vi.mock('../data/upgrades.json', () => ({
  default: { timing: {}, rarityWeights: {}, rarityThresholds: {}, weapon: {}, system: [] },
}));
vi.mock('../data/weapons.json', () => ({ default: {} }));

// Mock constants
vi.mock('../src/data/constants', () => ({
  COLORS: {
    CYAN: 0x00ffff,
    MAGENTA: 0xff00ff,
    YELLOW: 0xffff00,
    RED: 0xff0044,
    GREEN: 0x00ff88,
    WHITE: 0xffffff,
  },
  DISH_LIFETIME: {
    basic: 2000,
    golden: 1500,
    crystal: 1800,
    bomb: 1200,
  },
  DISH_DAMAGE: {
    PLAYER_DAMAGE: 10,
    DAMAGE_INTERVAL: 200,
  },
  CURSOR_HITBOX: {
    BASE_RADIUS: 30,
  },
}));

// Mock Phaser with proper Container and body
vi.mock('phaser', () => {
  class MockGraphics {
    clear() {
      return this;
    }
    fillStyle() {
      return this;
    }
    fillCircle() {
      return this;
    }
    fillRect() {
      return this;
    }
    lineStyle() {
      return this;
    }
    strokeCircle() {
      return this;
    }
    strokeRect() {
      return this;
    }
    beginPath() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    closePath() {
      return this;
    }
    fillPath() {
      return this;
    }
    strokePath() {
      return this;
    }
  }

  class MockBody {
    enable = true;
    setCircle() {
      return this;
    }
    setOffset() {
      return this;
    }
    setVelocity() {
      return this;
    }
  }

  class MockContainer {
    x = 0;
    y = 0;
    active = true;
    visible = true;
    alpha = 1;
    scaleX = 1;
    scaleY = 1;
    scene: unknown;
    body: MockBody;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.body = new MockBody();
    }

    setVisible(v: boolean) {
      this.visible = v;
      return this;
    }
    setActive(v: boolean) {
      this.active = v;
      return this;
    }
    setAlpha(a: number) {
      this.alpha = a;
      return this;
    }
    setScale(s: number) {
      this.scaleX = s;
      this.scaleY = s;
      return this;
    }
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
    setInteractive() {
      return this;
    }
    disableInteractive() {
      return this;
    }
    removeAllListeners() {
      return this;
    }
    on() {
      return this;
    }
    add() {
      return this;
    }
  }

  return {
    default: {
      Scene: class {},
      GameObjects: {
        Container: MockContainer,
        Graphics: MockGraphics,
      },
      Physics: {
        Arcade: {
          Body: MockBody,
        },
      },
      Geom: {
        Circle: class MockCircle {
          constructor(
            public x: number,
            public y: number,
            public radius: number
          ) {}
          static Contains() {
            return true;
          }
        },
      },
      Time: {
        TimerEvent: class MockTimerEvent {
          destroy() {}
        },
      },
      Math: {
        Distance: {
          Between: (x1: number, y1: number, x2: number, y2: number) =>
            Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
        },
      },
    },
  };
});

// Create mock scene
function createMockScene() {
  return {
    add: {
      existing: vi.fn(),
      graphics: vi.fn(() => ({
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillCircle: vi.fn(),
        fillRect: vi.fn(),
        lineStyle: vi.fn(),
        strokeCircle: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fillPath: vi.fn(),
        strokePath: vi.fn(),
      })),
    },
    physics: {
      add: {
        existing: vi.fn((obj) => {
          // Set body on the object
          obj.body = {
            enable: true,
            setCircle: vi.fn(),
            setOffset: vi.fn(),
            setVelocity: vi.fn(),
          };
        }),
      },
    },
    time: {
      addEvent: vi.fn(() => ({ destroy: vi.fn() })),
    },
    tweens: {
      add: vi.fn(),
    },
  };
}

describe('Dish Upgrade Effects', () => {
  let mockScene: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    mockScene = createMockScene();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('damageBonus', () => {
    it('should increase damage by damageBonus amount', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      // Spawn with damageBonus
      dish.spawn(100, 100, 'basic', 1, { damageBonus: 5 });

      const initialHp = dish.getCurrentHp();

      // Apply damage with upgrades (base 10 + bonus 5 = 15)
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Not a crit
      dish.applyDamageWithUpgrades(10, 5, 0);

      expect(dish.getCurrentHp()).toBe(initialHp - 15);
    });

    it('should use base damage when no bonus provided', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      dish.spawn(100, 100, 'basic', 1);

      const initialHp = dish.getCurrentHp();
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Not a crit
      dish.applyDamageWithUpgrades(10, 0, 0); // base damage only

      expect(dish.getCurrentHp()).toBe(initialHp - 10);
    });
  });

  describe('attackSpeedMultiplier', () => {
    it('should reduce damage interval when multiplier < 1', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      // Spawn with attack speed multiplier 0.5 (double speed)
      dish.spawn(100, 100, 'basic', 1, { attackSpeedMultiplier: 0.5 });

      // Check that damage interval is halved
      expect(dish.getDamageInterval()).toBe(100); // 200 * 0.5
    });

    it('should use default interval when no multiplier provided', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      dish.spawn(100, 100, 'basic', 1);

      expect(dish.getDamageInterval()).toBe(200); // default
    });
  });

  describe('criticalChance', () => {
    it('should deal 1.5x damage when critical hits (100% crit chance)', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      // Spawn with 100% critical chance
      dish.spawn(100, 100, 'basic', 1, { criticalChance: 1.0 });

      const initialHp = dish.getCurrentHp();

      // Apply damage with critical (100% chance = always crit)
      // Force random to return 0 (< 1.0) to trigger crit
      vi.spyOn(Math, 'random').mockReturnValue(0);
      dish.applyDamageWithUpgrades(10, 0, 1.0); // base 10, no bonus, 100% crit

      expect(dish.getCurrentHp()).toBe(initialHp - 15); // 10 * 1.5 = 15
    });

    it('should deal normal damage when crit chance is 0', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      dish.spawn(100, 100, 'basic', 1, { criticalChance: 0 });

      const initialHp = dish.getCurrentHp();
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Not a crit
      dish.applyDamageWithUpgrades(10, 0, 0);

      expect(dish.getCurrentHp()).toBe(initialHp - 10);
    });
  });

  describe('globalSlowPercent', () => {
    it('should slow down timer when globalSlowPercent is applied', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      // Spawn with 50% global slow
      dish.spawn(100, 100, 'basic', 1, { globalSlowPercent: 0.5 });

      // Update with 100ms delta
      dish.update(100);

      // With 50% slow, effective time should be 50ms
      // Lifetime is 2000ms, so timeRatio should be (2000 - 50) / 2000 = 0.975
      const timeRatio = dish.getTimeRatio();
      expect(timeRatio).toBeCloseTo(0.975, 2);
    });

    it('should run at normal speed when no slow applied', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      dish.spawn(100, 100, 'basic', 1);

      dish.update(100);

      // Without slow, timeRatio should be (2000 - 100) / 2000 = 0.95
      const timeRatio = dish.getTimeRatio();
      expect(timeRatio).toBeCloseTo(0.95, 2);
    });
  });

  describe('cursorSizeBonus', () => {
    it('should increase interactive area when cursorSizeBonus is applied', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      // Spawn with 50% cursor size bonus
      dish.spawn(100, 100, 'basic', 1, { cursorSizeBonus: 0.5 });

      // interactiveRadius = size + CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus)
      // = 30 + 30 * 1.5 = 30 + 45 = 75
      expect(dish.getInteractiveRadius()).toBe(75);
    });

    it('should use default interactive area when no bonus', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');

      dish.spawn(100, 100, 'basic', 1);

      // interactiveRadius = size + CURSOR_HITBOX.BASE_RADIUS * (1 + 0)
      // = 30 + 30 = 60
      expect(dish.getInteractiveRadius()).toBe(60);
    });
  });

  describe('DISH_DAMAGED event', () => {
    it('should emit DISH_DAMAGED with byAbility: true when applyDamage is called', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const { EventBus } = await import('../src/utils/EventBus');

      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');
      dish.spawn(100, 100, 'basic', 1);

      dish.applyDamage(10);

      expect(EventBus.getInstance().emit).toHaveBeenCalledWith(
        'dish_damaged',
        expect.objectContaining({
          byAbility: true,
        })
      );
    });

    it('should emit DISH_DAMAGED with byAbility: true when applyDamageWithUpgrades is called', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const { EventBus } = await import('../src/utils/EventBus');

      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');
      dish.spawn(100, 100, 'basic', 1);

      dish.applyDamageWithUpgrades(10, 0, 0);

      expect(EventBus.getInstance().emit).toHaveBeenCalledWith(
        'dish_damaged',
        expect.objectContaining({
          byAbility: true,
        })
      );
    });

    it('should emit DISH_DAMAGED with byAbility: false when takeDamage is called', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const { EventBus } = await import('../src/utils/EventBus');

      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');
      dish.spawn(100, 100, 'basic', 1);

      // takeDamage is private, so use a narrowed test-only cast to invoke it.
      (dish as unknown as { takeDamage: (isCritical: boolean) => void }).takeDamage(true);

      expect(EventBus.getInstance().emit).toHaveBeenCalledWith(
        'dish_damaged',
        expect.objectContaining({
          byAbility: false,
        })
      );
    });
  });

  describe('forceDestroy', () => {
    it('should emit DISH_DESTROYED with byAbility: true', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const { EventBus } = await import('../src/utils/EventBus');

      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');
      dish.spawn(100, 100, 'basic', 1);

      dish.forceDestroy();

      expect(EventBus.getInstance().emit).toHaveBeenCalledWith(
        'dish_destroyed',
        expect.objectContaining({
          byAbility: true,
        })
      );
    });

    it('should emit DISH_DESTROYED with byAbility: false when forceDestroy(false) is used', async () => {
      const { Dish } = await import('../src/entities/Dish');
      const { EventBus } = await import('../src/utils/EventBus');

      const dish = new Dish(mockScene as unknown as Phaser.Scene, 0, 0, 'basic');
      dish.spawn(100, 100, 'basic', 1);

      dish.forceDestroy(false);

      expect(EventBus.getInstance().emit).toHaveBeenCalledWith(
        'dish_destroyed',
        expect.objectContaining({
          byAbility: false,
        })
      );
    });
  });
});
