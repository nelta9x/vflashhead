import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock constants
vi.mock('../src/data/constants', () => ({
  INITIAL_HP: 5,
  UPGRADE_TIMING: {
    BASE_INTERVAL: 15000,
    INCREMENT: 5000,
    MAX_INTERVAL: 30000,
  },
  RARITY_WEIGHTS_BY_COUNT: {
    early: { common: 60, rare: 30, epic: 10, legendary: 0 },
    mid: { common: 45, rare: 35, epic: 17, legendary: 3 },
    late: { common: 30, rare: 35, epic: 25, legendary: 10 },
    endgame: { common: 20, rare: 30, epic: 30, legendary: 20 },
  },
}));

// Mock EventBus
const mockEmit = vi.fn();
const mockOn = vi.fn();
vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: mockEmit,
      on: mockOn,
      off: vi.fn(),
      clear: vi.fn(),
    }),
  },
  GameEvents: {
    HP_CHANGED: 'hp_changed',
    GAME_OVER: 'game_over',
    DISH_DESTROYED: 'dish_destroyed',
    DISH_MISSED: 'dish_missed',
    COMBO_CHANGED: 'combo_changed',
    COMBO_MILESTONE: 'combo_milestone',
    WAVE_COMPLETED: 'wave_completed',
    UPGRADE_SELECTED: 'upgrade_selected',
  },
}));

describe('UpgradeSystem - 간소화된 시스템', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('커서 크기', () => {
    it('커서 크기 보너스 추적', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      expect(upgrade.getCursorSizeBonus()).toBe(0);
      upgrade.addCursorSizeBonus(0.03);
      expect(upgrade.getCursorSizeBonus()).toBeCloseTo(0.03);
      upgrade.addCursorSizeBonus(0.03);
      expect(upgrade.getCursorSizeBonus()).toBeCloseTo(0.06);
    });
  });

  describe('전기 충격', () => {
    it('전기 충격 레벨 추적', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      expect(upgrade.getElectricShockLevel()).toBe(0);
      upgrade.addElectricShockLevel(1);
      expect(upgrade.getElectricShockLevel()).toBe(1);
      upgrade.addElectricShockLevel(1);
      expect(upgrade.getElectricShockLevel()).toBe(2);
    });
  });

  describe('정전기 방출', () => {
    it('정전기 방출 레벨 추적', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      expect(upgrade.getStaticDischargeLevel()).toBe(0);
      upgrade.addStaticDischargeLevel(1);
      expect(upgrade.getStaticDischargeLevel()).toBe(1);
      upgrade.addStaticDischargeLevel(1);
      expect(upgrade.getStaticDischargeLevel()).toBe(2);
    });
  });

  describe('자기장', () => {
    it('자기장 레벨 추적', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      expect(upgrade.getMagnetLevel()).toBe(0);
      upgrade.addMagnetLevel(1);
      expect(upgrade.getMagnetLevel()).toBe(1);
      upgrade.addMagnetLevel(1);
      expect(upgrade.getMagnetLevel()).toBe(2);
      upgrade.addMagnetLevel(1);
      expect(upgrade.getMagnetLevel()).toBe(3);
    });
  });

  describe('미사일', () => {
    it('미사일 레벨 추적', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      expect(upgrade.getMissileLevel()).toBe(0);
      upgrade.addMissileLevel(1);
      expect(upgrade.getMissileLevel()).toBe(1);
      upgrade.addMissileLevel(1);
      expect(upgrade.getMissileLevel()).toBe(2);
    });
  });

  describe('리셋', () => {
    it('모든 값이 리셋되어야 함', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      // 값 설정
      upgrade.addCursorSizeBonus(0.4);
      upgrade.addElectricShockLevel(2);
      upgrade.addStaticDischargeLevel(1);
      upgrade.addMagnetLevel(3);
      upgrade.addMissileLevel(1);

      // 리셋
      upgrade.reset();

      // 확인
      expect(upgrade.getCursorSizeBonus()).toBe(0);
      expect(upgrade.getElectricShockLevel()).toBe(0);
      expect(upgrade.getStaticDischargeLevel()).toBe(0);
      expect(upgrade.getMagnetLevel()).toBe(0);
      expect(upgrade.getMissileLevel()).toBe(0);
    });
  });

  describe('업그레이드 적용', () => {
    it('넓은 타격 스택 (maxStack=5)', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      const upgrades = upgrade.getRandomUpgrades(5);
      const cursorUpgrade = upgrades.find((u) => u.id === 'cursor_size');

      if (cursorUpgrade) {
        // maxStack이 5이므로 5번까지 중첩 가능
        for (let i = 0; i < 7; i++) {
          upgrade.applyUpgrade(cursorUpgrade);
        }
        expect(upgrade.getUpgradeStack('cursor_size')).toBe(5);
        expect(upgrade.getCursorSizeBonus()).toBeCloseTo(1.5); // 0.3 * 5
        expect(upgrade.getCursorDamageBonus()).toBe(10); // 2 * 5
      }
    });
    it('전기 충격 스택 (maxStack=5)', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      const upgrades = upgrade.getRandomUpgrades(5);
      const electricUpgrade = upgrades.find((u) => u.id === 'electric_shock');

      if (electricUpgrade) {
        // maxStack은 5
        for (let i = 0; i < 7; i++) {
          upgrade.applyUpgrade(electricUpgrade);
        }
        expect(upgrade.getUpgradeStack('electric_shock')).toBe(5);
        expect(upgrade.getElectricShockLevel()).toBe(5);
      }
    });

    it('정전기 방출 스택 (maxStack=5)', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      const upgrades = upgrade.getRandomUpgrades(10);
      const staticUpgrade = upgrades.find((u) => u.id === 'static_discharge');

      if (staticUpgrade) {
        // maxStack은 5
        for (let i = 0; i < 7; i++) {
          upgrade.applyUpgrade(staticUpgrade);
        }
        expect(upgrade.getUpgradeStack('static_discharge')).toBe(5);
        expect(upgrade.getStaticDischargeLevel()).toBe(5);
      }
    });

    it('자기장 스택 (maxStack=5)', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      const upgrades = upgrade.getRandomUpgrades(5);
      const magnetUpgrade = upgrades.find((u) => u.id === 'magnet');

      if (magnetUpgrade) {
        // maxStack은 5
        for (let i = 0; i < 7; i++) {
          upgrade.applyUpgrade(magnetUpgrade);
        }
        expect(upgrade.getUpgradeStack('magnet')).toBe(5);
        expect(upgrade.getMagnetLevel()).toBe(5);
      }
    });

    it('미사일 스택 (maxStack=5)', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      const upgrades = upgrade.getRandomUpgrades(5);
      const missileUpgrade = upgrades.find((u) => u.id === 'missile');

      if (missileUpgrade) {
        // maxStack은 5
        for (let i = 0; i < 7; i++) {
          upgrade.applyUpgrade(missileUpgrade);
        }
        expect(upgrade.getUpgradeStack('missile')).toBe(5);
        expect(upgrade.getMissileLevel()).toBe(5);
      }
    });
  });
});
