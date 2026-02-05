import Phaser from 'phaser';
import { SPAWN_AREA, MIN_DISH_DISTANCE, WAVE_TRANSITION } from '../data/constants';
import { Data } from '../data/DataManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { Dish } from '../entities/Dish';

type WavePhase = 'waiting' | 'countdown' | 'spawning';

interface WaveConfig {
  spawnInterval: number;
  dishTypes: { type: string; weight: number }[];
}

export class WaveSystem {
  private scene: Phaser.Scene;
  private currentWave: number = 0;
  private timeSinceLastSpawn: number = 0;
  private waveConfig: WaveConfig | null = null;
  private isFeverTime: boolean = false;
  private totalGameTime: number = 0;
  private getDishPool: () => ObjectPool<Dish>;
  private getMaxSpawnY: () => number;

  private wavePhase: WavePhase = 'waiting';
  private countdownTimer: number = 0;
  private pendingWaveNumber: number = 1;

  constructor(scene: Phaser.Scene, getDishPool: () => ObjectPool<Dish>, getMaxSpawnY?: () => number) {
    this.scene = scene;
    this.getDishPool = getDishPool;
    this.getMaxSpawnY = getMaxSpawnY || (() => SPAWN_AREA.maxY);
  }

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.timeSinceLastSpawn = 0;
    this.wavePhase = 'spawning';

    this.waveConfig = this.getScaledWaveConfig(waveNumber);

    EventBus.getInstance().emit(GameEvents.WAVE_STARTED, waveNumber);
  }

  private getScaledWaveConfig(waveNumber: number): WaveConfig {
    const wavesData = Data.waves;
    const waveIndex = Math.min(waveNumber - 1, wavesData.waves.length - 1);
    const waveData = wavesData.waves[waveIndex];

    if (waveNumber <= wavesData.waves.length) {
      return {
        spawnInterval: waveData.spawnInterval,
        dishTypes: waveData.dishTypes,
      };
    }

    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    return {
      spawnInterval: Math.max(
        scaling.minSpawnInterval,
        waveData.spawnInterval - wavesBeyond * scaling.spawnIntervalReduction
      ),
      dishTypes: this.getScaledDishTypes(waveNumber),
    };
  }

  private getScaledDishTypes(waveNumber: number): { type: string; weight: number }[] {
    const wavesData = Data.waves;
    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    const bombWeight = Math.min(scaling.maxBombWeight, 0.25 + wavesBeyond * scaling.bombWeightIncrease);
    const crystalWeight = 0.3;
    const goldenWeight = Math.max(scaling.minGoldenWeight, 0.35 - wavesBeyond * scaling.goldenWeightDecrease);
    const basicWeight = Math.max(0.05, 1 - bombWeight - crystalWeight - goldenWeight);

    return [
      { type: 'basic', weight: basicWeight },
      { type: 'golden', weight: goldenWeight },
      { type: 'crystal', weight: crystalWeight },
      { type: 'bomb', weight: bombWeight },
    ];
  }

  startCountdown(waveNumber: number): void {
    this.pendingWaveNumber = waveNumber;
    this.wavePhase = 'countdown';
    this.countdownTimer = WAVE_TRANSITION.COUNTDOWN_DURATION;
    EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_START, waveNumber);
  }

  startFeverTime(): void {
    this.isFeverTime = true;
    const feverData = Data.waves.fever;
    this.waveConfig = {
      spawnInterval: feverData.spawnInterval,
      dishTypes: feverData.dishTypes,
    };
    this.timeSinceLastSpawn = 0;
  }

  getWavePhase(): WavePhase {
    return this.wavePhase;
  }

  update(delta: number): void {
    this.totalGameTime += delta;

    if (this.wavePhase === 'countdown') {
      const prevSecond = Math.ceil(this.countdownTimer / 1000);
      this.countdownTimer -= delta;
      const currentSecond = Math.ceil(this.countdownTimer / 1000);

      if (prevSecond !== currentSecond && currentSecond >= 0) {
        EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_TICK, currentSecond);
      }

      if (this.countdownTimer <= 0) {
        this.wavePhase = 'spawning';
        this.startWave(this.pendingWaveNumber);
        EventBus.getInstance().emit(GameEvents.WAVE_READY);
      }
      return;
    }

    if (this.wavePhase !== 'spawning') return;

    if (!this.waveConfig) return;

    this.timeSinceLastSpawn += delta;

    const activeCount = this.getDishPool().getActiveCount();
    const dynamicSpawn = Data.spawn.dynamicSpawn;
    let effectiveInterval = this.waveConfig.spawnInterval;

    if (activeCount < dynamicSpawn.minActiveDishes) {
      effectiveInterval = Math.min(effectiveInterval, dynamicSpawn.emergencyInterval);
    } else if (activeCount < dynamicSpawn.minActiveDishes + 2) {
      effectiveInterval = Math.min(effectiveInterval, dynamicSpawn.lowActiveInterval);
    }

    if (this.timeSinceLastSpawn >= effectiveInterval) {
      this.spawnDish();
      this.timeSinceLastSpawn = 0;
    }
  }

  private spawnDish(): void {
    if (!this.waveConfig) return;

    const position = this.findValidSpawnPosition();
    if (!position) return;

    const type = this.selectDishType(this.waveConfig.dishTypes);

    const { x, y } = position;

    const speedMultiplier = this.isFeverTime ? 2.5 : 1 + (this.currentWave - 1) * 0.1;

    const gameScene = this.scene as unknown as { spawnDish: (type: string, x: number, y: number, speedMultiplier: number) => void };
    gameScene.spawnDish(type, x, y, speedMultiplier);
  }

  private findValidSpawnPosition(): { x: number; y: number } | null {
    const activeDishes = this.getDishPool().getActiveObjects();
    const maxAttempts = 20;
    const maxY = this.getMaxSpawnY();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Phaser.Math.Between(SPAWN_AREA.minX, SPAWN_AREA.maxX);
      const y = Phaser.Math.Between(SPAWN_AREA.minY, maxY);

      let isValid = true;
      for (const dish of activeDishes) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < MIN_DISH_DISTANCE) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        return { x, y };
      }
    }

    return null;
  }

  getActiveDishCount(): number {
    return this.getDishPool().getActiveCount();
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

  forceCompleteWave(): void {
    this.wavePhase = 'waiting';
    EventBus.getInstance().emit(GameEvents.WAVE_COMPLETED, this.currentWave);
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  isFever(): boolean {
    return this.isFeverTime;
  }

  getTotalTime(): number {
    return this.totalGameTime;
  }
}
