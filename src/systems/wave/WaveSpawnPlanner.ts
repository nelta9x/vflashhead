import Phaser from 'phaser';
import { MIN_BOSS_DISTANCE, MIN_DISH_DISTANCE, SPAWN_AREA } from '../../data/constants';
import type { Dish } from '../../entities/Dish';
import type { ObjectPool } from '../../utils/ObjectPool';
import type { WaveRuntimeConfig } from './WaveConfigResolver';

interface BossPositionSnapshot {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

interface WaveSpawnPlannerDeps {
  getDishPool: () => ObjectPool<Dish>;
  getMaxSpawnY: () => number;
  getBosses: () => BossPositionSnapshot[];
}

export interface PlannedDishSpawn {
  type: string;
  x: number;
  y: number;
  speedMultiplier: number;
}

export class WaveSpawnPlanner {
  private readonly getDishPool: () => ObjectPool<Dish>;
  private readonly getMaxSpawnY: () => number;
  private readonly getBosses: () => BossPositionSnapshot[];

  constructor(deps: WaveSpawnPlannerDeps) {
    this.getDishPool = deps.getDishPool;
    this.getMaxSpawnY = deps.getMaxSpawnY;
    this.getBosses = deps.getBosses;
  }

  public planDishSpawn(
    waveConfig: WaveRuntimeConfig,
    currentWave: number,
    isFeverTime: boolean
  ): PlannedDishSpawn | null {
    const position = this.findValidSpawnPosition(waveConfig.bossSpawnMinDistance);
    if (!position) return null;

    return {
      type: this.selectDishType(waveConfig.dishTypes),
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

  private selectDishType(types: { type: string; weight: number }[]): string {
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (const dishType of types) {
      random -= dishType.weight;
      if (random <= 0) {
        return dishType.type;
      }
    }

    return types[0].type;
  }
}
