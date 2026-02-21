import { Data } from '../../../data/DataManager';
import type { WaveBossConfig, WaveData, WaveLaserConfig } from '../../../data/types';

export interface ResolvedWaveBossConfig {
  waveNumber: number;
  bossTotalHp: number;
  bosses: WaveBossConfig[];
  bossSpawnMinDistance: number;
}

const FALLBACK_LASER_CONFIG: WaveLaserConfig = {
  maxCount: 0,
  minInterval: 999999,
  maxInterval: 999999,
};

function sanitizeLaserConfig(
  laser?: Partial<WaveLaserConfig>,
  fallback?: WaveLaserConfig
): WaveLaserConfig {
  const source = laser ?? fallback ?? FALLBACK_LASER_CONFIG;

  const minInterval = Math.max(1, Math.floor(source.minInterval ?? FALLBACK_LASER_CONFIG.minInterval));
  const maxInterval = Math.max(minInterval, Math.floor(source.maxInterval ?? minInterval));

  return {
    maxCount: Math.max(0, Math.floor(source.maxCount ?? 0)),
    minInterval,
    maxInterval,
  };
}

function cloneBossConfig(boss: WaveBossConfig): WaveBossConfig {
  return {
    id: boss.id,
    entityTypeId: boss.entityTypeId,
    hpWeight: Math.max(0, boss.hpWeight),
    spawnRange: {
      minX: boss.spawnRange.minX,
      maxX: boss.spawnRange.maxX,
      minY: boss.spawnRange.minY,
      maxY: boss.spawnRange.maxY,
    },
    laser: sanitizeLaserConfig(boss.laser),
    attacks: boss.attacks
      ? {
          bulletSpread: boss.attacks.bulletSpread
            ? { ...boss.attacks.bulletSpread }
            : undefined,
          dangerZone: boss.attacks.dangerZone ? { ...boss.attacks.dangerZone } : undefined,
        }
      : undefined,
  };
}

function getWaveBossTotalHp(waveData: WaveData): number {
  const totalHp = waveData.bossTotalHp ?? waveData.bossHp ?? 1;
  return Math.max(1, Math.floor(totalHp));
}

function buildFallbackSingleBoss(waveData: WaveData): WaveBossConfig {
  const centerX = Math.floor((Data.gameConfig?.screen?.width ?? 1280) / 2);
  const spawnY = Math.floor(Data.boss?.spawn?.y ?? 100);
  const fallbackEntityTypeId = Data.boss?.defaultEntityTypeId ?? 'gatekeeper_spaceship';
  return {
    id: 'boss_center',
    entityTypeId: fallbackEntityTypeId,
    hpWeight: 1,
    spawnRange: {
      minX: centerX,
      maxX: centerX,
      minY: spawnY,
      maxY: spawnY,
    },
    laser: sanitizeLaserConfig(waveData.laser),
  };
}

function getWaveBosses(waveData: WaveData): WaveBossConfig[] {
  if (!waveData.bosses || waveData.bosses.length === 0) {
    return [buildFallbackSingleBoss(waveData)];
  }
  return waveData.bosses.map(cloneBossConfig);
}

function resolveInfiniteBossTemplate(baseBosses: WaveBossConfig[], count: number): WaveBossConfig[] {
  if (baseBosses.length === 0) {
    return [buildFallbackSingleBoss({ number: 0, name: '', dishCount: 0, spawnInterval: 0, dishTypes: [] })];
  }

  const targetCount = Math.max(1, Math.floor(count));
  if (targetCount <= baseBosses.length) {
    return baseBosses.slice(0, targetCount).map(cloneBossConfig);
  }

  const expanded = baseBosses.map(cloneBossConfig);
  const template = baseBosses[baseBosses.length - 1];
  for (let i = baseBosses.length; i < targetCount; i++) {
    expanded.push({
      ...cloneBossConfig(template),
      id: `${template.id}_${i + 1}`,
    });
  }
  return expanded;
}

export function resolveWaveBossConfig(waveNumber: number): ResolvedWaveBossConfig {
  const wavesData = Data.waves;
  const waveIndex = Math.min(Math.max(0, waveNumber - 1), wavesData.waves.length - 1);
  const waveData = wavesData.waves[waveIndex];

  if (waveNumber <= wavesData.waves.length) {
    return {
      waveNumber,
      bossTotalHp: getWaveBossTotalHp(waveData),
      bosses: getWaveBosses(waveData),
      bossSpawnMinDistance: Math.max(
        0,
        Math.floor(waveData.bossSpawnMinDistance ?? Data.spawn?.minBossDistance ?? 150)
      ),
    };
  }

  const wavesBeyond = waveNumber - wavesData.waves.length;
  const baseWave = wavesData.waves[wavesData.waves.length - 1];
  const scaling = wavesData.infiniteScaling;

  const hpIncrease = Math.max(
    0,
    Math.floor(scaling.bossTotalHpIncrease ?? scaling.bossHpIncrease ?? 0)
  );
  const baseBossTotalHp = getWaveBossTotalHp(baseWave);
  const baseBosses = getWaveBosses(baseWave);
  const infiniteBossCount = Math.max(
    1,
    Math.floor(scaling.infiniteBossCount ?? baseBosses.length)
  );

  const bosses =
    scaling.infiniteBossTemplate && scaling.infiniteBossTemplate.length > 0
      ? scaling.infiniteBossTemplate.map(cloneBossConfig)
      : resolveInfiniteBossTemplate(baseBosses, infiniteBossCount);

  const perBossHp = Math.max(1, baseBossTotalHp + wavesBeyond * hpIncrease);
  const effectiveTotalHp = scaling.infiniteBossFullHp
    ? perBossHp * bosses.length
    : perBossHp;

  return {
    waveNumber,
    bossTotalHp: effectiveTotalHp,
    bosses,
    bossSpawnMinDistance: Math.max(
      0,
      Math.floor(baseWave.bossSpawnMinDistance ?? Data.spawn?.minBossDistance ?? 150)
    ),
  };
}

export function splitBossTotalHpByWeight(
  totalHp: number,
  bosses: WaveBossConfig[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (bosses.length === 0) {
    return result;
  }

  const totalBosses = bosses.length;
  const normalizedTotalHp = Math.max(totalBosses, Math.floor(totalHp));
  const normalizedWeights = bosses.map((boss) => Math.max(0, boss.hpWeight));
  const weightSum = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const fallbackWeight = 1 / totalBosses;

  let remainingHp = normalizedTotalHp;
  for (let i = 0; i < totalBosses; i++) {
    const boss = bosses[i];
    const remainingBosses = totalBosses - i;

    if (i === totalBosses - 1) {
      result.set(boss.id, remainingHp);
      break;
    }

    const ratio = weightSum > 0 ? normalizedWeights[i] / weightSum : fallbackWeight;
    const tentative = Math.floor(normalizedTotalHp * ratio);
    const maxAllowed = remainingHp - (remainingBosses - 1);
    const assignedHp = Math.max(1, Math.min(maxAllowed, tentative));
    result.set(boss.id, assignedHp);
    remainingHp -= assignedHp;
  }

  return result;
}
