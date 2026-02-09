import { Data } from '../../data/DataManager';
import type { WaveBossConfig, WaveLaserConfig } from '../../data/types/waves';
import { resolveWaveBossConfig } from '../waveBossConfig';

export interface WaveRuntimeConfig {
  spawnInterval: number;
  minDishCount: number;
  dishTypes: { type: string; weight: number }[];
  laser?: WaveLaserConfig;
  bosses: WaveBossConfig[];
  bossTotalHp: number;
  bossSpawnMinDistance: number;
}

export class WaveConfigResolver {
  public resolveWaveConfig(waveNumber: number): WaveRuntimeConfig {
    const wavesData = Data.waves;
    const waveIndex = Math.min(waveNumber - 1, wavesData.waves.length - 1);
    const waveData = wavesData.waves[waveIndex];
    const bossConfig = resolveWaveBossConfig(waveNumber);

    if (waveNumber <= wavesData.waves.length) {
      return {
        spawnInterval: waveData.spawnInterval,
        minDishCount: waveData.dishCount,
        dishTypes: waveData.dishTypes,
        laser: waveData.laser,
        bosses: bossConfig.bosses,
        bossTotalHp: bossConfig.bossTotalHp,
        bossSpawnMinDistance: bossConfig.bossSpawnMinDistance,
      };
    }

    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    const laserCount = 4;
    const minInterval = Math.max(1500, 1800 - wavesBeyond * 50);
    const maxInterval = Math.max(3000, 4000 - wavesBeyond * 100);

    const minDishCount = Math.min(
      scaling.maxMinDishCount,
      waveData.dishCount + wavesBeyond * scaling.minDishCountIncrease
    );

    return {
      spawnInterval: Math.max(
        scaling.minSpawnInterval,
        waveData.spawnInterval - wavesBeyond * scaling.spawnIntervalReduction
      ),
      minDishCount,
      dishTypes: this.getScaledDishTypes(waveNumber),
      laser: { maxCount: laserCount, minInterval, maxInterval },
      bosses: bossConfig.bosses,
      bossTotalHp: bossConfig.bossTotalHp,
      bossSpawnMinDistance: bossConfig.bossSpawnMinDistance,
    };
  }

  public resolveFeverConfig(currentWave: number): WaveRuntimeConfig {
    const feverData = Data.waves.fever;
    const lastWaveBossConfig = resolveWaveBossConfig(currentWave > 0 ? currentWave : 1);
    return {
      spawnInterval: feverData.spawnInterval,
      minDishCount: feverData.dishCount,
      dishTypes: feverData.dishTypes,
      bosses: lastWaveBossConfig.bosses,
      bossTotalHp: lastWaveBossConfig.bossTotalHp,
      bossSpawnMinDistance: lastWaveBossConfig.bossSpawnMinDistance,
    };
  }

  private getScaledDishTypes(waveNumber: number): { type: string; weight: number }[] {
    const wavesData = Data.waves;
    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    const lastWave = wavesData.waves[wavesData.waves.length - 1];
    const baseWeights = new Map(lastWave.dishTypes.map((dish) => [dish.type, dish.weight]));

    const baseBombWeight = baseWeights.get('bomb') ?? 0.25;
    const baseCrystalWeight = baseWeights.get('crystal') ?? 0.3;
    const baseGoldenWeight = baseWeights.get('golden') ?? 0.25;

    const bombWeight = Math.min(
      scaling.maxBombWeight,
      baseBombWeight + wavesBeyond * scaling.bombWeightIncrease
    );
    const crystalWeight = baseCrystalWeight;
    const goldenWeight = Math.max(
      scaling.minGoldenWeight,
      baseGoldenWeight - wavesBeyond * scaling.goldenWeightDecrease
    );
    const basicWeight = Math.max(0.05, 1 - bombWeight - crystalWeight - goldenWeight);

    return [
      { type: 'basic', weight: basicWeight },
      { type: 'golden', weight: goldenWeight },
      { type: 'crystal', weight: crystalWeight },
      { type: 'bomb', weight: bombWeight },
    ];
  }
}
