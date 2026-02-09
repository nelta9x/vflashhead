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
  it('has 15 predefined waves with tempo pattern', () => {
    expect(Data.waves.waves).toHaveLength(15);
  });

  it('introduces bomb at wave 9 and crystal at wave 12', () => {
    for (let w = 1; w <= 8; w++) {
      expect(getWeight(w, 'bomb')).toBe(0);
    }
    expect(getWeight(9, 'bomb')).toBeGreaterThan(0);

    for (let w = 1; w <= 11; w++) {
      expect(getWeight(w, 'crystal')).toBe(0);
    }
    expect(getWeight(12, 'crystal')).toBeGreaterThan(0);
  });

  it('uses mini dishes in recovery waves for combo learning', () => {
    expect(getWeight(2, 'mini')).toBe(0.2);
    expect(getWeight(5, 'mini')).toBe(0.15);
    expect(getWeight(8, 'mini')).toBe(0.35);
    expect(getWeight(11, 'mini')).toBe(0.3);
    expect(getWeight(14, 'mini')).toBe(0.3);
  });

  it('recovery waves have lower dish count and higher golden ratio than adjacent pressure waves', () => {
    expect(getWave(5).dishCount).toBeLessThan(getWave(4).dishCount);
    expect(getWeight(5, 'golden')).toBeGreaterThan(getWeight(4, 'golden'));

    expect(getWave(8).dishCount).toBeLessThan(getWave(7).dishCount);
    expect(getWeight(8, 'golden')).toBeGreaterThan(getWeight(7, 'golden'));

    expect(getWave(11).dishCount).toBeLessThan(getWave(10).dishCount);
    expect(getWeight(11, 'golden')).toBeGreaterThan(getWeight(10, 'golden'));

    expect(getWave(14).dishCount).toBeLessThan(getWave(13).dishCount);
    expect(getWeight(14, 'golden')).toBeGreaterThan(getWeight(13, 'golden'));
  });

  it('only wave 15 has two bosses among predefined waves', () => {
    for (let w = 1; w <= 14; w++) {
      expect(getWave(w).bosses).toHaveLength(1);
    }
    expect(getWave(15).bosses).toHaveLength(2);
    expect(getWave(15).bosses?.some((boss) => boss.id === 'boss_left')).toBe(true);
    expect(getWave(15).bosses?.some((boss) => boss.id === 'boss_right')).toBe(true);
  });

  it('wave 13 introduces dual laser (maxCount 2)', () => {
    for (let w = 1; w <= 12; w++) {
      expect(getWave(w).laser?.maxCount ?? 0).toBeLessThanOrEqual(1);
    }
    expect(getWave(13).laser?.maxCount).toBe(2);
  });

  it('matches infinite scaling rebalance values', () => {
    expect(Data.waves.infiniteScaling).toEqual({
      spawnIntervalReduction: 5,
      minSpawnInterval: 640,
      bombWeightIncrease: 0.002,
      maxBombWeight: 0.18,
      goldenWeightDecrease: 0.002,
      minGoldenWeight: 0.16,
      bossHpIncrease: 150,
      bossTotalHpIncrease: 150,
      infiniteBossCount: 2,
      minDishCountIncrease: 0,
      maxMinDishCount: 7,
      amberStartWaveOffset: 1,
      amberStartWeight: 0.02,
      amberWeightIncrease: 0.02,
      maxAmberWeight: 0.16,
    });
  });

  it('introduces amber from wave 16 while keeping infinite waves normalized with two bosses', () => {
    const resolver = new WaveConfigResolver();
    const wave16Config = resolver.resolveWaveConfig(16);
    const wave16AmberWeight =
      wave16Config.dishTypes.find((dishType) => dishType.type === 'amber')?.weight ?? 0;

    expect(wave16AmberWeight).toBeGreaterThan(0);
    expect(wave16Config.bosses).toHaveLength(2);

    for (let waveNumber = 16; waveNumber <= 30; waveNumber++) {
      const waveConfig = resolver.resolveWaveConfig(waveNumber);
      const totalWeight = waveConfig.dishTypes.reduce((sum, dishType) => sum + dishType.weight, 0);
      const basicWeight =
        waveConfig.dishTypes.find((dishType) => dishType.type === 'basic')?.weight ?? 0;

      expect(waveConfig.bosses).toHaveLength(2);
      expect(totalWeight).toBeCloseTo(1, 6);
      expect(basicWeight).toBeGreaterThanOrEqual(0.05);
    }
  });
});
