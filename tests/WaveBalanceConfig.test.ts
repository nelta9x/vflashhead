import { describe, expect, it } from 'vitest';
import { Data } from '../src/data/DataManager';
import { WaveConfigResolver } from '../src/systems/wave/WaveConfigResolver';

function getWave(waveNumber: number) {
  return Data.waves.waves[waveNumber - 1];
}

function getWeight(waveNumber: number, type: string): number {
  return getWave(waveNumber).dishTypes.find((dishType) => dishType.type === type)?.weight ?? 0;
}

describe('Wave balance config', () => {
  it('has 14 predefined waves with tempo pattern', () => {
    expect(Data.waves.waves).toHaveLength(14);
  });

  it('introduces bomb at wave 8 and crystal at wave 11', () => {
    for (let w = 1; w <= 7; w++) {
      expect(getWeight(w, 'bomb')).toBe(0);
    }
    expect(getWeight(8, 'bomb')).toBeGreaterThan(0);

    for (let w = 1; w <= 10; w++) {
      expect(getWeight(w, 'crystal')).toBe(0);
    }
    expect(getWeight(11, 'crystal')).toBeGreaterThan(0);
  });

  it('uses mini dishes in recovery waves for combo learning', () => {
    expect(getWeight(1, 'mini')).toBe(0.2);
    expect(getWeight(4, 'mini')).toBe(0.15);
    expect(getWeight(7, 'mini')).toBe(0.35);
    expect(getWeight(10, 'mini')).toBe(0.3);
    expect(getWeight(13, 'mini')).toBe(0.3);
  });

  it('recovery waves have lower dish count and higher golden ratio than adjacent pressure waves', () => {
    expect(getWave(4).dishCount).toBeLessThan(getWave(3).dishCount);
    expect(getWeight(4, 'golden')).toBeGreaterThan(getWeight(3, 'golden'));

    expect(getWave(7).dishCount).toBeLessThan(getWave(6).dishCount);
    expect(getWeight(7, 'golden')).toBeGreaterThan(getWeight(6, 'golden'));

    expect(getWave(10).dishCount).toBeLessThan(getWave(9).dishCount);
    expect(getWeight(10, 'golden')).toBeGreaterThan(getWeight(9, 'golden'));

    expect(getWave(13).dishCount).toBeLessThan(getWave(12).dishCount);
    expect(getWeight(13, 'golden')).toBeGreaterThan(getWeight(12, 'golden'));
  });

  it('waves 1-11 have one boss, waves 12-14 have two bosses', () => {
    for (let w = 1; w <= 11; w++) {
      expect(getWave(w).bosses).toHaveLength(1);
    }
    for (let w = 12; w <= 14; w++) {
      expect(getWave(w).bosses).toHaveLength(2);
      expect(getWave(w).bosses?.some((boss) => boss.id === 'boss_left')).toBe(true);
      expect(getWave(w).bosses?.some((boss) => boss.id === 'boss_right')).toBe(true);
    }
  });

  it('wave 12 introduces dual laser (maxCount 2)', () => {
    for (let w = 1; w <= 11; w++) {
      expect(getWave(w).laser?.maxCount ?? 0).toBeLessThanOrEqual(1);
    }
    expect(getWave(12).laser?.maxCount).toBe(2);
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

  it('introduces amber from wave 15 with three full-hp bosses', () => {
    const resolver = new WaveConfigResolver();
    const wave15Config = resolver.resolveWaveConfig(15);
    const wave15AmberWeight =
      wave15Config.dishTypes.find((dishType) => dishType.type === 'amber')?.weight ?? 0;

    expect(wave15AmberWeight).toBeGreaterThan(0);
    expect(wave15Config.bosses).toHaveLength(3);

    for (let waveNumber = 15; waveNumber <= 30; waveNumber++) {
      const waveConfig = resolver.resolveWaveConfig(waveNumber);
      const totalWeight = waveConfig.dishTypes.reduce((sum, dishType) => sum + dishType.weight, 0);
      const basicWeight =
        waveConfig.dishTypes.find((dishType) => dishType.type === 'basic')?.weight ?? 0;

      expect(waveConfig.bosses).toHaveLength(3);
      expect(totalWeight).toBeCloseTo(1, 6);
      expect(basicWeight).toBeGreaterThanOrEqual(0.05);

      // each boss gets full bossTotalHp (not divided)
      const perBossHp = waveConfig.bossTotalHp / waveConfig.bosses.length;
      const baseTotalHp = getWave(14).bossTotalHp ?? 0;
      const wavesBeyond = waveNumber - 14;
      const expectedPerBoss = baseTotalHp + wavesBeyond * 150;
      expect(perBossHp).toBe(expectedPerBoss);
    }
  });
});
