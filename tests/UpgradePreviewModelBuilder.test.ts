import { describe, expect, it } from 'vitest';

describe('UpgradePreviewModelBuilder', () => {
  it('미변경 항목은 제외하고 실제 변경 수치만 프리뷰에 남겨야 함', async () => {
    const { UpgradeSystem, UPGRADES } = await import('../src/plugins/builtin/services/UpgradeSystem');
    const upgrade = new UpgradeSystem();
    const missileUpgrade = UPGRADES.find((u) => u.id === 'missile')!;

    // Lv.1 상태를 만든 뒤 Lv.1 -> Lv.2 프리뷰 확인 (count는 동일, damage만 증가)
    upgrade.applyUpgrade(missileUpgrade);
    const preview = upgrade.getPreviewCardModel('missile');

    expect(preview).not.toBeNull();
    expect(preview?.rows.map((row) => row.id)).toEqual(['damage']);
  });

  it('커서 반경 derived 스탯이 현재/다음 값을 정확히 계산해야 함', async () => {
    const { UpgradeSystem } = await import('../src/plugins/builtin/services/UpgradeSystem');
    const upgrade = new UpgradeSystem();

    const preview = upgrade.getPreviewCardModel('cursor_size');
    const radiusRow = preview?.rows.find((row) => row.id === 'cursorRadiusPx');

    expect(radiusRow).toBeDefined();
    expect(radiusRow?.currentValue).toBeCloseTo(30);
    expect(radiusRow?.nextValue).toBeCloseTo(42);
    expect(radiusRow?.deltaValue).toBeCloseTo(12);
  });

  it('interval 계열은 값 감소가 개선으로 판정되어야 함', async () => {
    const { UpgradeSystem, UPGRADES } = await import('../src/plugins/builtin/services/UpgradeSystem');
    const upgrade = new UpgradeSystem();
    const blackHoleUpgrade = UPGRADES.find((u) => u.id === 'black_hole')!;

    // Lv.1 상태에서 Lv.2 프리뷰를 확인해야 interval 감소를 검증할 수 있음
    upgrade.applyUpgrade(blackHoleUpgrade);
    const preview = upgrade.getPreviewCardModel('black_hole');
    const damageIntervalRow = preview?.rows.find((row) => row.id === 'damageInterval');
    const spawnIntervalRow = preview?.rows.find((row) => row.id === 'spawnInterval');

    expect(damageIntervalRow).toBeDefined();
    expect(damageIntervalRow?.deltaValue).toBeLessThan(0);
    expect(damageIntervalRow?.isImprovement).toBe(true);

    expect(spawnIntervalRow).toBeDefined();
    expect(spawnIntervalRow?.deltaValue).toBeLessThan(0);
    expect(spawnIntervalRow?.isImprovement).toBe(true);
  });

  it('직접+간접 상승: 자기장 프리뷰에 구슬 시너지 크기 상승이 반영되어야 함', async () => {
    const { UpgradeSystem, UPGRADES } = await import('../src/plugins/builtin/services/UpgradeSystem');
    const upgrade = new UpgradeSystem();
    const orbUpgrade = UPGRADES.find((u) => u.id === 'orbiting_orb')!;

    upgrade.applyUpgrade(orbUpgrade); // orb size = 9

    const preview = upgrade.getPreviewCardModel('magnet');
    const orbSynergyRow = preview?.rows.find((row) => row.id === 'orbFinalSizeWithMagnet');

    expect(orbSynergyRow).toBeDefined();
    expect(orbSynergyRow?.currentValue).toBeCloseTo(9);
    expect(orbSynergyRow?.nextValue).toBeCloseTo(10.8);
    expect(orbSynergyRow?.deltaValue).toBeCloseTo(1.8);
  });
});
