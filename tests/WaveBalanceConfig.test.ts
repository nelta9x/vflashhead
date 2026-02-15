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
  it('has 13 predefined waves with tempo pattern', () => {
    expect(Data.waves.waves).toHaveLength(13);
  });

  it('introduces bomb at wave 7 and crystal at wave 10', () => {
    for (let w = 1; w <= 6; w++) {
      expect(getWeight(w, 'bomb')).toBe(0);
    }
    expect(getWeight(7, 'bomb')).toBeGreaterThan(0);

    for (let w = 1; w <= 9; w++) {
      expect(getWeight(w, 'crystal')).toBe(0);
    }
    expect(getWeight(10, 'crystal')).toBeGreaterThan(0);
  });

  it('uses mini dishes in recovery waves for combo learning', () => {
    expect(getWeight(3, 'mini')).toBe(0.15);
    expect(getWeight(6, 'mini')).toBe(0.35);
    expect(getWeight(9, 'mini')).toBe(0.3);
    expect(getWeight(12, 'mini')).toBe(0.3);
  });

  it('recovery waves have lower dish count and higher golden ratio than adjacent pressure waves', () => {
    expect(getWave(3).dishCount).toBeLessThan(getWave(4).dishCount);
    expect(getWeight(3, 'golden')).toBeGreaterThan(getWeight(4, 'golden'));

    expect(getWave(6).dishCount).toBeLessThan(getWave(5).dishCount);
    expect(getWeight(6, 'golden')).toBeGreaterThan(getWeight(5, 'golden'));

    expect(getWave(9).dishCount).toBeLessThan(getWave(8).dishCount);
    expect(getWeight(9, 'golden')).toBeGreaterThan(getWeight(8, 'golden'));

    expect(getWave(12).dishCount).toBeLessThan(getWave(11).dishCount);
    expect(getWeight(12, 'golden')).toBeGreaterThan(getWeight(11, 'golden'));
  });

  it('waves 1-10 have one boss, waves 11-13 have two bosses', () => {
    for (let w = 1; w <= 10; w++) {
      expect(getWave(w).bosses).toHaveLength(1);
    }
    for (let w = 11; w <= 13; w++) {
      expect(getWave(w).bosses).toHaveLength(2);
      expect(getWave(w).bosses?.some((boss) => boss.id === 'boss_left')).toBe(true);
      expect(getWave(w).bosses?.some((boss) => boss.id === 'boss_right')).toBe(true);
    }
  });

  it('wave 11 introduces dual laser (maxCount 2)', () => {
    for (let w = 1; w <= 10; w++) {
      expect(getWave(w).laser?.maxCount ?? 0).toBeLessThanOrEqual(1);
    }
    expect(getWave(11).laser?.maxCount).toBe(2);
  });

  it('matches infinite scaling rebalance values', () => {
    const scaling = Data.waves.infiniteScaling;
    expect(scaling.spawnIntervalReduction).toBe(5);
    expect(scaling.minSpawnInterval).toBe(640);
    expect(scaling.bombWeightIncrease).toBe(0.002);
    expect(scaling.maxBombWeight).toBe(0.18);
    expect(scaling.goldenWeightDecrease).toBe(0.002);
    expect(scaling.minGoldenWeight).toBe(0.16);
    expect(scaling.bossHpIncrease).toBe(150);
    expect(scaling.bossTotalHpIncrease).toBe(150);
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

  it('introduces amber from wave 14 with three full-hp bosses', () => {
    const resolver = new WaveConfigResolver();
    const wave14Config = resolver.resolveWaveConfig(14);
    const wave14AmberWeight =
      wave14Config.dishTypes.find((dishType) => dishType.type === 'amber')?.weight ?? 0;

    expect(wave14AmberWeight).toBeGreaterThan(0);
    expect(wave14Config.bosses).toHaveLength(3);

    for (let waveNumber = 14; waveNumber <= 30; waveNumber++) {
      const waveConfig = resolver.resolveWaveConfig(waveNumber);
      const totalWeight = waveConfig.dishTypes.reduce((sum, dishType) => sum + dishType.weight, 0);
      const basicWeight =
        waveConfig.dishTypes.find((dishType) => dishType.type === 'basic')?.weight ?? 0;

      expect(waveConfig.bosses).toHaveLength(3);
      expect(totalWeight).toBeCloseTo(1, 6);
      expect(basicWeight).toBeGreaterThanOrEqual(0.05);

      // each boss gets full bossTotalHp (not divided)
      const perBossHp = waveConfig.bossTotalHp / waveConfig.bosses.length;
      const baseTotalHp = getWave(13).bossTotalHp ?? 0;
      const wavesBeyond = waveNumber - 13;
      const expectedPerBoss = baseTotalHp + wavesBeyond * 150;
      expect(perBossHp).toBe(expectedPerBoss);
    }
  });
});
