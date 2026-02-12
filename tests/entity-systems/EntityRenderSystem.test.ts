import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock DishRenderer
vi.mock('../../src/effects/DishRenderer', () => ({
  DishRenderer: {
    renderDish: vi.fn(),
    renderDangerDish: vi.fn(),
  },
}));

import { World } from '../../src/world/World';
import { EntityRenderSystem } from '../../src/systems/entity-systems/EntityRenderSystem';

describe('EntityRenderSystem', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it('has correct id', () => {
    const system = new EntityRenderSystem(world);
    expect(system.id).toBe('core:entity_render');
  });

  it('syncs transform to Phaser container', () => {
    const mockContainer = { x: 0, y: 0, alpha: 1, scaleX: 1, scaleY: 1, };
    const mockGraphics = { clear: vi.fn() };
    const system = new EntityRenderSystem(world);

    world.createEntity('e1');
    world.transform.set('e1', { x: 100, y: 200, baseX: 100, baseY: 200, alpha: 0.5, scaleX: 2, scaleY: 2 });
    world.phaserNode.set('e1', {
      container: mockContainer as never,
      graphics: mockGraphics as never,
      body: null,
      spawnTween: null,
      bossRenderer: null,
      typePlugin: null,
    });
    world.identity.set('e1', { entityId: 'e1', entityType: 'basic', isGatekeeper: false });
    world.dishProps.set('e1', {
      dangerous: false, invulnerable: false, color: 0x00ffff, size: 30,
      interactiveRadius: 40, upgradeOptions: {}, destroyedByAbility: false,
    });
    world.health.set('e1', { currentHp: 10, maxHp: 10, isDead: false });
    world.statusCache.set('e1', { isFrozen: false, slowFactor: 1.0, isShielded: false });
    world.visualState.set('e1', {
      hitFlashPhase: 0, wobblePhase: 0, blinkPhase: 0, isBeingPulled: false, pullPhase: 0,
    });
    world.cursorInteraction.set('e1', {
      isHovered: false, isBeingDamaged: false, damageInterval: 150,
      damageTimerHandle: null, cursorInteractionType: 'dps',
    });

    system.tick(16);

    expect(mockContainer.x).toBe(100);
    expect(mockContainer.y).toBe(200);
    expect(mockContainer.alpha).toBe(0.5);
    expect(mockContainer.scaleX).toBe(2);
    expect(mockContainer.scaleY).toBe(2);
  });

  it('calls plugin.onUpdate via node.typePlugin', () => {
    const mockOnUpdate = vi.fn();
    const mockPlugin = { onUpdate: mockOnUpdate };
    const mockContainer = { x: 0, y: 0, alpha: 1, scaleX: 1, scaleY: 1 };
    const system = new EntityRenderSystem(world);

    world.createEntity('e1');
    world.phaserNode.set('e1', {
      container: mockContainer as never,
      graphics: {} as never,
      body: null,
      spawnTween: null,
      bossRenderer: null,
      typePlugin: mockPlugin as never,
    });
    world.transform.set('e1', { x: 0, y: 0, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });
    world.identity.set('e1', { entityId: 'e1', entityType: 'basic', isGatekeeper: false });
    world.lifetime.set('e1', {
      elapsedTime: 0, movementTime: 500, lifetime: 5000, spawnDuration: 150, globalSlowPercent: 0,
    });

    system.tick(16);

    expect(mockOnUpdate).toHaveBeenCalledWith('e1', world, 16, 500);
  });

  it('skips player entity', () => {
    const mockContainer = { x: 0, y: 0, alpha: 1, scaleX: 1, scaleY: 1 };
    const system = new EntityRenderSystem(world);

    world.createEntity('player');
    world.transform.set('player', { x: 100, y: 200, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });
    world.phaserNode.set('player', {
      container: mockContainer as never,
      graphics: {} as never,
      body: null,
      spawnTween: null,
      bossRenderer: null,
      typePlugin: null,
    });

    system.tick(16);

    expect(mockContainer.x).toBe(0); // not synced
  });

  it('reverse-syncs alpha/scale from container to World when spawnTween is active', () => {
    const mockContainer = { x: 0, y: 0, alpha: 0.3, scaleX: 0.5, scaleY: 0.5, };
    const system = new EntityRenderSystem(world);

    world.createEntity('e1');
    const transform = { x: 50, y: 60, baseX: 50, baseY: 60, alpha: 0, scaleX: 0, scaleY: 0 };
    world.transform.set('e1', transform);
    world.phaserNode.set('e1', {
      container: mockContainer as never,
      graphics: {} as never,
      body: null,
      spawnTween: {} as never, // truthy = active tween
      bossRenderer: null,
      typePlugin: null,
    });
    world.identity.set('e1', { entityId: 'e1', entityType: 'basic', isGatekeeper: false });

    system.tick(16);

    // Container values should be preserved (not overwritten by World)
    expect(mockContainer.alpha).toBe(0.3);
    expect(mockContainer.scaleX).toBe(0.5);
    expect(mockContainer.scaleY).toBe(0.5);
    // World should be updated from Container
    expect(transform.alpha).toBe(0.3);
    expect(transform.scaleX).toBe(0.5);
    expect(transform.scaleY).toBe(0.5);
    // Position always syncs World → Container
    expect(mockContainer.x).toBe(50);
    expect(mockContainer.y).toBe(60);
  });

  it('skips inactive entities', () => {
    const mockContainer = { x: 0, y: 0, alpha: 1, scaleX: 1, scaleY: 1 };
    const system = new EntityRenderSystem(world);

    world.transform.set('e1', { x: 100, y: 200, baseX: 0, baseY: 0, alpha: 1, scaleX: 1, scaleY: 1 });
    world.phaserNode.set('e1', {
      container: mockContainer as never,
      graphics: {} as never,
      body: null,
      spawnTween: null,
      bossRenderer: null,
      typePlugin: null,
    });

    system.tick(16);

    expect(mockContainer.x).toBe(0);
  });
});
