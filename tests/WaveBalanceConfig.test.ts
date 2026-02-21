import { describe, expect, it } from 'vitest';
import { Data } from '../src/data/DataManager';
import { WaveConfigResolver } from '../src/plugins/builtin/services/wave/WaveConfigResolver';

function getWave(waveNumber: number) {
  return Data.waves.waves[waveNumber - 1];
}

function getWeight(waveNumber: number, type: string): number {
  return getWave(waveNumber).dishTypes.find((dishType) => dishType.type === type)?.weight ?? 0;
}

describe('Wave balance config', () => {
  it('has 11 predefined waves with tempo pattern', () => {
    expect(Data.waves.waves).toHaveLength(11);
  });

  it('introduces bomb at wave 5 and crystal at wave 7', () => {
    for (let w = 1; w <= 4; w++) {
      expect(getWeight(w, 'bomb')).toBe(0);
    }
    expect(getWeight(5, 'bomb')).toBeGreaterThan(0);

    for (let w = 1; w <= 6; w++) {
      expect(getWeight(w, 'crystal')).toBe(0);
    }
    expect(getWeight(7, 'crystal')).toBeGreaterThan(0);
  });

  it('uses mini dishes in recovery waves for combo learning', () => {
    expect(getWeight(1, 'mini')).toBe(0.15);
    expect(getWeight(4, 'mini')).toBe(0.35);
    expect(getWeight(7, 'mini')).toBe(0.3);
    expect(getWeight(10, 'mini')).toBe(0.3);
  });

  it('recovery waves have lower dish count and higher golden ratio than adjacent pressure waves', () => {
    expect(getWave(1).dishCount).toBeLessThan(getWave(2).dishCount);
    expect(getWeight(1, 'golden')).toBeGreaterThan(getWeight(2, 'golden'));

    expect(getWave(4).dishCount).toBeLessThan(getWave(3).dishCount);
    expect(getWeight(4, 'golden')).toBeGreaterThan(getWeight(3, 'golden'));

    expect(getWave(7).dishCount).toBeLessThan(getWave(6).dishCount);
    expect(getWeight(7, 'golden')).toBeGreaterThan(getWeight(6, 'golden'));

    expect(getWave(10).dishCount).toBeLessThan(getWave(9).dishCount);
    expect(getWeight(10, 'golden')).toBeGreaterThan(getWeight(9, 'golden'));
  });

  it('waves 1-8 have one boss, waves 9-11 have two bosses', () => {
    for (let w = 1; w <= 8; w++) {
      expect(getWave(w).bosses).toHaveLength(1);
    }
    for (let w = 9; w <= 11; w++) {
      expect(getWave(w).bosses).toHaveLength(2);
      expect(getWave(w).bosses?.some((boss) => boss.id === 'boss_left')).toBe(true);
      expect(getWave(w).bosses?.some((boss) => boss.id === 'boss_right')).toBe(true);
    }
  });

  it('all wave bosses and infinite template bosses declare entityTypeId registered in game-config', () => {
    const allowedEntityTypes = new Set(Data.gameConfig.entityTypes);
    for (const wave of Data.waves.waves) {
      for (const boss of wave.bosses ?? []) {
        expect(boss.entityTypeId, `wave ${wave.number} boss ${boss.id}`).toBeTruthy();
        expect(
          allowedEntityTypes.has(boss.entityTypeId),
          `wave ${wave.number} boss ${boss.id} uses unknown entityTypeId "${boss.entityTypeId}"`
        ).toBe(true);
      }
    }

    for (const boss of Data.waves.infiniteScaling.infiniteBossTemplate ?? []) {
      expect(boss.entityTypeId, `infinite template boss ${boss.id}`).toBeTruthy();
      expect(
        allowedEntityTypes.has(boss.entityTypeId),
        `infinite template boss ${boss.id} uses unknown entityTypeId "${boss.entityTypeId}"`
      ).toBe(true);
    }
  });

  it('wave 9 introduces dual laser (maxCount 2)', () => {
    for (let w = 1; w <= 8; w++) {
      expect(getWave(w).laser?.maxCount ?? 0).toBeLessThanOrEqual(1);
    }
    expect(getWave(9).laser?.maxCount).toBe(2);
  });

  it('matches infinite scaling rebalance values', () => {
    const scaling = Data.waves.infiniteScaling;
    expect(scaling.spawnIntervalReduction).toBe(5);
    expect(scaling.minSpawnInterval).toBe(640);
    expect(scaling.bombWeightIncrease).toBe(0.002);
    expect(scaling.maxBombWeight).toBe(0.18);
    expect(scaling.goldenWeightDecrease).toBe(0.002);
    expect(scaling.minGoldenWeight).toBe(0.16);
    expect(scaling.bossHpIncrease).toBe(200);
    expect(scaling.bossTotalHpIncrease).toBe(200);
    expect(scaling.infiniteBossCount).toBe(3);
    expect(scaling.infiniteBossFullHp).toBe(true);
    expect(scaling.infiniteBossTemplate).toHaveLength(3);
    expect(scaling.minDishCountIncrease).toBe(0);
    expect(scaling.maxMinDishCount).toBe(7);
    expect(scaling.amberStartWaveOffset).toBe(1);
    expect(scaling.amberStartWeight).toBe(0.02);
    expect(scaling.amberWeightIncrease).toBe(0.02);
    expect(scaling.maxAmberWeight).toBe(0.16);
  });

  it('all configured maxActive values are positive integers', () => {
    for (const wave of Data.waves.waves) {
      for (const dt of wave.dishTypes) {
        if (dt.maxActive != null) {
          expect(dt.maxActive, `wave ${wave.number} type ${dt.type}`).toBeGreaterThan(0);
          expect(Number.isInteger(dt.maxActive), `wave ${wave.number} type ${dt.type} integer`).toBe(true);
        }
      }
    }
    const dishTypeScaling = Data.waves.infiniteScaling.dishTypeScaling;
    if (dishTypeScaling) {
      for (const entry of dishTypeScaling) {
        if (entry.maxActive != null) {
          expect(entry.maxActive, `scaling type ${entry.type}`).toBeGreaterThan(0);
          expect(Number.isInteger(entry.maxActive), `scaling type ${entry.type} integer`).toBe(true);
        }
      }
    }
  });

  it('all waves have spaceship config separate from dishTypes', () => {
    for (const wave of Data.waves.waves) {
      expect(wave.spaceship, `wave ${wave.number} missing spaceship config`).toBeDefined();
      expect(wave.spaceship!.maxActive, `wave ${wave.number} maxActive`).toBeGreaterThanOrEqual(1);
      expect(wave.spaceship!.maxActive, `wave ${wave.number} maxActive`).toBeLessThanOrEqual(5);
      expect(wave.spaceship!.spawnInterval, `wave ${wave.number} spawnInterval`).toBeGreaterThan(0);

      const hasSpaceshipInDishTypes = wave.dishTypes.some((dt) => dt.type === 'spaceship');
      expect(hasSpaceshipInDishTypes, `wave ${wave.number} dishTypes should not contain spaceship`).toBe(false);
    }
  });

  it('spaceship maxActive scales from 1 to 5 across waves', () => {
    expect(getWave(1).spaceship!.maxActive).toBe(1);
    expect(getWave(11).spaceship!.maxActive).toBe(5);

    for (let w = 2; w <= 11; w++) {
      expect(
        getWave(w).spaceship!.maxActive,
        `wave ${w} maxActive should not decrease`,
      ).toBeGreaterThanOrEqual(getWave(w - 1).spaceship!.maxActive);
    }
  });

  it('infinite scaling includes spaceshipScaling config', () => {
    const scaling = Data.waves.infiniteScaling;
    expect(scaling.spaceshipScaling).toBeDefined();
    expect(scaling.spaceshipScaling!.maxActive).toBeGreaterThanOrEqual(1);
    expect(scaling.spaceshipScaling!.spawnInterval).toBeGreaterThan(0);

    const dishTypeScaling = scaling.dishTypeScaling ?? [];
    const hasSpaceshipInDishScaling = dishTypeScaling.some((e) => e.type === 'spaceship');
    expect(hasSpaceshipInDishScaling, 'spaceship should not be in dishTypeScaling').toBe(false);
  });

  it('resolver returns spaceship config for infinite waves', () => {
    const resolver = new WaveConfigResolver();
    for (let w = 12; w <= 15; w++) {
      const config = resolver.resolveWaveConfig(w);
      expect(config.spaceship, `infinite wave ${w}`).toBeDefined();
      expect(config.spaceship!.maxActive).toBeGreaterThanOrEqual(1);
    }
  });

  it('introduces amber from wave 12 with three full-hp bosses', () => {
    const resolver = new WaveConfigResolver();
    const wave12Config = resolver.resolveWaveConfig(12);
    const wave12AmberWeight =
      wave12Config.dishTypes.find((dishType) => dishType.type === 'amber')?.weight ?? 0;

    expect(wave12AmberWeight).toBeGreaterThan(0);
    expect(wave12Config.bosses).toHaveLength(3);

    for (let waveNumber = 12; waveNumber <= 28; waveNumber++) {
      const waveConfig = resolver.resolveWaveConfig(waveNumber);
      const totalWeight = waveConfig.dishTypes.reduce((sum, dishType) => sum + dishType.weight, 0);
      const basicWeight =
        waveConfig.dishTypes.find((dishType) => dishType.type === 'basic')?.weight ?? 0;

      expect(waveConfig.bosses).toHaveLength(3);
      expect(totalWeight).toBeCloseTo(1, 6);
      expect(basicWeight).toBeGreaterThanOrEqual(0.05);

      // each boss gets full bossTotalHp (not divided)
      const perBossHp = waveConfig.bossTotalHp / waveConfig.bosses.length;
      const baseTotalHp = getWave(11).bossTotalHp ?? 0;
      const wavesBeyond = waveNumber - 11;
      const expectedPerBoss = baseTotalHp + wavesBeyond * 200;
      expect(perBossHp).toBe(expectedPerBoss);
    }
  });
});
