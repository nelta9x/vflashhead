import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/data/DataManager', () => ({
  Data: {
    dishes: {
      damage: {
        playerDamage: 10,
        damageInterval: 150,
        criticalChance: 0.1,
        criticalMultiplier: 2,
      },
    },
  },
}));

vi.mock('../src/utils/EventBus', () => {
  const emitFn = vi.fn();
  return {
    EventBus: {
      getInstance: () => ({ emit: emitFn, on: vi.fn(), off: vi.fn(), clear: vi.fn() }),
    },
    GameEvents: {
      DISH_DAMAGED: 'DISH_DAMAGED',
      DISH_DESTROYED: 'DISH_DESTROYED',
      DISH_MISSED: 'DISH_MISSED',
      MONSTER_DIED: 'MONSTER_DIED',
    },
  };
});

vi.mock('../src/entities/dish/DishDamageResolver', () => ({
  DishDamageResolver: {
    resolveCursorDamage: vi.fn(() => ({ damage: 10, isCritical: false })),
    resolveUpgradeDamage: vi.fn(() => ({ damage: 25, isCritical: true })),
  },
}));

vi.mock('../src/entities/dish/DishEventPayloadFactory', () => ({
  DishEventPayloadFactory: {
    createDishDamagedPayload: vi.fn((p: Record<string, unknown>) => p),
    createDishDestroyedPayload: vi.fn((p: Record<string, unknown>) => p),
    createDishMissedPayload: vi.fn((p: Record<string, unknown>) => p),
  },
}));

import { World } from '../src/world/World';
import { EntityDamageService } from '../src/systems/EntityDamageService';
import { EventBus, GameEvents } from '../src/utils/EventBus';

interface MockEntity {
  active: boolean;
  x: number;
  y: number;
  disableInteractive: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setActive: ReturnType<typeof vi.fn>;
  getEntityId: () => string;
  body: null;
}

function createMockEntity(id: string): MockEntity {
  return {
    active: true,
    x: 100,
    y: 200,
    disableInteractive: vi.fn(),
    removeAllListeners: vi.fn(),
    setVisible: vi.fn(),
    setActive: vi.fn(),
    getEntityId: () => id,
    body: null,
  };
}

const mockScene = {
  time: { addEvent: vi.fn(() => ({ destroy: vi.fn() })) },
} as never;

function setupEntity(world: World, id: string): void {
  world.createEntity(id);
  world.identity.set(id, { entityId: id, entityType: 'basic', isGatekeeper: false });
  world.health.set(id, { currentHp: 100, maxHp: 100, isDead: false });
  world.dishProps.set(id, {
    dangerous: false, invulnerable: false, color: 0x00ffff, size: 30,
    interactiveRadius: 40, upgradeOptions: {}, destroyedByAbility: false,
  });
  world.cursorInteraction.set(id, {
    isHovered: false, isBeingDamaged: false, damageInterval: 150,
    damageTimerHandle: null, cursorInteractionType: 'dps',
  });
  world.visualState.set(id, {
    hitFlashPhase: 0, wobblePhase: 0, blinkPhase: 0, isBeingPulled: false, pullPhase: 0,
  });
}

describe('EntityDamageService', () => {
  let world: World;
  let sem: { applyEffect: ReturnType<typeof vi.fn>; removeEffect: ReturnType<typeof vi.fn>; clearEntity: ReturnType<typeof vi.fn> };
  let mockEntity: MockEntity;
  let service: EntityDamageService;

  beforeEach(() => {
    vi.clearAllMocks();
    world = new World();
    sem = { applyEffect: vi.fn(), removeEffect: vi.fn(), clearEntity: vi.fn() };
    mockEntity = createMockEntity('e1');
    setupEntity(world, 'e1');
    service = new EntityDamageService(
      world,
      sem as never,
      () => mockEntity as never,
      mockScene,
    );
  });

  describe('applyDamage', () => {
    it('reduces HP and emits DISH_DAMAGED', () => {
      service.applyDamage('e1', 30);
      const health = world.health.getRequired('e1');
      expect(health.currentHp).toBe(70);
    });

    it('sets hitFlashPhase to 1', () => {
      service.applyDamage('e1', 10);
      const vs = world.visualState.getRequired('e1');
      expect(vs.hitFlashPhase).toBe(1);
    });

    it('marks destroyedByAbility', () => {
      service.applyDamage('e1', 10);
      const dp = world.dishProps.getRequired('e1');
      expect(dp.destroyedByAbility).toBe(true);
    });

    it('destroys entity when HP <= 0', () => {
      service.applyDamage('e1', 200);
      expect(mockEntity.active).toBe(false);
    });

    it('does nothing for invulnerable entities', () => {
      world.dishProps.getRequired('e1').invulnerable = true;
      service.applyDamage('e1', 50);
      expect(world.health.getRequired('e1').currentHp).toBe(100);
    });

    it('does nothing for inactive entities', () => {
      mockEntity.active = false;
      service.applyDamage('e1', 50);
      expect(world.health.getRequired('e1').currentHp).toBe(100);
    });

    it('emits DISH_DAMAGED event', () => {
      service.applyDamage('e1', 30);
      const bus = EventBus.getInstance();
      expect(bus.emit).toHaveBeenCalledWith(GameEvents.DISH_DAMAGED, expect.anything());
    });
  });

  describe('applyUpgradeDamage', () => {
    it('uses DishDamageResolver and reduces HP', () => {
      service.applyUpgradeDamage('e1', 20, 5, 0.1);
      const health = world.health.getRequired('e1');
      expect(health.currentHp).toBe(75); // 100 - 25 (mocked)
    });
  });

  describe('forceDestroy', () => {
    it('marks destroyedByAbility and deactivates', () => {
      service.forceDestroy('e1', true);
      expect(mockEntity.active).toBe(false);
      const bus = EventBus.getInstance();
      expect(bus.emit).toHaveBeenCalledWith(GameEvents.DISH_DESTROYED, expect.anything());
    });
  });

  describe('handleTimeout', () => {
    it('deactivates entity and emits DISH_MISSED', () => {
      service.handleTimeout('e1');
      expect(mockEntity.active).toBe(false);
      const bus = EventBus.getInstance();
      expect(bus.emit).toHaveBeenCalledWith(GameEvents.DISH_MISSED, expect.anything());
    });
  });

  describe('applySlow', () => {
    it('applies slow effect via StatusEffectManager', () => {
      service.applySlow('e1', 2000, 0.5);
      expect(sem.applyEffect).toHaveBeenCalledWith('e1', expect.objectContaining({
        type: 'slow',
        data: { factor: 0.5 },
      }));
    });
  });

  describe('freeze / unfreeze', () => {
    it('freeze applies freeze effect', () => {
      service.freeze('e1');
      expect(sem.applyEffect).toHaveBeenCalledWith('e1', expect.objectContaining({
        type: 'freeze',
      }));
    });

    it('unfreeze removes freeze effect', () => {
      service.unfreeze('e1');
      expect(sem.removeEffect).toHaveBeenCalledWith('e1', 'e1:freeze');
    });
  });

  describe('setBeingPulled', () => {
    it('updates visualState.isBeingPulled', () => {
      service.setBeingPulled('e1', true);
      expect(world.visualState.getRequired('e1').isBeingPulled).toBe(true);
    });
  });

  describe('applyContactDamage', () => {
    function setupBossState(id: string): void {
      world.bossState.set(id, {
        defaultArmorPieces: 0,
        armorPieceCount: 0,
        currentArmorCount: 0,
        filledHpSlotCount: 0,
        shakeOffsetX: 0,
        shakeOffsetY: 0,
        pushOffsetX: 0,
        pushOffsetY: 0,
        isHitStunned: false,
        pendingDamageReaction: false,
        damageSourceX: 0,
        damageSourceY: 0,
        pendingDeathAnimation: false,
        deathAnimationPlaying: false,
        reactionTweens: [],
        deathTween: null,
      });
    }

    it('reduces HP for boss entity', () => {
      setupBossState('e1');
      service.applyContactDamage('e1', 20, 50, 50);
      const health = world.health.getRequired('e1');
      expect(health.currentHp).toBe(80);
    });

    it('sets pendingDamageReaction flag with source coordinates', () => {
      setupBossState('e1');
      service.applyContactDamage('e1', 20, 150, 250);
      const bs = world.bossState.getRequired('e1');
      expect(bs.pendingDamageReaction).toBe(true);
      expect(bs.damageSourceX).toBe(150);
      expect(bs.damageSourceY).toBe(250);
    });

    it('sets pendingDeathAnimation when HP reaches 0', () => {
      setupBossState('e1');
      service.applyContactDamage('e1', 200, 50, 50);
      const bs = world.bossState.getRequired('e1');
      expect(bs.pendingDeathAnimation).toBe(true);
      expect(world.health.getRequired('e1').isDead).toBe(true);
    });

    it('does not apply damage to dead entities', () => {
      setupBossState('e1');
      world.health.getRequired('e1').isDead = true;
      service.applyContactDamage('e1', 20, 50, 50);
      expect(world.health.getRequired('e1').currentHp).toBe(100);
    });
  });

  describe('handleExternalHpChange', () => {
    function setupBossState(id: string): void {
      world.bossState.set(id, {
        defaultArmorPieces: 0,
        armorPieceCount: 0,
        currentArmorCount: 0,
        filledHpSlotCount: 0,
        shakeOffsetX: 0,
        shakeOffsetY: 0,
        pushOffsetX: 0,
        pushOffsetY: 0,
        isHitStunned: false,
        pendingDamageReaction: false,
        damageSourceX: 0,
        damageSourceY: 0,
        pendingDeathAnimation: false,
        deathAnimationPlaying: false,
        reactionTweens: [],
        deathTween: null,
      });
    }

    it('updates health in World store', () => {
      service.handleExternalHpChange('e1', 50, 200);
      const health = world.health.getRequired('e1');
      expect(health.currentHp).toBe(50);
      expect(health.maxHp).toBe(200);
    });

    it('sets pendingDamageReaction when source coordinates provided', () => {
      setupBossState('e1');
      service.handleExternalHpChange('e1', 50, 200, 100, 200);
      const bs = world.bossState.getRequired('e1');
      expect(bs.pendingDamageReaction).toBe(true);
      expect(bs.damageSourceX).toBe(100);
      expect(bs.damageSourceY).toBe(200);
    });

    it('marks dead when HP reaches 0', () => {
      service.handleExternalHpChange('e1', 0, 100);
      expect(world.health.getRequired('e1').isDead).toBe(true);
    });

    it('sets pendingDeathAnimation when HP reaches 0 with bossState', () => {
      setupBossState('e1');
      service.handleExternalHpChange('e1', 0, 100);
      expect(world.health.getRequired('e1').isDead).toBe(true);
      const bs = world.bossState.getRequired('e1');
      expect(bs.pendingDeathAnimation).toBe(true);
    });
  });

  describe('explode', () => {
    it('deactivates entity and emits DISH_DESTROYED', () => {
      service.explode('e1');
      expect(mockEntity.active).toBe(false);
      expect(mockEntity.disableInteractive).toHaveBeenCalled();
      const bus = EventBus.getInstance();
      expect(bus.emit).toHaveBeenCalledWith(GameEvents.DISH_DESTROYED, expect.anything());
    });
  });
});
