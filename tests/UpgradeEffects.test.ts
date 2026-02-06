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

describe('UpgradeSystem - 레벨 배열 기반 시스템', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('레벨 0 (미적용 상태)', () => {
    it('모든 getter가 0을 반환해야 함', async () => {
      const { UpgradeSystem } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      expect(upgrade.getCursorSizeBonus()).toBe(0);
      expect(upgrade.getCursorDamageBonus()).toBe(0);
      expect(upgrade.getElectricShockLevel()).toBe(0);
      expect(upgrade.getElectricShockRadius()).toBe(0);
      expect(upgrade.getElectricShockDamage()).toBe(0);
      expect(upgrade.getStaticDischargeLevel()).toBe(0);
      expect(upgrade.getStaticDischargeChance()).toBe(0);
      expect(upgrade.getStaticDischargeDamage()).toBe(0);
      expect(upgrade.getStaticDischargeRange()).toBe(0);
      expect(upgrade.getMagnetLevel()).toBe(0);
      expect(upgrade.getMagnetRadius()).toBe(0);
      expect(upgrade.getMagnetForce()).toBe(0);
      expect(upgrade.getMissileLevel()).toBe(0);
      expect(upgrade.getMissileDamage()).toBe(0);
      expect(upgrade.getMissileCount()).toBe(0);
    });
  });

  describe('커서 크기 (cursor_size)', () => {
    it('레벨 1 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const cursorUpgrade = UPGRADES.find((u) => u.id === 'cursor_size')!;

      upgrade.applyUpgrade(cursorUpgrade);
      expect(upgrade.getUpgradeStack('cursor_size')).toBe(1);
      expect(upgrade.getCursorSizeBonus()).toBeCloseTo(0.3);
      expect(upgrade.getCursorDamageBonus()).toBe(2);
    });

    it('레벨 3 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const cursorUpgrade = UPGRADES.find((u) => u.id === 'cursor_size')!;

      for (let i = 0; i < 3; i++) upgrade.applyUpgrade(cursorUpgrade);
      expect(upgrade.getUpgradeStack('cursor_size')).toBe(3);
      expect(upgrade.getCursorSizeBonus()).toBeCloseTo(0.9);
      expect(upgrade.getCursorDamageBonus()).toBe(6);
    });

    it('레벨 5 (맥스) 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const cursorUpgrade = UPGRADES.find((u) => u.id === 'cursor_size')!;

      for (let i = 0; i < 5; i++) upgrade.applyUpgrade(cursorUpgrade);
      expect(upgrade.getUpgradeStack('cursor_size')).toBe(5);
      expect(upgrade.getCursorSizeBonus()).toBeCloseTo(1.5);
      expect(upgrade.getCursorDamageBonus()).toBe(10);
    });
  });

  describe('전기 충격 (electric_shock)', () => {
    it('레벨 1 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const electricUpgrade = UPGRADES.find((u) => u.id === 'electric_shock')!;

      upgrade.applyUpgrade(electricUpgrade);
      expect(upgrade.getElectricShockLevel()).toBe(1);
      expect(upgrade.getElectricShockRadius()).toBe(320);
      expect(upgrade.getElectricShockDamage()).toBe(2);
    });

    it('레벨 3 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const electricUpgrade = UPGRADES.find((u) => u.id === 'electric_shock')!;

      for (let i = 0; i < 3; i++) upgrade.applyUpgrade(electricUpgrade);
      expect(upgrade.getElectricShockRadius()).toBe(400);
      expect(upgrade.getElectricShockDamage()).toBe(4);
    });

    it('레벨 5 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const electricUpgrade = UPGRADES.find((u) => u.id === 'electric_shock')!;

      for (let i = 0; i < 5; i++) upgrade.applyUpgrade(electricUpgrade);
      expect(upgrade.getElectricShockRadius()).toBe(480);
      expect(upgrade.getElectricShockDamage()).toBe(6);
    });
  });

  describe('정전기 방출 (static_discharge)', () => {
    it('레벨 1 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const staticUpgrade = UPGRADES.find((u) => u.id === 'static_discharge')!;

      upgrade.applyUpgrade(staticUpgrade);
      expect(upgrade.getStaticDischargeLevel()).toBe(1);
      expect(upgrade.getStaticDischargeChance()).toBeCloseTo(0.30);
      expect(upgrade.getStaticDischargeDamage()).toBe(5);
      expect(upgrade.getStaticDischargeRange()).toBe(300);
    });

    it('레벨 5 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const staticUpgrade = UPGRADES.find((u) => u.id === 'static_discharge')!;

      for (let i = 0; i < 5; i++) upgrade.applyUpgrade(staticUpgrade);
      expect(upgrade.getStaticDischargeChance()).toBeCloseTo(0.50);
      expect(upgrade.getStaticDischargeDamage()).toBe(13);
      expect(upgrade.getStaticDischargeRange()).toBe(500);
    });
  });

  describe('자기장 (magnet)', () => {
    it('레벨 1 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const magnetUpgrade = UPGRADES.find((u) => u.id === 'magnet')!;

      upgrade.applyUpgrade(magnetUpgrade);
      expect(upgrade.getMagnetLevel()).toBe(1);
      expect(upgrade.getMagnetRadius()).toBe(180);
      expect(upgrade.getMagnetForce()).toBe(300);
    });

    it('레벨 5 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const magnetUpgrade = UPGRADES.find((u) => u.id === 'magnet')!;

      for (let i = 0; i < 5; i++) upgrade.applyUpgrade(magnetUpgrade);
      expect(upgrade.getMagnetRadius()).toBe(260);
      expect(upgrade.getMagnetForce()).toBe(380);
    });
  });

  describe('미사일 (missile)', () => {
    it('레벨 1 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const missileUpgrade = UPGRADES.find((u) => u.id === 'missile')!;

      upgrade.applyUpgrade(missileUpgrade);
      expect(upgrade.getMissileLevel()).toBe(1);
      expect(upgrade.getMissileDamage()).toBe(100);
      expect(upgrade.getMissileCount()).toBe(2);
    });

    it('레벨 3 수치 확인', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const missileUpgrade = UPGRADES.find((u) => u.id === 'missile')!;

      for (let i = 0; i < 3; i++) upgrade.applyUpgrade(missileUpgrade);
      expect(upgrade.getMissileDamage()).toBe(100);
      expect(upgrade.getMissileCount()).toBe(4);
    });

    it('비선형 수치: 레벨 4→5 시 damage 100→150 점프', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const missileUpgrade = UPGRADES.find((u) => u.id === 'missile')!;

      // 레벨 4
      for (let i = 0; i < 4; i++) upgrade.applyUpgrade(missileUpgrade);
      expect(upgrade.getMissileDamage()).toBe(150);
      expect(upgrade.getMissileCount()).toBe(5);

      // 레벨 5
      upgrade.applyUpgrade(missileUpgrade);
      expect(upgrade.getMissileDamage()).toBe(200);
      expect(upgrade.getMissileCount()).toBe(6);
    });
  });

  describe('스택 제한', () => {
    it('7회 적용해도 levels.length(5)에서 캡', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();
      const cursorUpgrade = UPGRADES.find((u) => u.id === 'cursor_size')!;

      for (let i = 0; i < 7; i++) upgrade.applyUpgrade(cursorUpgrade);

      expect(upgrade.getUpgradeStack('cursor_size')).toBe(5);
      expect(upgrade.getCursorSizeBonus()).toBeCloseTo(1.5);
      expect(upgrade.getCursorDamageBonus()).toBe(10);
    });

    it('모든 어빌리티 maxStack이 levels.length와 일치', async () => {
      const { UPGRADES } = await import('../src/systems/UpgradeSystem');

      const levelUpgrades = UPGRADES.filter(
        (u) => u.id !== 'health_pack'
      );

      for (const upgrade of levelUpgrades) {
        expect(upgrade.maxStack).toBe(5);
      }
    });
  });

  describe('리셋', () => {
    it('reset() 후 모든 스택 0, 모든 getter 0', async () => {
      const { UpgradeSystem, UPGRADES } = await import('../src/systems/UpgradeSystem');
      const upgrade = new UpgradeSystem();

      // 모든 어빌리티 적용
      for (const u of UPGRADES) {
        if (u.id !== 'health_pack') {
          for (let i = 0; i < 3; i++) upgrade.applyUpgrade(u);
        }
      }

      // 리셋
      upgrade.reset();

      // 확인
      expect(upgrade.getCursorSizeBonus()).toBe(0);
      expect(upgrade.getCursorDamageBonus()).toBe(0);
      expect(upgrade.getElectricShockLevel()).toBe(0);
      expect(upgrade.getElectricShockRadius()).toBe(0);
      expect(upgrade.getElectricShockDamage()).toBe(0);
      expect(upgrade.getStaticDischargeLevel()).toBe(0);
      expect(upgrade.getStaticDischargeChance()).toBe(0);
      expect(upgrade.getStaticDischargeDamage()).toBe(0);
      expect(upgrade.getStaticDischargeRange()).toBe(0);
      expect(upgrade.getMagnetLevel()).toBe(0);
      expect(upgrade.getMagnetRadius()).toBe(0);
      expect(upgrade.getMagnetForce()).toBe(0);
      expect(upgrade.getMissileLevel()).toBe(0);
      expect(upgrade.getMissileDamage()).toBe(0);
      expect(upgrade.getMissileCount()).toBe(0);
    });
  });
});
