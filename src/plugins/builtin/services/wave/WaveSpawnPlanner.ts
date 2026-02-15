import Phaser from 'phaser';
import { MIN_BOSS_DISTANCE, MIN_DISH_DISTANCE, SPAWN_AREA } from '../../../../data/constants';
import type { DishTypeWeight } from '../../../../data/types/waves';
import type { Entity } from '../../../../entities/Entity';
import type { ObjectPool } from '../../../../utils/ObjectPool';
import type { WaveRuntimeConfig } from './WaveConfigResolver';

interface BossPositionSnapshot {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

interface WaveSpawnPlannerDeps {
  getDishPool: () => ObjectPool<Entity>;
  getMaxSpawnY: () => number;
  getBosses: () => BossPositionSnapshot[];
  getActiveCountByType?: (type: string) => number;
}

export interface PlannedDishSpawn {
  type: string;
  x: number;
  y: number;
  speedMultiplier: number;
}

export class WaveSpawnPlanner {
  private readonly getDishPool: () => ObjectPool<Entity>;
  private readonly getMaxSpawnY: () => number;
  private readonly getBosses: () => BossPositionSnapshot[];
  private readonly getActiveCountByType?: (type: string) => number;

  constructor(deps: WaveSpawnPlannerDeps) {
    this.getDishPool = deps.getDishPool;
    this.getMaxSpawnY = deps.getMaxSpawnY;
    this.getBosses = deps.getBosses;
    this.getActiveCountByType = deps.getActiveCountByType;
  }

  public planDishSpawn(
    waveConfig: WaveRuntimeConfig,
    currentWave: number,
    isFeverTime: boolean
  ): PlannedDishSpawn | null {
    const type = this.selectDishType(waveConfig.dishTypes);
    if (!type) return null;

    const position = this.findValidSpawnPosition(waveConfig.bossSpawnMinDistance);
    if (!position) return null;

    return {
      type,
      x: position.x,
      y: position.y,
      speedMultiplier: isFeverTime ? 2.5 : 1 + (currentWave - 1) * 0.1,
    };
  }

  private findValidSpawnPosition(minBossDistanceConfig: number): { x: number; y: number } | null {
    const activeDishes = this.getDishPool().getActiveObjects();
    const bosses = this.getBosses();
    const maxAttempts = 20;
    const maxY = this.getMaxSpawnY();
    const minBossDistance = Math.max(MIN_BOSS_DISTANCE, minBossDistanceConfig);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Phaser.Math.Between(SPAWN_AREA.minX, SPAWN_AREA.maxX);
      const y = Phaser.Math.Between(SPAWN_AREA.minY, maxY);

      let isValid = true;

      for (const boss of bosses) {
        if (!boss.visible) continue;
        const distanceToBoss = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
        if (distanceToBoss < minBossDistance) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        for (const dish of activeDishes) {
          const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
          if (distance < MIN_DISH_DISTANCE) {
            isValid = false;
            break;
          }
        }
      }

      if (isValid) {
        return { x, y };
      }
    }

    return null;
  }

  private selectDishType(types: DishTypeWeight[]): string | null {
    const getCount = this.getActiveCountByType;
    const eligible = getCount
      ? types.filter(t => t.maxActive == null || getCount(t.type) < t.maxActive)
      : types;

    if (eligible.length === 0) return null;

    const totalWeight = eligible.reduce((sum, t) => sum + t.weight, 0);
    if (totalWeight <= 0) return eligible[0].type;

    let random = Math.random() * totalWeight;
    for (const dishType of eligible) {
      random -= dishType.weight;
      if (random <= 0) {
        return dishType.type;
      }
    }

    return eligible[0].type;
  }
}
