import Phaser from 'phaser';
import { SPAWN_AREA, MIN_DISH_DISTANCE, WAVE_TRANSITION } from '../config/constants';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { Dish } from '../entities/Dish';

type WavePhase = 'waiting' | 'countdown' | 'spawning';

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

export class WaveSystem {
  private scene: Phaser.Scene;
  private currentWave: number = 0;
  private dishesSpawned: number = 0;
  private dishesDestroyed: number = 0;
  private timeSinceLastSpawn: number = 0;
  private waveConfig: WaveConfig | null = null;
  private isFeverTime: boolean = false;
  private totalGameTime: number = 0;
  private getDishPool: () => ObjectPool<Dish>;
  private getMaxSpawnY: () => number;

  // 웨이브 페이즈 상태
  private wavePhase: WavePhase = 'waiting';
  private countdownTimer: number = 0;
  private pendingWaveNumber: number = 1;

  constructor(scene: Phaser.Scene, getDishPool: () => ObjectPool<Dish>, getMaxSpawnY?: () => number) {
    this.scene = scene;
    this.getDishPool = getDishPool;
    this.getMaxSpawnY = getMaxSpawnY || (() => SPAWN_AREA.maxY);

    // 접시 파괴 이벤트 리스닝
    EventBus.getInstance().on(GameEvents.DISH_DESTROYED, () => {
      this.dishesDestroyed++;
      this.checkWaveComplete();
    });

    // 접시 타임아웃 이벤트 리스닝
    EventBus.getInstance().on(GameEvents.DISH_MISSED, () => {
      this.dishesDestroyed++;
      this.checkWaveComplete();
    });
  }

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.dishesSpawned = 0;
    this.dishesDestroyed = 0;
    this.timeSinceLastSpawn = 0;

    // 웨이브 설정 가져오기 (12 이후 무한 스케일링)
    this.waveConfig = this.getScaledWaveConfig(waveNumber);

    EventBus.getInstance().emit(GameEvents.WAVE_STARTED, waveNumber);
  }

  private getScaledWaveConfig(waveNumber: number): WaveConfig {
    const baseIndex = Math.min(waveNumber - 1, WAVE_CONFIGS.length - 1);
    const base = WAVE_CONFIGS[baseIndex];

    // 웨이브 12 이하는 기본 설정 사용
    if (waveNumber <= 12) return base;

    // 웨이브 12 이후: 난이도 점진적 증가
    const scaleFactor = 1 + (waveNumber - 12) * 0.15; // 15%씩 증가
    return {
      dishCount: Math.floor(base.dishCount * scaleFactor),
      spawnInterval: Math.max(150, base.spawnInterval - (waveNumber - 12) * 20),
      dishTypes: this.getScaledDishTypes(waveNumber),
    };
  }

  private getScaledDishTypes(waveNumber: number): { type: string; weight: number }[] {
    // 웨이브 증가에 따라 bomb 비율 점진적 증가 (최대 35%)
    const bombWeight = Math.min(0.35, 0.25 + (waveNumber - 12) * 0.02);
    const crystalWeight = 0.3;
    const goldenWeight = 0.35 - (waveNumber - 12) * 0.01; // 골든은 약간 감소
    const basicWeight = Math.max(0.05, 1 - bombWeight - crystalWeight - goldenWeight);

    return [
      { type: 'basic', weight: basicWeight },
      { type: 'golden', weight: Math.max(0.2, goldenWeight) },
      { type: 'crystal', weight: crystalWeight },
      { type: 'bomb', weight: bombWeight },
    ];
  }

  // 카운트다운 시작 (업그레이드 선택 후 호출)
  startCountdown(waveNumber: number): void {
    this.pendingWaveNumber = waveNumber;
    this.wavePhase = 'countdown';
    this.countdownTimer = WAVE_TRANSITION.COUNTDOWN_DURATION;
    EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_START, waveNumber);
  }

  startFeverTime(): void {
    this.isFeverTime = true;
    this.waveConfig = FEVER_CONFIG;
    this.dishesSpawned = 0;
    this.dishesDestroyed = 0;
    this.timeSinceLastSpawn = 0;
  }

  getWavePhase(): WavePhase {
    return this.wavePhase;
  }

  update(delta: number): void {
    this.totalGameTime += delta;

    // 카운트다운 페이즈 처리
    if (this.wavePhase === 'countdown') {
      const prevSecond = Math.ceil(this.countdownTimer / 1000);
      this.countdownTimer -= delta;
      const currentSecond = Math.ceil(this.countdownTimer / 1000);

      // 초가 바뀔 때마다 틱 이벤트 발생
      if (prevSecond !== currentSecond && currentSecond >= 0) {
        EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_TICK, currentSecond);
      }

      // 카운트다운 완료
      if (this.countdownTimer <= 0) {
        this.wavePhase = 'spawning';
        this.startWave(this.pendingWaveNumber);
        EventBus.getInstance().emit(GameEvents.WAVE_READY);
      }
      return;
    }

    // waiting 페이즈면 스폰 안함
    if (this.wavePhase !== 'spawning') return;

    // 무한 생존 모드: 시간 제한 없음, HP 0일 때만 게임 오버

    if (!this.waveConfig) return;

    this.timeSinceLastSpawn += delta;

    // 동적 스폰 간격: 화면에 접시가 적으면 더 빠르게 스폰
    const activeCount = this.getDishPool().getActiveCount();
    const minActiveDishes = 2; // 최소 유지할 접시 수
    let effectiveInterval = this.waveConfig.spawnInterval;

    // 활성 접시가 적으면 스폰 간격 단축 (콤보 유지를 위해)
    if (activeCount < minActiveDishes) {
      effectiveInterval = Math.min(effectiveInterval, 300); // 최소 300ms
    } else if (activeCount < minActiveDishes + 2) {
      effectiveInterval = Math.min(effectiveInterval, 500); // 500ms
    }

    // 스폰 인터벌 체크
    if (this.timeSinceLastSpawn >= effectiveInterval) {
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
    if (!position) return;

    // 가중치 기반 타입 선택
    const type = this.selectDishType(this.waveConfig.dishTypes);

    const { x, y } = position;

    // 웨이브별 속도 배율 (타임아웃 방식에서는 사용하지 않지만 호환성 유지)
    const speedMultiplier = this.isFeverTime ? 2.5 : 1 + (this.currentWave - 1) * 0.1;

    // GameScene에 접시 스폰 요청
    const gameScene = this.scene as unknown as { spawnDish: (type: string, x: number, y: number, speedMultiplier: number) => void };
    gameScene.spawnDish(type, x, y, speedMultiplier);

    this.dishesSpawned++;
  }

  private findValidSpawnPosition(): { x: number; y: number } | null {
    const activeDishes = this.getDishPool().getActiveObjects();
    const maxAttempts = 20;
    const maxY = this.getMaxSpawnY();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Phaser.Math.Between(SPAWN_AREA.minX, SPAWN_AREA.maxX);
      const y = Phaser.Math.Between(SPAWN_AREA.minY, maxY);

      // 실제 활성 접시들과 거리 체크
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

    return null; // 유효한 위치를 찾지 못함
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

  private checkWaveComplete(): void {
    if (this.isFeverTime) return;

    if (
      this.waveConfig &&
      this.dishesSpawned >= this.waveConfig.dishCount &&
      this.dishesDestroyed >= this.waveConfig.dishCount
    ) {
      // 대기 상태로 전환 (업그레이드 선택 대기)
      this.wavePhase = 'waiting';
      EventBus.getInstance().emit(GameEvents.WAVE_COMPLETED, this.currentWave);
      // 자동 다음 웨이브 시작 제거 - GameScene에서 업그레이드 선택 후 카운트다운 시작
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
