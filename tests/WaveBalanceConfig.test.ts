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
  it('locks wave 7~8 to basic/golden/bomb without crystal', () => {
    expect(getWave(7).dishTypes).toEqual([
      { type: 'basic', weight: 0.72 },
      { type: 'golden', weight: 0.18 },
      { type: 'bomb', weight: 0.1 },
    ]);
    expect(getWave(8).dishTypes).toEqual([
      { type: 'basic', weight: 0.62 },
      { type: 'golden', weight: 0.23 },
      { type: 'bomb', weight: 0.15 },
    ]);
    expect(getWeight(7, 'crystal')).toBe(0);
    expect(getWeight(8, 'crystal')).toBe(0);
  });

  it('reintroduces crystal at wave 9 and reduces bomb vs wave 8', () => {
    expect(getWeight(9, 'crystal')).toBeGreaterThan(0);
    expect(getWeight(9, 'bomb')).toBeLessThan(getWeight(8, 'bomb'));
    expect(getWave(9).dishTypes).toEqual([
      { type: 'basic', weight: 0.48 },
      { type: 'golden', weight: 0.3 },
      { type: 'crystal', weight: 0.1 },
      { type: 'bomb', weight: 0.12 },
    ]);
  });

  it('matches wave 10~12 pacing, dish mix, boss hp, and laser specs', () => {
    expect(getWave(9).bosses).toHaveLength(1);

    expect(getWave(10).spawnInterval).toBe(820);
    expect(getWave(10).bossTotalHp).toBe(1900);
    expect(getWave(10).dishTypes).toEqual([
      { type: 'basic', weight: 0.48 },
      { type: 'golden', weight: 0.3 },
      { type: 'crystal', weight: 0.1 },
      { type: 'bomb', weight: 0.12 },
    ]);
    expect(getWeight(10, 'amber')).toBe(0);
    expect(getWave(10).bosses).toHaveLength(2);
    expect(getWave(10).laser).toEqual({ maxCount: 2, minInterval: 3400, maxInterval: 6200 });
    expect(getWave(10).bosses?.map((boss) => boss.laser)).toEqual([
      { maxCount: 1, minInterval: 3400, maxInterval: 6200 },
      { maxCount: 1, minInterval: 3400, maxInterval: 6200 },
    ]);

    expect(getWave(11).spawnInterval).toBe(800);
    expect(getWave(11).bossTotalHp).toBe(2100);
    expect(getWave(11).dishTypes).toEqual([
      { type: 'basic', weight: 0.46 },
      { type: 'golden', weight: 0.28 },
      { type: 'crystal', weight: 0.12 },
      { type: 'bomb', weight: 0.14 },
    ]);
    expect(getWeight(11, 'amber')).toBe(0);
    expect(getWave(11).bosses).toHaveLength(2);
    expect(getWave(11).laser).toEqual({ maxCount: 2, minInterval: 3400, maxInterval: 6200 });
    expect(getWave(11).bosses?.map((boss) => boss.laser)).toEqual([
      { maxCount: 1, minInterval: 3400, maxInterval: 6200 },
      { maxCount: 1, minInterval: 3400, maxInterval: 6200 },
    ]);

    expect(getWave(12).spawnInterval).toBe(780);
    expect(getWave(12).bossTotalHp).toBe(2400);
    expect(getWave(12).dishTypes).toEqual([
      { type: 'basic', weight: 0.44 },
      { type: 'golden', weight: 0.26 },
      { type: 'crystal', weight: 0.14 },
      { type: 'bomb', weight: 0.16 },
    ]);
    expect(getWeight(12, 'amber')).toBe(0);
    expect(getWave(12).bosses).toHaveLength(2);
    expect(getWave(12).bosses?.some((boss) => boss.id === 'boss_center')).toBe(false);
    expect(getWave(12).laser).toEqual({ maxCount: 2, minInterval: 3400, maxInterval: 6200 });
    expect(getWave(12).bosses?.map((boss) => boss.laser)).toEqual([
      { maxCount: 1, minInterval: 3400, maxInterval: 6200 },
      { maxCount: 1, minInterval: 3400, maxInterval: 6200 },
    ]);
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

  it('introduces amber from wave 13 while keeping infinite waves normalized with two bosses', () => {
    const resolver = new WaveConfigResolver();
    const wave13Config = resolver.resolveWaveConfig(13);
    const wave13AmberWeight =
      wave13Config.dishTypes.find((dishType) => dishType.type === 'amber')?.weight ?? 0;

    expect(wave13AmberWeight).toBeGreaterThan(0);
    expect(wave13Config.bosses).toHaveLength(2);

    for (let waveNumber = 13; waveNumber <= 30; waveNumber++) {
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
