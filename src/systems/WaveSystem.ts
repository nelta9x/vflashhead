import Phaser from 'phaser';
import { MIN_BOSS_DISTANCE, SPAWN_AREA } from '../data/constants';
import { Data } from '../data/DataManager';
import { WaveBossConfig } from '../data/types/waves';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { Dish } from '../entities/Dish';
import { WaveConfigResolver, WaveRuntimeConfig } from './wave/WaveConfigResolver';
import { WavePhase, WavePhaseController } from './wave/WavePhaseController';
import { WaveSpawnPlanner } from './wave/WaveSpawnPlanner';
import type { DishSpawnDelegate } from '../scenes/game/GameSceneContracts';

export class WaveSystem {
  private readonly dishSpawnDelegate: DishSpawnDelegate;
  private currentWave = 0;
  private timeSinceLastSpawn = 0;
  private timeSinceLastFillSpawn = 0;
  private waveConfig: WaveRuntimeConfig | null = null;
  private isFeverTime = false;
  private totalGameTime = 0;
  private readonly getDishPool: () => ObjectPool<Dish>;
  private readonly getMaxSpawnY: () => number;
  private readonly getBosses: () => Array<{ id: string; x: number; y: number; visible: boolean }>;

  private readonly phaseController: WavePhaseController;
  private readonly configResolver: WaveConfigResolver;
  private readonly spawnPlanner: WaveSpawnPlanner;

  constructor(
    scene: Phaser.Scene,
    getDishPool: () => ObjectPool<Dish>,
    getMaxSpawnY?: () => number,
    getBosses?: () => Array<{ id: string; x: number; y: number; visible: boolean }>,
    dishSpawnDelegate?: DishSpawnDelegate
  ) {
    this.dishSpawnDelegate = dishSpawnDelegate ?? (scene as unknown as DishSpawnDelegate);
    this.getDishPool = getDishPool;
    this.getMaxSpawnY = getMaxSpawnY || (() => SPAWN_AREA.maxY);
    this.getBosses = getBosses || (() => []);

    this.phaseController = new WavePhaseController();
    this.configResolver = new WaveConfigResolver();
    this.spawnPlanner = new WaveSpawnPlanner({
      getDishPool: this.getDishPool,
      getMaxSpawnY: this.getMaxSpawnY,
      getBosses: this.getBosses,
    });
  }

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.timeSinceLastSpawn = 0;
    this.timeSinceLastFillSpawn = 0;
    this.phaseController.startSpawning();

    this.waveConfig = this.configResolver.resolveWaveConfig(waveNumber);

    EventBus.getInstance().emit(GameEvents.WAVE_STARTED, waveNumber);
  }

  startCountdown(waveNumber: number): void {
    this.phaseController.startCountdown(waveNumber);
  }

  startFeverTime(): void {
    this.isFeverTime = true;
    this.waveConfig = this.configResolver.resolveFeverConfig(this.currentWave);
    this.timeSinceLastSpawn = 0;
    this.timeSinceLastFillSpawn = 0;
  }

  getWavePhase(): WavePhase {
    return this.phaseController.getWavePhase();
  }

  update(delta: number): void {
    this.totalGameTime += delta;

    const pendingWaveNumber = this.phaseController.updateCountdown(delta);
    if (pendingWaveNumber !== null) {
      this.startWave(pendingWaveNumber);
      return;
    }

    if (!this.phaseController.isSpawning()) return;
    if (!this.waveConfig) return;

    this.timeSinceLastSpawn += delta;
    this.timeSinceLastFillSpawn += delta;

    const activeCount = this.getDishPool().getActiveCount();
    const fillSpawn = Data.spawn.fillSpawn;

    if (activeCount < this.waveConfig.minDishCount) {
      if (this.timeSinceLastFillSpawn >= fillSpawn.cooldownMs) {
        this.spawnDish();
        this.timeSinceLastFillSpawn = 0;
      }
      return;
    }

    if (this.timeSinceLastSpawn >= this.waveConfig.spawnInterval) {
      this.spawnDish();
      this.timeSinceLastSpawn = 0;
    }
  }

  private spawnDish(): void {
    if (!this.waveConfig) return;

    const plannedSpawn = this.spawnPlanner.planDishSpawn(
      this.waveConfig,
      this.currentWave,
      this.isFeverTime
    );
    if (!plannedSpawn) return;

    this.dishSpawnDelegate.spawnDish(
      plannedSpawn.type,
      plannedSpawn.x,
      plannedSpawn.y,
      plannedSpawn.speedMultiplier
    );
  }

  getActiveDishCount(): number {
    return this.getDishPool().getActiveCount();
  }

  forceCompleteWave(): void {
    this.phaseController.forceWaiting();
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

  getCurrentWaveBosses(): WaveBossConfig[] {
    return (
      this.waveConfig?.bosses.map((boss) => ({
        ...boss,
        spawnRange: { ...boss.spawnRange },
        laser: { ...boss.laser },
      })) ?? []
    );
  }

  getCurrentWaveBossTotalHp(): number {
    return this.waveConfig?.bossTotalHp ?? 1;
  }

  getCurrentWaveBossSpawnMinDistance(): number {
    return this.waveConfig?.bossSpawnMinDistance ?? MIN_BOSS_DISTANCE;
  }

  isFever(): boolean {
    return this.isFeverTime;
  }

  getTotalTime(): number {
    return this.totalGameTime;
  }
}
