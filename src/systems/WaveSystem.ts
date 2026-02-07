import Phaser from 'phaser';
import {
  SPAWN_AREA,
  MIN_DISH_DISTANCE,
  MIN_BOSS_DISTANCE,
  WAVE_TRANSITION,
} from '../data/constants';
import { Data } from '../data/DataManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { Dish } from '../entities/Dish';

type WavePhase = 'waiting' | 'countdown' | 'spawning';

interface WaveConfig {
  spawnInterval: number;
  minDishCount: number;
  dishTypes: { type: string; weight: number }[];
  laser?: { maxCount: number; minInterval: number; maxInterval: number };
}

export class WaveSystem {
  private scene: Phaser.Scene;
  private currentWave: number = 0;
  private timeSinceLastSpawn: number = 0;
  private timeSinceLastFillSpawn: number = 0;
  private waveConfig: WaveConfig | null = null;
  private isFeverTime: boolean = false;
  private totalGameTime: number = 0;
  private getDishPool: () => ObjectPool<Dish>;
  private getMaxSpawnY: () => number;
  private getBoss: () => { x: number; y: number; visible: boolean } | null;

  private wavePhase: WavePhase = 'waiting';
  private countdownTimer: number = 0;
  private countdownElapsed: number = 0;
  private pendingWaveNumber: number = 1;

  constructor(
    scene: Phaser.Scene,
    getDishPool: () => ObjectPool<Dish>,
    getMaxSpawnY?: () => number,
    getBoss?: () => { x: number; y: number; visible: boolean } | null
  ) {
    this.scene = scene;
    this.getDishPool = getDishPool;
    this.getMaxSpawnY = getMaxSpawnY || (() => SPAWN_AREA.maxY);
    this.getBoss = getBoss || (() => null);
  }

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.timeSinceLastSpawn = 0;
    this.timeSinceLastFillSpawn = 0;
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
        minDishCount: waveData.dishCount,
        dishTypes: waveData.dishTypes,
        laser: waveData.laser,
      };
    }

    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    // 무한 웨이브 레이저 스케일링: 4개 고정, 간격은 더 짧아짐
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
    };
  }

  private getScaledDishTypes(waveNumber: number): { type: string; weight: number }[] {
    const wavesData = Data.waves;
    const scaling = wavesData.infiniteScaling;
    const wavesBeyond = waveNumber - wavesData.waves.length;

    const bombWeight = Math.min(
      scaling.maxBombWeight,
      0.25 + wavesBeyond * scaling.bombWeightIncrease
    );
    const crystalWeight = 0.3;
    const goldenWeight = Math.max(
      scaling.minGoldenWeight,
      0.35 - wavesBeyond * scaling.goldenWeightDecrease
    );
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
    this.countdownElapsed = 0;
    EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_START, waveNumber);
  }

  startFeverTime(): void {
    this.isFeverTime = true;
    const feverData = Data.waves.fever;
    this.waveConfig = {
      spawnInterval: feverData.spawnInterval,
      minDishCount: feverData.dishCount,
      dishTypes: feverData.dishTypes,
    };
    this.timeSinceLastSpawn = 0;
    this.timeSinceLastFillSpawn = 0;
  }

  getWavePhase(): WavePhase {
    return this.wavePhase;
  }

  update(delta: number): void {
    this.totalGameTime += delta;

    if (this.wavePhase === 'countdown') {
      const duration = Math.max(1, WAVE_TRANSITION.COUNTDOWN_DURATION);
      const countFrom = Math.max(1, WAVE_TRANSITION.COUNT_FROM ?? 3);
      const stepDuration = duration / countFrom;
      const clampedPrevElapsed = Math.min(this.countdownElapsed, duration);
      const prevStep = Math.floor(clampedPrevElapsed / stepDuration);

      this.countdownElapsed += delta;
      const clampedCurrentElapsed = Math.min(this.countdownElapsed, duration);
      const currentStep = Math.floor(clampedCurrentElapsed / stepDuration);
      this.countdownTimer -= delta;

      if (currentStep > prevStep) {
        const lastStep = Math.min(currentStep, countFrom);
        for (let step = prevStep + 1; step <= lastStep; step++) {
          EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_TICK, Math.max(0, countFrom - step));
        }
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
    this.timeSinceLastFillSpawn += delta;

    const activeCount = this.getDishPool().getActiveCount();
    const fillSpawn = Data.spawn.fillSpawn;

    if (activeCount < this.waveConfig.minDishCount) {
      // fill spawn: 최소 접시 수 미달 시 빠르게 보충
      if (this.timeSinceLastFillSpawn >= fillSpawn.cooldownMs) {
        this.spawnDish();
        this.timeSinceLastFillSpawn = 0;
      }
    } else {
      // normal spawn: 최소 수량 확보 후 일반 간격 스폰
      if (this.timeSinceLastSpawn >= this.waveConfig.spawnInterval) {
        this.spawnDish();
        this.timeSinceLastSpawn = 0;
      }
    }
  }

  private spawnDish(): void {
    if (!this.waveConfig) return;

    const position = this.findValidSpawnPosition();
    if (!position) return;

    const type = this.selectDishType(this.waveConfig.dishTypes);

    const { x, y } = position;

    const speedMultiplier = this.isFeverTime ? 2.5 : 1 + (this.currentWave - 1) * 0.1;

    const gameScene = this.scene as unknown as {
      spawnDish: (type: string, x: number, y: number, speedMultiplier: number) => void;
    };
    gameScene.spawnDish(type, x, y, speedMultiplier);
  }

  private findValidSpawnPosition(): { x: number; y: number } | null {
    const activeDishes = this.getDishPool().getActiveObjects();
    const boss = this.getBoss();
    const maxAttempts = 20;
    const maxY = this.getMaxSpawnY();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Phaser.Math.Between(SPAWN_AREA.minX, SPAWN_AREA.maxX);
      const y = Phaser.Math.Between(SPAWN_AREA.minY, maxY);

      let isValid = true;

      // 보스와의 거리 체크 (보스가 활성화된 경우만)
      if (boss && boss.visible) {
        const distanceToBoss = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
        if (distanceToBoss < MIN_BOSS_DISTANCE) {
          isValid = false;
        }
      }

      // 다른 접시들과의 거리 체크
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

  getCurrentWaveLaserConfig():
    | { maxCount: number; minInterval: number; maxInterval: number }
    | undefined {
    return this.waveConfig?.laser;
  }

  isFever(): boolean {
    return this.isFeverTime;
  }

  getTotalTime(): number {
    return this.totalGameTime;
  }
}
