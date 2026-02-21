import { Data } from '../../../../data/DataManager';
import type { DishTypeWeight, SpaceshipWaveConfig, WaveBossConfig, WaveLaserConfig } from '../../../../data/types/waves';
import { resolveWaveBossConfig } from '../waveBossConfig';

export interface WaveRuntimeConfig {
  spawnInterval: number;
  minDishCount: number;
  dishTypes: DishTypeWeight[];
  spaceship?: SpaceshipWaveConfig;
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
        spaceship: waveData.spaceship,
        laser: waveData.laser,
        bosses: bossConfig.bosses,
        bossTotalHp: bossConfig.bossTotalHp,
        bossSpawnMinDistance: bossConfig.bossSpawnMinDistance,
      };
    }

    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    const laserCfg = scaling.laserScaling;
    const laserCount = laserCfg?.baseMaxCount ?? 4;
    const minInterval = Math.max(
      laserCfg?.minMinInterval ?? 1500,
      (laserCfg?.baseMinInterval ?? 1800) - wavesBeyond * (laserCfg?.minIntervalReduction ?? 50)
    );
    const maxInterval = Math.max(
      laserCfg?.minMaxInterval ?? 3000,
      (laserCfg?.baseMaxInterval ?? 4000) - wavesBeyond * (laserCfg?.maxIntervalReduction ?? 100)
    );

    const minDishCount = Math.min(
      scaling.maxMinDishCount,
      waveData.dishCount + wavesBeyond * scaling.minDishCountIncrease
    );

    const spaceshipScaling = scaling.spaceshipScaling;
    const spaceshipConfig: SpaceshipWaveConfig | undefined = spaceshipScaling
      ? {
          maxActive: spaceshipScaling.maxActive,
          spawnInterval: Math.max(
            spaceshipScaling.minSpawnInterval ?? 2500,
            spaceshipScaling.spawnInterval - wavesBeyond * (spaceshipScaling.spawnIntervalReduction ?? 0),
          ),
        }
      : waveData.spaceship;

    return {
      spawnInterval: Math.max(
        scaling.minSpawnInterval,
        waveData.spawnInterval - wavesBeyond * scaling.spawnIntervalReduction
      ),
      minDishCount,
      dishTypes: this.getScaledDishTypes(waveNumber),
      spaceship: spaceshipConfig,
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

  private getScaledDishTypes(waveNumber: number): DishTypeWeight[] {
    const wavesData = Data.waves;
    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    const lastWave = wavesData.waves[wavesData.waves.length - 1];
    const baseWeights = new Map(lastWave.dishTypes.map((dish) => [dish.type, dish.weight]));

    // dishTypeScaling 배열이 있으면 데이터 주도 방식 사용
    const dishTypeScaling = scaling.dishTypeScaling;
    if (dishTypeScaling && dishTypeScaling.length > 0) {
      return this.getScaledDishTypesFromData(wavesBeyond, baseWeights, dishTypeScaling, scaling);
    }

    // 레거시 하드코딩 폴백
    return this.getScaledDishTypesLegacy(wavesBeyond, baseWeights, scaling);
  }

  private getScaledDishTypesFromData(
    wavesBeyond: number,
    baseWeights: Map<string, number>,
    dishTypeScaling: ReadonlyArray<{
      type: string;
      baseWeightFallback?: number;
      weightPerWave?: number;
      maxWeight?: number;
      minWeight?: number;
      startWaveOffset?: number;
      startWeight?: number;
      maxActive?: number;
    }>,
    scaling: typeof Data.waves.infiniteScaling
  ): DishTypeWeight[] {
    const remainderType = scaling.remainderType ?? 'basic';
    const remainderMinWeight = scaling.remainderMinWeight ?? 0.05;

    const scaledTypes: DishTypeWeight[] = [];

    for (const entry of dishTypeScaling) {
      const baseWeight = baseWeights.get(entry.type) ?? (entry.baseWeightFallback ?? 0);

      let weight: number;

      if (entry.startWaveOffset !== undefined) {
        // 지연 시작 스케일링 (amber 패턴)
        const offset = Math.max(1, Math.floor(entry.startWaveOffset));
        const progress = wavesBeyond - offset;
        if (progress < 0) {
          weight = 0;
        } else {
          const startWeight = entry.startWeight ?? 0;
          const perWave = entry.weightPerWave ?? 0;
          weight = Math.max(0, startWeight + progress * perWave);
        }
      } else {
        // 선형 스케일링
        const perWave = entry.weightPerWave ?? 0;
        weight = baseWeight + wavesBeyond * perWave;
      }

      // clamp
      if (entry.maxWeight !== undefined) {
        weight = Math.min(entry.maxWeight, weight);
      }
      if (entry.minWeight !== undefined) {
        weight = Math.max(entry.minWeight, weight);
      }

      scaledTypes.push({
        type: entry.type,
        weight: Math.max(0, weight),
        ...(entry.maxActive != null ? { maxActive: entry.maxActive } : {}),
      });
    }

    // 나머지 타입 (basic 등)으로 1.0 채우기
    let nonRemainderSum = scaledTypes.reduce((sum, t) => sum + t.weight, 0);
    const maxNonRemainderSum = 1 - remainderMinWeight;

    if (nonRemainderSum > maxNonRemainderSum && nonRemainderSum > 0) {
      const scale = maxNonRemainderSum / nonRemainderSum;
      scaledTypes.forEach((t) => {
        t.weight *= scale;
      });
      nonRemainderSum = scaledTypes.reduce((sum, t) => sum + t.weight, 0);
    }

    const dishTypes = [
      { type: remainderType, weight: Math.max(remainderMinWeight, 1 - nonRemainderSum) },
      ...scaledTypes,
    ];

    const totalWeight = dishTypes.reduce((sum, t) => sum + t.weight, 0);
    if (totalWeight <= 0) {
      return [{ type: remainderType, weight: 1 }];
    }

    return dishTypes.map((t) => ({
      type: t.type,
      weight: t.weight / totalWeight,
    }));
  }

  private getScaledDishTypesLegacy(
    wavesBeyond: number,
    baseWeights: Map<string, number>,
    scaling: typeof Data.waves.infiniteScaling
  ): DishTypeWeight[] {
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

    const amberStartWaveOffset = Math.max(1, Math.floor(scaling.amberStartWaveOffset));
    const amberWaveProgress = wavesBeyond - amberStartWaveOffset;
    const amberWeight =
      amberWaveProgress < 0
        ? 0
        : Math.min(
            scaling.maxAmberWeight,
            Math.max(0, scaling.amberStartWeight + amberWaveProgress * scaling.amberWeightIncrease)
          );

    const minBasicWeight = 0.05;
    const nonBasicTypes = [
      { type: 'golden', weight: goldenWeight },
      { type: 'crystal', weight: crystalWeight },
      { type: 'bomb', weight: bombWeight },
      { type: 'amber', weight: amberWeight },
    ];

    let nonBasicSum = nonBasicTypes.reduce((sum, dishType) => sum + dishType.weight, 0);
    const maxNonBasicSum = 1 - minBasicWeight;
    if (nonBasicSum > maxNonBasicSum && nonBasicSum > 0) {
      const scale = maxNonBasicSum / nonBasicSum;
      nonBasicTypes.forEach((dishType) => {
        dishType.weight *= scale;
      });
      nonBasicSum = nonBasicTypes.reduce((sum, dishType) => sum + dishType.weight, 0);
    }

    const dishTypes = [{ type: 'basic', weight: Math.max(minBasicWeight, 1 - nonBasicSum) }, ...nonBasicTypes];
    const totalWeight = dishTypes.reduce((sum, dishType) => sum + dishType.weight, 0);

    if (totalWeight <= 0) {
      return [
        { type: 'basic', weight: 1 },
        { type: 'golden', weight: 0 },
        { type: 'crystal', weight: 0 },
        { type: 'bomb', weight: 0 },
        { type: 'amber', weight: 0 },
      ];
    }

    return dishTypes.map((dishType) => ({
      type: dishType.type,
      weight: dishType.weight / totalWeight,
    }));
  }
}
