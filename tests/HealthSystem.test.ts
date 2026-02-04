import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EventBus
vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }),
  },
  GameEvents: {
    HP_CHANGED: 'hp_changed',
    GAME_OVER: 'game_over',
  },
}));

// Mock constants
vi.mock('../src/config/constants', () => ({
  INITIAL_HP: 5,
}));

describe('HealthSystem Upgrade Effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('maxHpBonus', () => {
    it('should increase max HP when setMaxHp is called', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      expect(health.getMaxHp()).toBe(5);
      health.setMaxHp(7);
      expect(health.getMaxHp()).toBe(7);
    });

    it('should keep current HP when max HP increases', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      // 현재 HP: 5/5
      health.takeDamage(2); // HP: 3/5
      expect(health.getHp()).toBe(3);

      health.setMaxHp(7); // HP: 3/7 (현재 HP 유지)
      expect(health.getHp()).toBe(3);
      expect(health.getMaxHp()).toBe(7);
    });

    it('should cap heal at max HP', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      health.takeDamage(2); // HP: 3/5
      health.heal(10); // 10회복 시도, 하지만 최대 5

      expect(health.getHp()).toBe(5);
      expect(health.getMaxHp()).toBe(5);
    });

    it('should allow healing up to new max HP', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      health.takeDamage(2); // HP: 3/5
      health.setMaxHp(10); // max HP: 10
      health.heal(10);

      expect(health.getHp()).toBe(10);
      expect(health.getMaxHp()).toBe(10);
    });
  });

  describe('revive', () => {
    it('should revive with specified HP amount', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      health.takeDamage(5); // HP: 0
      expect(health.isDead()).toBe(true);

      const revived = health.revive(3);
      expect(revived).toBe(true);
      expect(health.getHp()).toBe(3);
      expect(health.isDead()).toBe(false);
    });

    it('should not revive if not dead', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      health.takeDamage(2); // HP: 3
      expect(health.isDead()).toBe(false);

      const revived = health.revive(3);
      expect(revived).toBe(false);
      expect(health.getHp()).toBe(3); // HP 변화 없음
    });

    it('should cap revive HP at max HP', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(5);

      health.takeDamage(5); // HP: 0
      health.revive(10); // 10 회복 시도

      expect(health.getHp()).toBe(5); // max HP로 제한
    });
  });

  describe('HP ratio', () => {
    it('should calculate HP ratio correctly', async () => {
      const { HealthSystem } = await import('../src/systems/HealthSystem');
      const health = new HealthSystem(10);

      expect(health.getHpRatio()).toBe(1.0);

      health.takeDamage(3);
      expect(health.getHpRatio()).toBe(0.7);

      health.takeDamage(4);
      expect(health.getHpRatio()).toBe(0.3);
    });
  });
});
