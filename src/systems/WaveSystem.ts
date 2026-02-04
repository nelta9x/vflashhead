import Phaser from 'phaser';
import { GAME_DURATION, SPAWN_AREA, MIN_DISH_DISTANCE } from '../config/constants';
import { EventBus, GameEvents } from '../utils/EventBus';

interface WaveConfig {
  dishCount: number;
  spawnInterval: number;
  dishTypes: { type: string; weight: number }[];
}

const WAVE_CONFIGS: WaveConfig[] = [
  // 웨이브 1-3: 입문
  { dishCount: 6, spawnInterval: 1000, dishTypes: [{ type: 'basic', weight: 1 }] },
  { dishCount: 8, spawnInterval: 900, dishTypes: [{ type: 'basic', weight: 0.9 }, { type: 'bomb', weight: 0.1 }] },
  { dishCount: 10, spawnInterval: 800, dishTypes: [{ type: 'basic', weight: 0.8 }, { type: 'golden', weight: 0.1 }, { type: 'bomb', weight: 0.1 }] },
  // 웨이브 4-6: 상승
  { dishCount: 12, spawnInterval: 700, dishTypes: [{ type: 'basic', weight: 0.6 }, { type: 'golden', weight: 0.2 }, { type: 'crystal', weight: 0.1 }, { type: 'bomb', weight: 0.1 }] },
  { dishCount: 15, spawnInterval: 600, dishTypes: [{ type: 'basic', weight: 0.5 }, { type: 'golden', weight: 0.2 }, { type: 'crystal', weight: 0.15 }, { type: 'bomb', weight: 0.15 }] },
  { dishCount: 18, spawnInterval: 500, dishTypes: [{ type: 'basic', weight: 0.4 }, { type: 'golden', weight: 0.25 }, { type: 'crystal', weight: 0.2 }, { type: 'bomb', weight: 0.15 }] },
  // 웨이브 7-9: 혼돈
  { dishCount: 22, spawnInterval: 400, dishTypes: [{ type: 'basic', weight: 0.3 }, { type: 'golden', weight: 0.3 }, { type: 'crystal', weight: 0.2 }, { type: 'bomb', weight: 0.2 }] },
  { dishCount: 26, spawnInterval: 350, dishTypes: [{ type: 'basic', weight: 0.25 }, { type: 'golden', weight: 0.3 }, { type: 'crystal', weight: 0.25 }, { type: 'bomb', weight: 0.2 }] },
  { dishCount: 30, spawnInterval: 300, dishTypes: [{ type: 'basic', weight: 0.2 }, { type: 'golden', weight: 0.3 }, { type: 'crystal', weight: 0.25 }, { type: 'bomb', weight: 0.25 }] },
  // 웨이브 10-12: 지옥
  { dishCount: 35, spawnInterval: 250, dishTypes: [{ type: 'basic', weight: 0.15 }, { type: 'golden', weight: 0.3 }, { type: 'crystal', weight: 0.3 }, { type: 'bomb', weight: 0.25 }] },
  { dishCount: 40, spawnInterval: 220, dishTypes: [{ type: 'basic', weight: 0.1 }, { type: 'golden', weight: 0.35 }, { type: 'crystal', weight: 0.3 }, { type: 'bomb', weight: 0.25 }] },
  { dishCount: 50, spawnInterval: 200, dishTypes: [{ type: 'basic', weight: 0.1 }, { type: 'golden', weight: 0.35 }, { type: 'crystal', weight: 0.3 }, { type: 'bomb', weight: 0.25 }] },
];

// 피버 타임 설정 (지옥: 150ms 간격)
const FEVER_CONFIG: WaveConfig = {
  dishCount: 999,
  spawnInterval: 150,
  dishTypes: [
    { type: 'basic', weight: 0.1 },
    { type: 'golden', weight: 0.35 },
    { type: 'crystal', weight: 0.3 },
    { type: 'bomb', weight: 0.25 },
  ],
};

interface ActiveDishPosition {
  x: number;
  y: number;
  id: number;
}

export class WaveSystem {
  private scene: Phaser.Scene;
  private currentWave: number = 0;
  private dishesSpawned: number = 0;
  private dishesDestroyed: number = 0;
  private timeSinceLastSpawn: number = 0;
  private waveConfig: WaveConfig | null = null;
  private isFeverTime: boolean = false;
  private totalGameTime: number = 0;
  private activeDishPositions: ActiveDishPosition[] = [];
  private nextDishId: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // 접시 파괴 이벤트 리스닝
    EventBus.getInstance().on(GameEvents.DISH_DESTROYED, (...args: unknown[]) => {
      const data = args[0] as { dish: { x: number; y: number } };
      this.removeDishPosition(data.dish.x, data.dish.y);
      this.dishesDestroyed++;
      this.checkWaveComplete();
    });

    // 접시 타임아웃 이벤트 리스닝
    EventBus.getInstance().on(GameEvents.DISH_MISSED, (...args: unknown[]) => {
      const data = args[0] as { x: number; y: number };
      this.removeDishPosition(data.x, data.y);
    });
  }

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.dishesSpawned = 0;
    this.dishesDestroyed = 0;
    this.timeSinceLastSpawn = 0;

    // 웨이브 설정 가져오기
    const configIndex = Math.min(waveNumber - 1, WAVE_CONFIGS.length - 1);
    this.waveConfig = WAVE_CONFIGS[configIndex];

    EventBus.getInstance().emit(GameEvents.WAVE_STARTED, waveNumber);
  }

  startFeverTime(): void {
    this.isFeverTime = true;
    this.waveConfig = FEVER_CONFIG;
    this.dishesSpawned = 0;
    this.dishesDestroyed = 0;
    this.timeSinceLastSpawn = 0;
  }

  update(delta: number): void {
    this.totalGameTime += delta;

    // 3분 경과 체크
    if (!this.isFeverTime && this.totalGameTime >= GAME_DURATION - 60000 && this.totalGameTime < GAME_DURATION) {
      // 2분 경과 시 피버 타임 시작
      if (this.totalGameTime >= GAME_DURATION - 60000 && !this.isFeverTime) {
        this.startFeverTime();
      }
    }

    // 3분 경과 시 게임 오버
    if (this.totalGameTime >= GAME_DURATION) {
      EventBus.getInstance().emit(GameEvents.GAME_OVER);
      return;
    }

    if (!this.waveConfig) return;

    this.timeSinceLastSpawn += delta;

    // 스폰 인터벌 체크
    if (this.timeSinceLastSpawn >= this.waveConfig.spawnInterval) {
      if (this.dishesSpawned < this.waveConfig.dishCount || this.isFeverTime) {
        this.spawnDish();
        this.timeSinceLastSpawn = 0;
      }
    }
  }

  private spawnDish(): void {
    if (!this.waveConfig) return;

    // 유효한 스폰 위치 찾기
    const position = this.findValidSpawnPosition();
    if (!position) return; // 유효한 위치가 없으면 스폰하지 않음

    // 가중치 기반 타입 선택
    const type = this.selectDishType(this.waveConfig.dishTypes);

    const { x, y } = position;

    // 위치 추적에 추가
    const dishId = this.nextDishId++;
    this.activeDishPositions.push({ x, y, id: dishId });

    // 웨이브별 속도 배율 (타임아웃 방식에서는 사용하지 않지만 호환성 유지)
    const speedMultiplier = this.isFeverTime ? 2.5 : 1 + (this.currentWave - 1) * 0.1;

    // GameScene에 접시 스폰 요청
    const gameScene = this.scene as unknown as { spawnDish: (type: string, x: number, y: number, speedMultiplier: number) => void };
    gameScene.spawnDish(type, x, y, speedMultiplier);

    this.dishesSpawned++;
  }

  private findValidSpawnPosition(): { x: number; y: number } | null {
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Phaser.Math.Between(SPAWN_AREA.minX, SPAWN_AREA.maxX);
      const y = Phaser.Math.Between(SPAWN_AREA.minY, SPAWN_AREA.maxY);

      // 기존 접시들과 거리 체크
      let isValid = true;
      for (const pos of this.activeDishPositions) {
        const distance = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
        if (distance < MIN_DISH_DISTANCE) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        return { x, y };
      }
    }

    return null; // 유효한 위치를 찾지 못함
  }

  removeDishPosition(x: number, y: number): void {
    // 가장 가까운 위치의 접시 제거
    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < this.activeDishPositions.length; i++) {
      const pos = this.activeDishPositions[i];
      const distance = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1 && closestDistance < 50) {
      this.activeDishPositions.splice(closestIndex, 1);
    }
  }

  getActiveDishCount(): number {
    return this.activeDishPositions.length;
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

  private checkWaveComplete(): void {
    if (this.isFeverTime) return;

    if (
      this.waveConfig &&
      this.dishesSpawned >= this.waveConfig.dishCount &&
      this.dishesDestroyed >= this.waveConfig.dishCount
    ) {
      EventBus.getInstance().emit(GameEvents.WAVE_COMPLETED, this.currentWave);

      // 다음 웨이브 시작 (딜레이)
      this.scene.time.delayedCall(2000, () => {
        this.startWave(this.currentWave + 1);
      });
    }
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  isFever(): boolean {
    return this.isFeverTime;
  }

  getProgress(): number {
    if (!this.waveConfig || this.isFeverTime) return 0;
    return this.dishesDestroyed / this.waveConfig.dishCount;
  }

  getTotalTime(): number {
    return this.totalGameTime;
  }
}
