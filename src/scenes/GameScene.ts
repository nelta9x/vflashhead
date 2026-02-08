import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  CURSOR_HITBOX,
  SPAWN_AREA,
  MAGNET,
  INITIAL_HP,
} from '../data/constants';
import { Data } from '../data/DataManager';
import { Dish } from '../entities/Dish';
import { Boss } from '../entities/Boss';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ObjectPool } from '../utils/ObjectPool';
import { ComboSystem } from '../systems/ComboSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { HealthPackSystem } from '../systems/HealthPackSystem';
import { HUD } from '../ui/HUD';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { DamageText } from '../ui/DamageText';
import { CursorTrail } from '../effects/CursorTrail';
import { StarBackground } from '../effects/StarBackground';
import { GridRenderer } from '../effects/GridRenderer';
import { LaserRenderer } from '../effects/LaserRenderer';
import { CursorRenderer } from '../effects/CursorRenderer';
import { OrbRenderer } from '../effects/OrbRenderer';
import { PlayerAttackRenderer } from '../effects/PlayerAttackRenderer';
import { BlackHoleRenderer } from '../effects/BlackHoleRenderer';
import { FeedbackSystem } from '../systems/FeedbackSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { MonsterSystem } from '../systems/MonsterSystem';
import { GaugeSystem } from '../systems/GaugeSystem';
import { OrbSystem } from '../systems/OrbSystem';
import { BlackHoleSystem } from '../systems/BlackHoleSystem';
import { PlayerCursorInputController } from '../systems/PlayerCursorInputController';
import { InGameUpgradeUI } from '../ui/InGameUpgradeUI';
import { WaveCountdownUI } from '../ui/WaveCountdownUI';
import { HudFrameContext } from '../ui/hud/types';
import { WaveBossConfig } from '../data/types';

export class GameScene extends Phaser.Scene {
  private dishPool!: ObjectPool<Dish>;
  private dishes!: Phaser.GameObjects.Group;

  // 시스템
  private comboSystem!: ComboSystem;
  private waveSystem!: WaveSystem;
  private upgradeSystem!: UpgradeSystem;
  private healthSystem!: HealthSystem;
  private healthPackSystem!: HealthPackSystem;
  private feedbackSystem!: FeedbackSystem;
  private soundSystem!: SoundSystem;
  private monsterSystem!: MonsterSystem;
  private gaugeSystem!: GaugeSystem;
  private orbSystem!: OrbSystem;
  private blackHoleSystem!: BlackHoleSystem;

  // UI & 이펙트
  private hud!: HUD;
  private bosses: Map<string, Boss> = new Map();
  private inGameUpgradeUI!: InGameUpgradeUI;
  private waveCountdownUI!: WaveCountdownUI;
  private particleManager!: ParticleManager;
  private screenShake!: ScreenShake;
  private damageText!: DamageText;
  private cursorTrail!: CursorTrail;
  private starBackground!: StarBackground;

  // 게임 상태
  private gameTime: number = 0;
  private isGameOver: boolean = false;
  private isPaused: boolean = false;
  private isDockPaused: boolean = false;
  private isSimulationPaused: boolean = false;
  private isUpgrading: boolean = false;
  private gaugeRatio: number = 0;
  private maxSpawnedDishRadius: number = 0;

  // 웨이브 전환 상태
  private pendingWaveNumber: number = 1;

  // 렌더러
  private gridRenderer!: GridRenderer;
  private cursorRenderer!: CursorRenderer;
  private laserRenderer!: LaserRenderer;
  private orbRenderer!: OrbRenderer;
  private blackHoleRenderer!: BlackHoleRenderer;
  private playerAttackRenderer: PlayerAttackRenderer | null = null;

  // BGM
  private bgm: Phaser.Sound.BaseSound | null = null;

  // 커서 시스템
  private cursorX: number = 0;
  private cursorY: number = 0;
  private inputController!: PlayerCursorInputController;
  private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private escapeKeyHandler: (() => void) | null = null;
  private gameOutHandler: ((time: number, event: Event) => void) | null = null;
  private windowBlurHandler: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;

  // 보스 레이저 공격 관련
  private laserNextTimeByBossId: Map<string, number> = new Map();
  private activeLasers: Array<{
    bossId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isFiring: boolean;
    isWarning: boolean;
    startTime: number;
  }> = [];
  private bossOverlapLastHitTimeByBossId: Map<string, number> = new Map();

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isGameOver = false;
    this.isPaused = false;
    this.isDockPaused = false;
    this.isSimulationPaused = false;
    this.gameTime = 0;
    this.activeLasers = [];
    this.laserNextTimeByBossId.clear();
    this.bossOverlapLastHitTimeByBossId.clear();
    this.time.timeScale = 1;
    this.tweens.resumeAll();

    // 배경색 채우기 (블렌딩 베이스)
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.DARK_BG).setOrigin(0, 0).setDepth(-10);

    // 그리드 렌더러 초기화
    this.gridRenderer = new GridRenderer(this);

    // Phaser 그룹 생성
    this.dishes = this.add.group();

    // 시스템 초기화
    this.initializeSystems();

    // 엔티티 초기화
    this.initializeEntities();

    // 이벤트 리스너 설정
    this.setupEventListeners();

    // 입력 설정
    this.setupInput();

    // 카메라 페이드 인
    this.cameras.main.fadeIn(500);

    // 게임 커서 설정 (숨김 - 커스텀 인디케이터 사용)
    this.input.setDefaultCursor('none');

    // BGM 재생
    const bgmConfig = Data.gameConfig.audio.bgm;
    this.bgm = this.sound.add(bgmConfig.key, {
      loop: true,
      volume: bgmConfig.volume,
    });
    this.bgm.play();

    // 커서 렌더러 생성
    this.cursorRenderer = new CursorRenderer(this);
    this.cursorRenderer.setDepth(1000); // 최상위에 표시

    // 구체(Orb) 렌더러 생성
    this.orbRenderer = new OrbRenderer(this);
    this.orbRenderer.setDepth(1001);

    // 블랙홀 렌더러 생성
    this.blackHoleRenderer = new BlackHoleRenderer(this);
    // 접시(기본 depth 0) 뒤에 렌더링되도록 배경 레이어로 배치
    this.blackHoleRenderer.setDepth(Data.gameConfig.blackHoleVisual.depth);

    // 레이저 렌더러 생성
    this.laserRenderer = new LaserRenderer(this);
    this.playerAttackRenderer = new PlayerAttackRenderer(this);

    // 별 배경 추가
    const gridConfig = Data.gameConfig.gameGrid;
    this.starBackground = new StarBackground(this, Data.gameConfig.stars);
    this.starBackground.setDepth(gridConfig.depth - 1);

    // 게임 시작: 첫 웨이브 바로 시작 (카운트다운 없음)
    this.waveSystem.startWave(1);
  }

  private initializeSystems(): void {
    // 이전 게임의 이벤트 리스너 정리 (재시작 시 중복 방지)
    EventBus.getInstance().clear();

    this.comboSystem = new ComboSystem();
    this.upgradeSystem = new UpgradeSystem();
    this.maxSpawnedDishRadius = this.calculateMaxSpawnedDishRadius();

    // 이펙트 시스템 (가장 먼저 초기화)
    this.particleManager = new ParticleManager(this);
    this.screenShake = new ScreenShake(this);
    this.damageText = new DamageText(this);
    this.cursorTrail = new CursorTrail(this);
    this.soundSystem = SoundSystem.getInstance();
    this.soundSystem.setScene(this);
    this.feedbackSystem = new FeedbackSystem(
      this,
      this.particleManager,
      this.screenShake,
      this.damageText,
      this.soundSystem
    );

    // 인게임 업그레이드 UI (ParticleManager 생성 후)
    this.inGameUpgradeUI = new InGameUpgradeUI(this, this.upgradeSystem, this.particleManager);

    this.waveSystem = new WaveSystem(
      this,
      () => this.dishPool,
      () => {
        const baseMaxY = this.inGameUpgradeUI.isVisible()
          ? this.inGameUpgradeUI.getBlockedYArea()
          : SPAWN_AREA.maxY;
        return this.getDockSafeSpawnMaxY(baseMaxY);
      },
      () => this.getVisibleBossSnapshots()
    );
    this.healthSystem = new HealthSystem();
    this.healthPackSystem = new HealthPackSystem(this, this.upgradeSystem);
    this.monsterSystem = new MonsterSystem();
    this.gaugeSystem = new GaugeSystem(this.comboSystem);
    this.orbSystem = new OrbSystem(this.upgradeSystem);
    this.blackHoleSystem = new BlackHoleSystem(
      this.upgradeSystem,
      () => this.dishPool,
      () => this.getAliveVisibleBossSnapshotsWithRadius(),
      (bossId, amount, sourceX, sourceY) =>
        this.monsterSystem.takeDamage(bossId, amount, sourceX, sourceY)
    );

    // HUD
    this.hud = new HUD(this, this.waveSystem, this.healthSystem, this.upgradeSystem);

    // 웨이브 카운트다운 UI
    this.waveCountdownUI = new WaveCountdownUI(this);
  }

  private getDockSafeSpawnMaxY(baseMaxY: number): number {
    const dockHoverArea = this.hud.getDockHoverArea();
    if (!dockHoverArea) {
      return baseMaxY;
    }

    const dockSafeMaxY = Math.floor(dockHoverArea.y - this.maxSpawnedDishRadius);
    return Math.max(SPAWN_AREA.minY, Math.min(baseMaxY, dockSafeMaxY));
  }

  private calculateMaxSpawnedDishRadius(): number {
    const waveDishTypes = Data.waves.waves.flatMap((wave) => wave.dishTypes.map((dish) => dish.type));
    const feverDishTypes = Data.waves.fever.dishTypes.map((dish) => dish.type);
    const uniqueDishTypes = new Set<string>([...waveDishTypes, ...feverDishTypes]);

    let maxRadius = 0;
    uniqueDishTypes.forEach((type) => {
      const dishData = Data.getDishData(type);
      if (dishData) {
        maxRadius = Math.max(maxRadius, dishData.size);
      }
    });

    return maxRadius;
  }

  private initializeEntities(): void {
    // 오브젝트 풀 생성
    this.dishPool = new ObjectPool<Dish>(() => new Dish(this, 0, 0, 'basic'), 10, 50);
  }

  private setupEventListeners(): void {
    // 접시 파괴 이벤트
    EventBus.getInstance().on(GameEvents.DISH_DESTROYED, (...args: unknown[]) => {
      const data = args[0] as { dish: Dish; x: number; y: number; chainReaction: boolean };
      this.onDishDestroyed(data);
    });

    // 접시 데미지 이벤트
    EventBus.getInstance().on(GameEvents.DISH_DAMAGED, (...args: unknown[]) => {
      const data = args[0] as {
        dish: Dish;
        x: number;
        y: number;
        type: string;
        damage: number;
        currentHp: number;
        maxHp: number;
        hpRatio: number;
        isFirstHit: boolean;
      };
      this.onDishDamaged(data);
    });

    // 콤보 마일스톤
    EventBus.getInstance().on(GameEvents.COMBO_MILESTONE, (...args: unknown[]) => {
      const milestone = args[0] as number;
      this.feedbackSystem.onComboMilestone(milestone);
    });

    // 웨이브 시작 시 보스 동기화
    EventBus.getInstance().on(GameEvents.WAVE_STARTED, (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.syncBossesForWave(waveNumber);
    });

    // 웨이브 완료
    EventBus.getInstance().on(GameEvents.WAVE_COMPLETED, (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.hud.showWaveComplete(waveNumber);
      this.clearAllDishes();

      // 레이저 정리
      this.activeLasers = [];
      this.laserNextTimeByBossId.clear();
      this.bosses.forEach((boss) => boss.unfreeze());
      this.laserRenderer.clear();

      // 다음 웨이브 번호 저장 후 업그레이드 UI만 먼저 표시
      this.pendingWaveNumber = waveNumber + 1;
      this.time.delayedCall(500, () => {
        if (this.isGameOver) return;
        this.isUpgrading = true;
        this.inGameUpgradeUI.show();
      });
    });

    // 업그레이드 선택 완료
    EventBus.getInstance().on(GameEvents.UPGRADE_SELECTED, () => {
      if (this.isGameOver) return;

      this.isUpgrading = false;

      // 업그레이드 선택 후에만 다음 웨이브 카운트다운 시작
      this.time.delayedCall(300, () => {
        if (this.isGameOver) return;
        this.waveSystem.startCountdown(this.pendingWaveNumber);
        this.waveCountdownUI.show(this.pendingWaveNumber);
      });
    });

    // 카운트다운 틱
    EventBus.getInstance().on(GameEvents.WAVE_COUNTDOWN_TICK, (...args: unknown[]) => {
      const seconds = args[0] as number;
      this.waveCountdownUI.updateCountdown(seconds);
    });

    // 웨이브 준비 완료 (카운트다운 끝)
    EventBus.getInstance().on(GameEvents.WAVE_READY, () => {
      this.waveCountdownUI.hide();
    });

    // 게임 오버
    EventBus.getInstance().on(GameEvents.GAME_OVER, () => {
      this.gameOver();
    });

    // 접시 타임아웃 (놓침) 이벤트
    EventBus.getInstance().on(GameEvents.DISH_MISSED, (...args: unknown[]) => {
      const data = args[0] as {
        dish: Dish;
        x: number;
        y: number;
        type: string;
        isDangerous: boolean;
      };
      this.onDishMissed(data);
    });

    // 힐팩 업그레이드 이벤트
    EventBus.getInstance().on(GameEvents.HEALTH_PACK_UPGRADED, (...args: unknown[]) => {
      const data = args[0] as { hpBonus: number };
      this.healthSystem.setMaxHp(INITIAL_HP + data.hpBonus);
      this.healthSystem.heal(data.hpBonus); // 보너스만큼 현재 체력도 회복
    });

    // HP 변경 이벤트
    EventBus.getInstance().on(GameEvents.HP_CHANGED, (...args: unknown[]) => {
      const data = args[0] as { hp: number; maxHp: number; delta: number; isFullHeal?: boolean };

      if (data.isFullHeal) {
        this.healthSystem.reset();
        this.feedbackSystem.onHealthPackCollected(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        return;
      }

      if (data.delta < 0) {
        this.hud.showHpLoss();
        this.feedbackSystem.onHpLost();
      }
    });

    // 힐팩 수집 이벤트
    EventBus.getInstance().on(GameEvents.HEALTH_PACK_COLLECTED, (...args: unknown[]) => {
      const data = args[0] as { pack: unknown; x: number; y: number };
      this.onHealthPackCollected(data.x, data.y);
    });

    // 몬스터 HP 변경
    EventBus.getInstance().on(GameEvents.MONSTER_HP_CHANGED, () => {
      // 보스 엔티티가 내부적으로 이 이벤트를 구독하여 원형 게이지를 업데이트함
    });

    // 플레이어 게이지 업데이트
    EventBus.getInstance().on(GameEvents.GAUGE_UPDATED, (...args: unknown[]) => {
      const data = args[0] as { current: number; max: number; ratio: number };
      this.gaugeRatio = data.ratio;
    });

    // 플레이어 공격 트리거
    EventBus.getInstance().on(GameEvents.PLAYER_ATTACK, () => {
      this.performPlayerAttack();
    });

    // 몬스터 사망 -> 웨이브 클리어
    EventBus.getInstance().on(GameEvents.MONSTER_DIED, () => {
      if (this.monsterSystem.areAllDead()) {
        this.waveSystem.forceCompleteWave();
      }
    });
  }

  private onHealthPackCollected(x: number, y: number): void {
    // HP 회복
    this.healthSystem.heal(1);
    // 피드백 효과
    this.feedbackSystem.onHealthPackCollected(x, y);
  }

  private getPlayerAttackRenderer(): PlayerAttackRenderer {
    if (!this.playerAttackRenderer) {
      this.playerAttackRenderer = new PlayerAttackRenderer(this);
    }
    return this.playerAttackRenderer;
  }

  private getVisibleBossSnapshots(): Array<{ id: string; x: number; y: number; visible: boolean }> {
    const visibleBosses: Array<{ id: string; x: number; y: number; visible: boolean }> = [];
    this.bosses.forEach((boss, bossId) => {
      if (!boss.visible) return;
      visibleBosses.push({ id: bossId, x: boss.x, y: boss.y, visible: true });
    });
    return visibleBosses;
  }

  private getAliveVisibleBossSnapshotsWithRadius(): Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
  }> {
    const snapshots: Array<{ id: string; x: number; y: number; radius: number }> = [];
    const baseRadius = Math.max(Data.boss.visual.core.radius, Data.boss.visual.armor.radius);

    this.bosses.forEach((boss, bossId) => {
      if (!boss.visible) return;
      if (!this.monsterSystem.isAlive(bossId)) return;

      const scaleX = Number.isFinite(boss.scaleX) ? Math.abs(boss.scaleX) : 1;
      const scaleY = Number.isFinite(boss.scaleY) ? Math.abs(boss.scaleY) : 1;
      const scale = Math.max(scaleX, scaleY, 1);

      snapshots.push({
        id: bossId,
        x: boss.x,
        y: boss.y,
        radius: Math.max(1, baseRadius * scale),
      });
    });

    return snapshots;
  }

  private syncBossesForWave(_waveNumber: number): void {
    const bossConfigs = this.waveSystem.getCurrentWaveBosses();
    const activeBossIds = new Set(bossConfigs.map((boss) => boss.id));

    this.bosses.forEach((boss, bossId) => {
      if (activeBossIds.has(bossId)) return;
      boss.deactivate();
      this.laserNextTimeByBossId.delete(bossId);
      this.bossOverlapLastHitTimeByBossId.delete(bossId);
    });

    this.activeLasers = this.activeLasers.filter((laser) => activeBossIds.has(laser.bossId));
    const staleOverlapBossIds: string[] = [];
    this.bossOverlapLastHitTimeByBossId.forEach((_lastHitTime, bossId) => {
      if (!activeBossIds.has(bossId)) {
        staleOverlapBossIds.push(bossId);
      }
    });
    staleOverlapBossIds.forEach((bossId) => this.bossOverlapLastHitTimeByBossId.delete(bossId));

    const spawnPositions = this.rollBossSpawnPositions(
      bossConfigs,
      this.waveSystem.getCurrentWaveBossSpawnMinDistance()
    );

    for (const bossConfig of bossConfigs) {
      let boss = this.bosses.get(bossConfig.id);
      if (!boss) {
        boss = new Boss(
          this,
          GAME_WIDTH / 2,
          Data.boss.spawn.y,
          bossConfig.id,
          this.feedbackSystem
        );
        boss.setDepth(Data.boss.depth);
        this.bosses.set(bossConfig.id, boss);
      }

      const spawnPosition = spawnPositions.get(bossConfig.id);
      if (!spawnPosition) continue;
      boss.spawnAt(spawnPosition.x, spawnPosition.y);
      this.monsterSystem.publishBossHpSnapshot(bossConfig.id);
      this.setNextLaserTime(bossConfig.id);
    }

    if (this.activeLasers.length === 0) {
      this.laserRenderer?.clear();
    }
  }

  private rollBossSpawnPositions(
    bossConfigs: WaveBossConfig[],
    minDistance: number
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    if (bossConfigs.length === 0) return positions;

    const requiredDistance = Math.max(0, minDistance);
    const maxAttempts = 80;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      positions.clear();
      for (const bossConfig of bossConfigs) {
        const minX = Math.min(bossConfig.spawnRange.minX, bossConfig.spawnRange.maxX);
        const maxX = Math.max(bossConfig.spawnRange.minX, bossConfig.spawnRange.maxX);
        const minY = Math.min(bossConfig.spawnRange.minY, bossConfig.spawnRange.maxY);
        const maxY = Math.max(bossConfig.spawnRange.minY, bossConfig.spawnRange.maxY);
        positions.set(bossConfig.id, {
          x: Phaser.Math.Between(minX, maxX),
          y: Phaser.Math.Between(minY, maxY),
        });
      }

      const entries = Array.from(positions.entries());
      let valid = true;
      for (let i = 0; i < entries.length && valid; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const posA = entries[i][1];
          const posB = entries[j][1];
          const distance = Phaser.Math.Distance.Between(posA.x, posA.y, posB.x, posB.y);
          if (distance < requiredDistance) {
            valid = false;
            break;
          }
        }
      }

      if (valid) {
        return new Map(positions);
      }
    }

    positions.clear();
    bossConfigs.forEach((bossConfig, index) => {
      const minX = Math.min(bossConfig.spawnRange.minX, bossConfig.spawnRange.maxX);
      const maxX = Math.max(bossConfig.spawnRange.minX, bossConfig.spawnRange.maxX);
      const minY = Math.min(bossConfig.spawnRange.minY, bossConfig.spawnRange.maxY);
      const maxY = Math.max(bossConfig.spawnRange.minY, bossConfig.spawnRange.maxY);
      const centerX = Math.floor((minX + maxX) / 2);
      const centerY = Math.floor((minY + maxY) / 2);
      positions.set(bossConfig.id, {
        x: Phaser.Math.Clamp(centerX + index * Math.max(0, Math.floor(requiredDistance * 0.2)), minX, maxX),
        y: centerY,
      });
    });

    return positions;
  }

  private getAliveVisibleBossById(bossId: string): Boss | null {
    const boss = this.bosses.get(bossId);
    if (!boss) return null;
    if (!boss.visible) return null;
    if (!this.monsterSystem.isAlive(bossId)) return null;
    return boss;
  }

  private findNearestAliveBoss(x: number, y: number): Boss | null {
    let nearestBoss: Boss | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.bosses.forEach((boss, bossId) => {
      if (!boss.visible) return;
      if (!this.monsterSystem.isAlive(bossId)) return;

      const distance = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBoss = boss;
      }
    });

    return nearestBoss;
  }

  private getBossLaserConfig(bossId: string): { maxCount: number; minInterval: number; maxInterval: number } | null {
    const bossConfig = this.waveSystem
      .getCurrentWaveBosses()
      .find((candidate) => candidate.id === bossId);
    if (!bossConfig) return null;
    return bossConfig.laser;
  }

  private performPlayerAttack(): void {
    if (this.isGameOver) return;

    const config = Data.feedback.bossAttack;
    const attackWave = this.waveSystem.getCurrentWave();

    // 색상 변환
    const mainColor = Phaser.Display.Color.HexStringToColor(config.mainColor).color;
    const accentColor = Phaser.Display.Color.HexStringToColor(config.accentColor).color;

    // 1. Charge Phase (에네르기파 스타일 기 모으기)
    const chargeDuration = config.charge.duration;

    // 사운드 재생: 플레이어 전용 충전음 (8비트 톤)
    this.soundSystem.playPlayerChargeSound();

    const chargeVisual = this.getPlayerAttackRenderer().createChargeVisual(
      mainColor,
      accentColor,
      config.charge
    );

    // 기 모으기 애니메이션
    this.tweens.add({
      targets: { progress: 0 },
      progress: 1,
      duration: chargeDuration,
      ease: 'Linear',
      onUpdate: (_tween, target) => {
        const p = target.progress;
        chargeVisual.update(p, this.cursorX, this.cursorY);
      },
      onComplete: () => {
        chargeVisual.destroy();
        if (this.isGameOver) return;
        if (this.waveSystem.getCurrentWave() !== attackWave) return;

        // 2. Fire Phase (순차적 발사!)
        const baseAttack = Data.gameConfig.playerAttack;
        const missileCount =
          this.upgradeSystem.getMissileLevel() > 0
            ? this.upgradeSystem.getMissileCount()
            : baseAttack.baseMissileCount;

        for (let i = 0; i < missileCount; i++) {
          this.time.delayedCall(i * config.fire.missileInterval, () => {
            if (this.isGameOver) return;
            if (this.waveSystem.getCurrentWave() !== attackWave) return;

            const nearestBoss = this.findNearestAliveBoss(this.cursorX, this.cursorY);
            if (!nearestBoss) return;

            // 발사 시점의 실시간 커서 위치 사용 (this.cursorX/Y가 매번 현재 위치를 참조함)
            this.fireSequentialMissile(
              this.cursorX,
              this.cursorY,
              i,
              missileCount,
              nearestBoss.getBossId()
            );
          });
        }
      },
    });
  }

  // 순차적 미사일 발사 로직
  private fireSequentialMissile(
    startX: number,
    startY: number,
    index: number,
    total: number,
    initialTargetBossId: string
  ): void {
    if (this.isGameOver) return;
    const missileWave = this.waveSystem.getCurrentWave();

    const config = Data.feedback.bossAttack;
    const mainColor = Phaser.Display.Color.HexStringToColor(config.mainColor).color;
    const innerTrailColor = Phaser.Display.Color.HexStringToColor(config.innerTrailColor).color;

    // 회차가 거듭될수록 더 빠르고 강렬해짐
    const intensity = (index + 1) / total;
    const speed = config.fire.duration * (1 - intensity * 0.3); // 최대 30% 더 빨라짐
    const missileThicknessMultiplier = Math.max(
      0.1,
      1 + this.upgradeSystem.getCursorMissileThicknessBonus()
    );

    // 궤적 변화: 시작점에 약간의 랜덤 오프셋 부여
    const offsetRange = 30 * intensity;
    const curStartX = startX + Phaser.Math.Between(-offsetRange, offsetRange);
    const curStartY = startY + Phaser.Math.Between(-offsetRange, offsetRange);

    // 타겟 오프셋 (보스 중심에서 약간씩 빗나가게 하여 뭉치지 않게 함)
    const tracking = config.fire.trackingOffset || { x: 20, y: 10 };
    let targetBossId = initialTargetBossId;
    let targetOffsetX = Phaser.Math.Between(-tracking.x, tracking.x);
    let targetOffsetY = Phaser.Math.Between(-tracking.y, tracking.y);

    let trackedBoss = this.getAliveVisibleBossById(targetBossId);
    if (!trackedBoss) {
      trackedBoss = this.findNearestAliveBoss(curStartX, curStartY);
      if (!trackedBoss) return;
      targetBossId = trackedBoss.getBossId();
    }

    let fallbackTargetX = trackedBoss.x + targetOffsetX;
    let fallbackTargetY = trackedBoss.y + targetOffsetY;

    // 미사일 객체 생성
    const missile = this.getPlayerAttackRenderer().createMissile(
      curStartX,
      curStartY,
      (8 + 4 * intensity) * missileThicknessMultiplier,
      mainColor,
      2000
    );

    // 사운드: 점점 피치가 높아지는 발사음
    this.soundSystem.playBossFireSound(); // Note: SoundSystem에 피치 조절 기능이 없으므로 기본음 사용

    // 발사 이펙트
    this.particleManager.createSparkBurst(curStartX, curStartY, mainColor);

    let lastTrailX = curStartX;
    let lastTrailY = curStartY;

    this.tweens.add({
      targets: { progress: 0 },
      progress: 1,
      duration: speed,
      ease: 'Expo.In',
      onUpdate: (_tween, target) => {
        if (this.isGameOver) return;
        if (this.waveSystem.getCurrentWave() !== missileWave) return;

        const p = target.progress;

        // 타겟 보스가 죽으면 현재 미사일 위치 기준 nearest 보스로 재타겟
        let activeTargetBoss = this.getAliveVisibleBossById(targetBossId);
        if (!activeTargetBoss) {
          const retargetedBoss = this.findNearestAliveBoss(missile.x, missile.y);
          if (retargetedBoss) {
            targetBossId = retargetedBoss.getBossId();
            targetOffsetX = Phaser.Math.Between(-tracking.x, tracking.x);
            targetOffsetY = Phaser.Math.Between(-tracking.y, tracking.y);
            activeTargetBoss = retargetedBoss;
          }
        }

        const curTargetX =
          activeTargetBoss ? activeTargetBoss.x + targetOffsetX : fallbackTargetX;
        const curTargetY =
          activeTargetBoss ? activeTargetBoss.y + targetOffsetY : fallbackTargetY;
        fallbackTargetX = curTargetX;
        fallbackTargetY = curTargetY;

        // 시작점과 현재 보스 위치 사이를 보간
        missile.x = curStartX + (curTargetX - curStartX) * p;
        missile.y = curStartY + (curTargetY - curStartY) * p;

        const curX = missile.x;
        const curY = missile.y;

        // 강렬함에 따라 트레일 두께 조절
        const baseWidth = missile.displayWidth * config.fire.trailWidthMultiplier;
        const trailWidth = baseWidth * (0.8 + 0.5 * intensity);
        const pathRadius = Math.max(missile.displayWidth * 0.5, trailWidth * 0.5);

        this.destroyDishesAlongMissileSegment(lastTrailX, lastTrailY, curX, curY, pathRadius);

        this.getPlayerAttackRenderer().spawnMissileTrail({
          fromX: lastTrailX,
          fromY: lastTrailY,
          toX: curX,
          toY: curY,
          trailWidth,
          mainColor,
          innerColor: innerTrailColor,
          trailAlpha: config.fire.trailAlpha,
          trailLifespan: config.fire.trailLifespan,
        });

        lastTrailX = curX;
        lastTrailY = curY;
      },
      onComplete: () => {
        this.getPlayerAttackRenderer().destroyProjectile(missile);
        if (this.isGameOver) return;
        if (this.waveSystem.getCurrentWave() !== missileWave) return;

        // 최종 타겟 확인 (사망 시점이면 nearest alive 재획득)
        let finalTargetBoss = this.getAliveVisibleBossById(targetBossId);
        if (!finalTargetBoss) {
          finalTargetBoss = this.findNearestAliveBoss(missile.x, missile.y);
          if (!finalTargetBoss) {
            // 생존 보스가 없으면 시각 효과만 종료
            return;
          }
          targetBossId = finalTargetBoss.getBossId();
          targetOffsetX = Phaser.Math.Between(-tracking.x, tracking.x);
          targetOffsetY = Phaser.Math.Between(-tracking.y, tracking.y);
        }

        // 폭발 시점의 보스 위치 재계산
        const finalTargetX = finalTargetBoss.x + targetOffsetX;
        const finalTargetY = finalTargetBoss.y + targetOffsetY;

        // 미사일 데미지 적용
        const attackConfig = Data.gameConfig.playerAttack;
        let totalDamage =
          this.upgradeSystem.getMissileLevel() > 0
            ? this.upgradeSystem.getMissileDamage()
            : attackConfig.baseMissileDamage;

        // 치명타 판정
        const criticalChance = Math.min(
          1,
          attackConfig.criticalChance + this.upgradeSystem.getCriticalChanceBonus()
        );
        const isCritical = Math.random() < criticalChance;
        if (isCritical) {
          totalDamage *= attackConfig.criticalMultiplier;
        }

        this.monsterSystem.takeDamage(targetBossId, totalDamage, curStartX, curStartY);

        // 치명타 시 보스의 충전 중인 레이저 취소
        if (isCritical) {
          this.cancelBossChargingLasers(targetBossId);
        }

        // 타격 피드백 (마지막 발사일수록 더 강하게)
        if (index === total - 1) {
          this.feedbackSystem.onBossDamaged(finalTargetX, finalTargetY, totalDamage, isCritical);
          // 마지막 발사 시 카메라 효과 강화
          this.cameras.main.shake(config.impact.shakeDuration, config.impact.shakeIntensity * (isCritical ? 2 : 1.5));
        } else {
          // 중간 발사체 타격 효과
          this.feedbackSystem.onBossDamaged(finalTargetX, finalTargetY, totalDamage, isCritical);
          this.particleManager.createHitEffect(finalTargetX, finalTargetY, isCritical ? COLORS.YELLOW : COLORS.WHITE);
          this.soundSystem.playHitSound();
        }
      },
    });
  }

  private destroyDishesAlongMissileSegment(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    pathRadius: number
  ): void {
    const hitCandidates: Dish[] = [];

    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      if (dish.isDangerous() && !dish.isFullySpawned()) {
        return;
      }

      const collisionRadius = pathRadius + dish.getSize();
      if (!this.isPointInsideSegmentRadius(dish.x, dish.y, fromX, fromY, toX, toY, collisionRadius)) {
        return;
      }

      hitCandidates.push(dish);
    });

    for (const dish of hitCandidates) {
      if (!dish.active) continue;
      if (dish.isDangerous()) {
        dish.forceDestroy(true);
      } else {
        dish.forceDestroy(false);
      }
    }
  }

  private isPointInsideSegmentRadius(
    pointX: number,
    pointY: number,
    segmentStartX: number,
    segmentStartY: number,
    segmentEndX: number,
    segmentEndY: number,
    radius: number
  ): boolean {
    const lineLenSq =
      Math.pow(segmentEndX - segmentStartX, 2) + Math.pow(segmentEndY - segmentStartY, 2);

    if (lineLenSq === 0) {
      return Phaser.Math.Distance.Between(pointX, pointY, segmentStartX, segmentStartY) <= radius;
    }

    let t =
      ((pointX - segmentStartX) * (segmentEndX - segmentStartX) +
        (pointY - segmentStartY) * (segmentEndY - segmentStartY)) /
      lineLenSq;
    t = Math.max(0, Math.min(1, t));

    const nearestX = segmentStartX + t * (segmentEndX - segmentStartX);
    const nearestY = segmentStartY + t * (segmentEndY - segmentStartY);
    return Phaser.Math.Distance.Between(pointX, pointY, nearestX, nearestY) <= radius;
  }

  private onDishDamaged(data: {
    dish: Dish;
    x: number;
    y: number;
    type: string;
    damage: number;
    currentHp: number;
    maxHp: number;
    hpRatio: number;
    isFirstHit: boolean;
    byAbility?: boolean;
    isCritical?: boolean;
  }): void {
    const { x, y, damage, hpRatio, byAbility, isCritical } = data;
    // 어빌리티 데미지인 경우 콤보 표시 안 함 (0 전달)
    const combo = byAbility ? 0 : this.comboSystem.getCombo();

    if (isCritical) {
      this.feedbackSystem.onCriticalHit(x, y, damage, combo);
      // 앰버 접시 치명타 시 레이저 취소
      if (data.type === 'amber') {
        const nearestBoss = this.findNearestAliveBoss(this.cursorX, this.cursorY);
        if (nearestBoss) {
          this.cancelBossChargingLasers(nearestBoss.getBossId());
        }
      }
    } else {
      this.feedbackSystem.onDishDamaged(x, y, damage, hpRatio, data.dish.getColor(), combo);
    }
  }

  private onDishMissed(data: {
    dish: Dish;
    x: number;
    y: number;
    type: string;
    isDangerous: boolean;
  }): void {
    const { dish, x, y, isDangerous } = data;
    const dishData = Data.getDishData(dish.getDishType());

    // 지뢰 타임아웃: 조용히 사라짐 (피드백/패널티 없음)
    if (isDangerous) {
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // 일반 접시 놓침: 피드백 + HP 감소 + 콤보 리셋
    this.feedbackSystem.onDishMissed(x, y, dish.getColor(), dish.getDishType());
    
    // 설정된 데미지 적용 (기본값 1)
    const damage = dishData?.playerDamage ?? 1;
    this.healthSystem.takeDamage(damage);
    
    this.comboSystem.reset();

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  private setupInput(): void {
    const playerInputConfig = Data.gameConfig.player.input;
    this.inputController = new PlayerCursorInputController({
      pointerPriorityMs: playerInputConfig.pointerPriorityMs,
      keyboardAxisRampUpMs: playerInputConfig.keyboardAxisRampUpMs,
    });

    // 키보드 초기화
    if (this.input.keyboard) {
      this.inputController.bindKeyboard(this.input.keyboard);
    }

    // 커서 초기 위치 설정
    this.applyCursorPosition(this.input.activePointer.worldX, this.input.activePointer.worldY);
    this.inputController.onPointerInput(this.getInputTimestamp());

    // 마우스 이동 시 커서 위치 동기화
    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      this.applyCursorPosition(pointer.worldX, pointer.worldY);
      this.inputController.onPointerInput(this.getInputTimestamp());
    };
    this.input.on('pointermove', this.pointerMoveHandler);

    // ESC로 일시정지
    this.escapeKeyHandler = () => {
      if (this.isGameOver) return;
      if (this.isPaused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
    };
    this.input.keyboard?.on('keydown-ESC', this.escapeKeyHandler);

    this.setupInputSafetyHandlers();
  }

  private setupInputSafetyHandlers(): void {
    this.windowBlurHandler = () => {
      this.resetMovementInput();
    };
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.resetMovementInput();
      }
    };
    this.gameOutHandler = () => {
      this.resetMovementInput();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.windowBlurHandler);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    this.input.on(Phaser.Input.Events.GAME_OUT, this.gameOutHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
  }

  private handleSceneShutdown(): void {
    this.teardownInputHandlers();
  }

  private teardownInputHandlers(): void {
    if (this.pointerMoveHandler) {
      this.input.off('pointermove', this.pointerMoveHandler);
      this.pointerMoveHandler = null;
    }
    this.inputController?.unbindKeyboard();
    if (this.escapeKeyHandler) {
      this.input.keyboard?.off('keydown-ESC', this.escapeKeyHandler);
      this.escapeKeyHandler = null;
    }
    if (this.gameOutHandler) {
      this.input.off(Phaser.Input.Events.GAME_OUT, this.gameOutHandler);
      this.gameOutHandler = null;
    }
    if (this.windowBlurHandler && typeof window !== 'undefined') {
      window.removeEventListener('blur', this.windowBlurHandler);
      this.windowBlurHandler = null;
    }
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
  }

  private getInputTimestamp(): number {
    const sceneNow = this.time?.now;
    if (typeof sceneNow === 'number' && Number.isFinite(sceneNow)) {
      return sceneNow;
    }
    if (typeof performance !== 'undefined') {
      return performance.now();
    }
    return Date.now();
  }

  private applyCursorPosition(x: number, y: number): void {
    this.cursorX = Phaser.Math.Clamp(x, 0, GAME_WIDTH);
    this.cursorY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT);
  }

  private resetMovementInput(): void {
    this.inputController?.resetMovementInput(this.getInputTimestamp());
  }

  private shouldUseKeyboardMovement(timestamp: number = this.getInputTimestamp()): boolean {
    if (!this.inputController) {
      return false;
    }
    return this.inputController.shouldUseKeyboardMovement(timestamp);
  }

  private onDishDestroyed(data: { dish: Dish; x: number; y: number; byAbility?: boolean }): void {
    const { dish, x, y, byAbility } = data;
    const dishData = Data.getDishData(dish.getDishType());

    // 지뢰(Bomb) 또는 특수 위험 접시 터짐 처리
    if (dish.isDangerous()) {
      // 어빌리티(수호의 오브 등)로 파괴된 경우 데미지 없음
      if (!byAbility && dishData) {
        // 설정된 데미지 적용 (기본값 1)
        const damage = dishData.playerDamage ?? 1;
        this.healthSystem.takeDamage(damage);

        // 설정에 따라 콤보 리셋
        if (dishData.resetCombo) {
          this.comboSystem.reset();
        }
      } else if (byAbility) {
        // 어빌리티로 파괴 시 "REMOVED!" 텍스트 표시 (다국어 지원)
        this.damageText.showText(x, y - 40, Data.t('feedback.bomb_removed'), COLORS.CYAN);
      }

      // 피드백 효과 (폭발) - 어빌리티에 의한 경우 텍스트 및 강한 효과 생략
      this.feedbackSystem.onBombExploded(x, y, !!byAbility);

      // 풀에서 제거
      this.dishes.remove(dish);
      this.dishPool.release(dish);
      return;
    }

    // ===== 콤보 증가 (어빌리티 파괴 제외) =====
    if (!byAbility) {
      const laserConfig = Data.gameConfig.monsterAttack.laser;
      const isLaserFiring = this.activeLasers.some((l) => l.isFiring);
      const comboBonus = isLaserFiring ? laserConfig.bonus.comboAmount : 0; // 레이저 발사 중 보너스

      this.comboSystem.increment(comboBonus);

      // 보너스 피드백
      if (isLaserFiring) {
        this.damageText.showText(x, y - 40, Data.t('feedback.laser_bonus'), COLORS.YELLOW);
        this.soundSystem.playBossImpactSound(); // 보너스 느낌의 소리
      }
    }

    // 현재 커서 반경 계산
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 피드백 효과
    this.feedbackSystem.onDishDestroyed(
      x,
      y,
      dish.getColor(),
      dish.getDishType(),
      this.comboSystem.getCombo(),
      cursorRadius
    );

    // ===== 업그레이드 효과 적용 =====
    // 전기 충격 (주변 접시에 데미지)
    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    if (electricLevel > 0) {
      const electricRadius = this.upgradeSystem.getElectricShockRadius();
      this.applyElectricShock(x, y, electricLevel, dish, electricRadius);
    }

    // 풀에서 제거
    this.dishes.remove(dish);
    this.dishPool.release(dish);
  }

  // 전기 충격: 주변 접시에 데미지
  private applyElectricShock(
    x: number,
    y: number,
    _level: number,
    excludeDish: Dish,
    radius: number
  ): void {
    const targets: { x: number; y: number }[] = [];
    const damage = this.upgradeSystem.getElectricShockDamage();

    this.dishPool.forEach((dish) => {
      if (dish !== excludeDish && dish.active && !dish.isDangerous()) {
        const distance = Phaser.Math.Distance.Between(x, y, dish.x, dish.y);
        if (distance < radius) {
          targets.push({ x: dish.x, y: dish.y });
          dish.applyDamage(damage, true);
        }
      }
    });

    if (targets.length > 0) {
      this.feedbackSystem.onElectricShock(x, y, targets);
    }
  }

  spawnDish(type: string, x: number, y: number, speedMultiplier: number = 1): void {
    // 폭탄일 경우 경고 표시 후 딜레이하여 스폰
    if (type === 'bomb') {
      this.showBombWarningAndSpawn(x, y, speedMultiplier);
      return;
    }

    this.spawnDishImmediate(type, x, y, speedMultiplier);
  }

  private spawnDishImmediate(
    type: string,
    x: number,
    y: number,
    speedMultiplier: number = 1
  ): void {
    const dish = this.dishPool.acquire();
    if (dish) {
      // 업그레이드 옵션 적용
      const options = {
        cursorSizeBonus: this.upgradeSystem.getCursorSizeBonus(),
        damageBonus: this.upgradeSystem.getCursorDamageBonus(),
        criticalChance: this.upgradeSystem.getCriticalChanceBonus(),
      };
      dish.spawn(x, y, type, speedMultiplier, options);
      this.dishes.add(dish);
    }
  }

  private showBombWarningAndSpawn(x: number, y: number, speedMultiplier: number): void {
    this.getPlayerAttackRenderer().showBombWarning(
      x,
      y,
      {
        duration: 500,
        radius: 50,
        blinkInterval: 100,
      },
      () => {
        if (!this.isGameOver) {
          this.spawnDishImmediate('bomb', x, y, speedMultiplier);
        }
      }
    );
  }

  private pauseGame(): void {
    if (this.isPaused) return;
    this.resetMovementInput();
    this.isPaused = true;
    this.syncSimulationPauseState();
    EventBus.getInstance().emit(GameEvents.GAME_PAUSED);
  }

  private resumeGame(): void {
    if (!this.isPaused) return;
    this.resetMovementInput();
    this.isPaused = false;
    this.syncSimulationPauseState();
    EventBus.getInstance().emit(GameEvents.GAME_RESUMED);
  }

  private gameOver(): void {
    this.isGameOver = true;
    this.isPaused = false;
    this.isDockPaused = false;
    this.syncSimulationPauseState();
    this.physics.pause();

    // BGM 정지
    if (this.bgm) {
      this.bgm.stop();
    }

    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.cleanup();
      this.scene.start('GameOverScene', {
        maxCombo: this.comboSystem.getMaxCombo(),
        wave: this.waveSystem.getCurrentWave(),
        time: this.gameTime,
      });
    });
  }

  private cleanup(): void {
    this.resetMovementInput();
    this.teardownInputHandlers();
    EventBus.getInstance().clear();
    this.activeLasers = [];
    this.laserNextTimeByBossId.clear();
    this.laserRenderer.clear();
    this.dishPool.clear();
    this.healthPackSystem.clear();
    this.inGameUpgradeUI.destroy();
    this.waveCountdownUI.destroy();
    this.bosses.forEach((boss) => boss.destroy());
    this.bosses.clear();
    this.bossOverlapLastHitTimeByBossId.clear();
    if (this.cursorTrail) this.cursorTrail.destroy();
    if (this.gaugeSystem) this.gaugeSystem.destroy();
    if (this.orbRenderer) this.orbRenderer.destroy();
    if (this.blackHoleRenderer) this.blackHoleRenderer.destroy();
    if (this.blackHoleSystem) this.blackHoleSystem.clear();
    this.playerAttackRenderer?.destroy();
    this.playerAttackRenderer = null;
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 키보드 이동 처리 (포인터 최신 입력 우선)
    if (this.inputController) {
      const now = this.getInputTimestamp();
      const shouldUseKeyboard = this.shouldUseKeyboardMovement(now);
      const axis = this.inputController.getKeyboardAxis(delta, now);
      const speed = Data.gameConfig.player.cursorSpeed;
      const moveDistance = (speed * delta) / 1000;
      if (shouldUseKeyboard && axis.isMoving) {
        this.applyCursorPosition(
          this.cursorX + axis.x * moveDistance,
          this.cursorY + axis.y * moveDistance
        );
      }
    }

    // 커서 범위 계산 (여러 곳에서 사용하므로 미리 계산)
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
    const hudContext = this.getHudFrameContext();

    // 업그레이드 선택 중에는 생존 시간과 주요 게임 로직 중단
    if (this.isUpgrading) {
      this.setDockPaused(false);
      this.inGameUpgradeUI.update(delta);
      this.hud.update(this.gameTime, hudContext, delta);
      this.starBackground.update(delta, _time, Data.gameConfig.gameGrid.speed);
      this.gridRenderer.update(delta);
      this.cursorTrail.update(delta, cursorRadius, this.cursorX, this.cursorY); // 트레일 업데이트 추가
      this.updateAttackRangeIndicator();
      return;
    }

    const hudInteraction = this.hud.updateInteractionState(hudContext, delta);
    this.setDockPaused(hudInteraction.shouldPauseGame);
    if (this.isDockPaused) {
      this.hud.render(this.gameTime);
      this.cursorTrail.update(delta, cursorRadius, this.cursorX, this.cursorY);
      this.updateAttackRangeIndicator();
      return;
    }

    // 시간 업데이트
    this.gameTime += delta;

    // 시스템 업데이트
    this.comboSystem.setWave(this.waveSystem.getCurrentWave());
    this.comboSystem.update(delta);
    this.waveSystem.update(delta);
    this.upgradeSystem.update(delta, this.gameTime);
    this.healthPackSystem.update(delta, this.gameTime);
    this.healthPackSystem.checkCollection(this.cursorX, this.cursorY, cursorRadius);

    // 접시 업데이트
    this.dishPool.forEach((dish) => {
      dish.update(delta);
    });

    // HUD 업데이트
    this.hud.render(this.gameTime);

    // 보스 업데이트
    this.bosses.forEach((boss) => {
      boss.update(delta);
    });

    this.updateBossOverlapDamage(cursorRadius);

    // 커서 트레일 업데이트
    this.cursorTrail.update(delta, cursorRadius, this.cursorX, this.cursorY);

    // 인게임 업그레이드 UI 업데이트
    this.inGameUpgradeUI.update(delta);

    // 그리드 배경 업데이트
    this.gridRenderer.update(delta);

    // 별 배경 업데이트 (그리드보다 10배 느리게 흐름)
    this.starBackground.update(delta, _time, Data.gameConfig.gameGrid.speed);

    // 자기장 효과 업데이트
    this.updateMagnetEffect(delta);

    // 블랙홀 어빌리티 업데이트
    this.blackHoleSystem.update(delta, this.gameTime);
    this.blackHoleRenderer.render(this.blackHoleSystem.getBlackHoles(), this.gameTime);

    // 구체 어빌리티 업데이트
    this.orbSystem.update(
      delta,
      this.gameTime,
      this.cursorX,
      this.cursorY,
      this.dishPool
    );
    this.orbRenderer.render(this.orbSystem.getOrbs());

    // 커서 범위 기반 공격 처리
    this.updateCursorAttack();

    // 공격 범위 인디케이터 업데이트
    this.updateAttackRangeIndicator();

    // 보스 레이저 업데이트
    this.updateLaser(delta);
  }

  private updateMagnetEffect(delta: number): void {
    const magnetLevel = this.upgradeSystem.getMagnetLevel();

    // 자기장 레벨이 0이면 모든 접시의 상태만 초기화하고 리턴
    if (magnetLevel <= 0) {
      this.dishPool.forEach((dish) => {
        if (dish.active) dish.setBeingPulled(false);
      });
      return;
    }

    const cursorX = this.cursorX;
    const cursorY = this.cursorY;

    // 자기장 범위/힘 계산
    const magnetRadius = this.upgradeSystem.getMagnetRadius();
    const magnetForce = this.upgradeSystem.getMagnetForce();

    // delta를 초 단위로 변환
    const deltaSeconds = delta / 1000;

    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      // 상태 초기화
      dish.setBeingPulled(false);

      // 폭탄(dangerous)은 당기지 않음
      if (dish.isDangerous()) return;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, dish.x, dish.y);
      if (dist > magnetRadius || dist < MAGNET.MIN_PULL_DISTANCE) return;

      // 당겨지는 상태 설정
      dish.setBeingPulled(true);

      // 거리 기반 선형 감쇠 (가까울수록 강함)
      const pullStrength = 1 - dist / magnetRadius;
      const pullAmount = magnetForce * pullStrength * deltaSeconds;

      // 커서 방향으로 이동
      const angle = Phaser.Math.Angle.Between(dish.x, dish.y, cursorX, cursorY);
      dish.x += Math.cos(angle) * pullAmount;
      dish.y += Math.sin(angle) * pullAmount;

      // 자기장 연출 추가: 낮은 확률로 파티클 생성 또는 거리 기반으로 생성
      if (Math.random() < 0.15) {
        this.particleManager.createMagnetPullEffect(dish.x, dish.y, cursorX, cursorY);
      }
    });
  }

  private updateCursorAttack(): void {
    const cursorX = this.cursorX;
    const cursorY = this.cursorY;

    // 커서 히트박스 크기
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 모든 접시와 거리 계산
    this.dishPool.forEach((dish) => {
      if (!dish.active) return;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, dish.x, dish.y);
      const dishRadius = dish.getSize(); // 접시 크기
      const hitDistance = cursorRadius + dishRadius;

      dish.setInCursorRange(dist <= hitDistance);
    });
  }

  private updateBossOverlapDamage(cursorRadius: number): void {
    const damageConfig = Data.dishes.damage;
    const baseDamage = Math.max(0, damageConfig.playerDamage + this.upgradeSystem.getCursorDamageBonus());
    const criticalChance = Phaser.Math.Clamp(
      (damageConfig.criticalChance ?? 0) + this.upgradeSystem.getCriticalChanceBonus(),
      0,
      1
    );
    const criticalMultiplier = damageConfig.criticalMultiplier ?? 1;
    const tickInterval = damageConfig.damageInterval;
    const overlapBossIds = new Set<string>();

    this.bosses.forEach((boss, bossId) => {
      if (!boss.visible) return;
      if (!this.monsterSystem.isAlive(bossId)) return;

      const scaleX = Number.isFinite(boss.scaleX) ? Math.abs(boss.scaleX) : 1;
      const scaleY = Number.isFinite(boss.scaleY) ? Math.abs(boss.scaleY) : 1;
      const bossScale = Math.max(scaleX, scaleY, Number.EPSILON);
      const bossRadius = Data.boss.visual.armor.radius * bossScale;
      const distance = Phaser.Math.Distance.Between(this.cursorX, this.cursorY, boss.x, boss.y);
      if (distance > cursorRadius + bossRadius) return;

      overlapBossIds.add(bossId);

      const lastHitTime = this.bossOverlapLastHitTimeByBossId.get(bossId);
      if (lastHitTime !== undefined && this.gameTime - lastHitTime < tickInterval) return;
      if (baseDamage <= 0) return;

      let damage = baseDamage;
      const isCritical = Math.random() < criticalChance;
      if (isCritical) {
        damage *= criticalMultiplier;
      }

      this.monsterSystem.takeDamage(bossId, damage, this.cursorX, this.cursorY);
      this.feedbackSystem.onBossContactDamaged(boss.x, boss.y, damage, isCritical);
      this.bossOverlapLastHitTimeByBossId.set(bossId, this.gameTime);
    });

    const staleBossIds: string[] = [];
    this.bossOverlapLastHitTimeByBossId.forEach((_lastHitTime, bossId) => {
      if (!overlapBossIds.has(bossId)) {
        staleBossIds.push(bossId);
      }
    });
    staleBossIds.forEach((bossId) => this.bossOverlapLastHitTimeByBossId.delete(bossId));
  }

  private updateAttackRangeIndicator(): void {
    const x = this.cursorX;
    const y = this.cursorY;

    // 커서 히트박스 크기 계산
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 자기장 데이터
    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    const magnetRadius = this.upgradeSystem.getMagnetRadius();

    // 전기 충격 데이터
    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    const currentHp = this.healthSystem.getHp();
    const maxHp = this.healthSystem.getMaxHp();

    // 렌더링 위임
    this.cursorRenderer.renderAttackIndicator(
      x,
      y,
      cursorRadius,
      this.gaugeRatio,
      magnetRadius,
      magnetLevel,
      electricLevel,
      this.gameTime,
      currentHp,
      maxHp
    );
  }

  private clearAllDishes(): void {
    const activeDishes = this.dishPool.getActiveObjects();
    for (const dish of activeDishes) {
      dish.deactivate();
      this.dishes.remove(dish);
      this.dishPool.release(dish);
    }
  }

  getDishPool(): ObjectPool<Dish> {
    return this.dishPool;
  }

  // ===== 보스 레이저 공격 시스템 =====
  private setNextLaserTime(bossId: string): void {
    const laserConfig = this.getBossLaserConfig(bossId);
    if (!laserConfig || laserConfig.maxCount === 0) {
      this.laserNextTimeByBossId.set(bossId, this.gameTime + 5000);
      return;
    }

    const interval = Phaser.Math.Between(laserConfig.minInterval, laserConfig.maxInterval);
    this.laserNextTimeByBossId.set(bossId, this.gameTime + interval);
  }

  private updateLaser(delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // 현재 활성 보스가 아닌 레이저는 정리
    this.activeLasers = this.activeLasers.filter((laser) => {
      return this.getAliveVisibleBossById(laser.bossId) !== null;
    });

    const aliveBossIds = this.monsterSystem
      .getAliveBossIds()
      .filter((bossId) => this.getAliveVisibleBossById(bossId) !== null);
    const aliveBossIdSet = new Set(aliveBossIds);

    const staleTimerBossIds: string[] = [];
    this.laserNextTimeByBossId.forEach((_nextTime, bossId) => {
      if (!aliveBossIdSet.has(bossId)) {
        staleTimerBossIds.push(bossId);
      }
    });
    staleTimerBossIds.forEach((bossId) => this.laserNextTimeByBossId.delete(bossId));

    for (const bossId of aliveBossIds) {
      const laserConfig = this.getBossLaserConfig(bossId);
      if (!laserConfig) continue;

      const nextTime = this.laserNextTimeByBossId.get(bossId);
      if (nextTime === undefined) {
        this.setNextLaserTime(bossId);
        continue;
      }

      if (this.gameTime < nextTime) {
        continue;
      }

      if (laserConfig.maxCount > 0) {
        const activeLaserCountForBoss = this.activeLasers.filter(
          (laser) => laser.bossId === bossId
        ).length;
        if (activeLaserCountForBoss < laserConfig.maxCount) {
          this.triggerBossLaserAttack(bossId);
        }
      }

      this.setNextLaserTime(bossId);
    }

    // 레이저 렌더링용 데이터 준비 (항상 렌더링하여 빈 상태일 때도 이전 레이저가 지워지도록 함)
    const laserData = this.activeLasers.map((l) => ({
      ...l,
      progress: (this.gameTime - l.startTime) / Data.gameConfig.monsterAttack.laser.warningDuration,
    }));

    this.laserRenderer.render(laserData);

    if (this.activeLasers.length > 0) {
      this.checkLaserCollisions(delta);
    }
  }

  private cancelBossChargingLasers(bossId: string): void {
    let cancelledCount = 0;

    // 해당 보스의 충전 중(Warning) 레이저만 제거
    for (let i = this.activeLasers.length - 1; i >= 0; i--) {
      const laser = this.activeLasers[i];
      if (laser.bossId === bossId && laser.isWarning) {
        this.activeLasers.splice(i, 1);
        cancelledCount++;
      }
    }

    if (cancelledCount > 0) {
      const boss = this.bosses.get(bossId);
      boss?.unfreeze();

      // 시각적 피드백: 레이저가 취소되었음을 알림 (다국어 지원)
      const textX = boss?.x ?? this.cursorX;
      const textY = boss ? boss.y - 60 : this.cursorY - 60;
      this.damageText.showText(textX, textY, Data.t('feedback.interrupted'), COLORS.CYAN);

      // 렌더러 즉시 갱신 (잔상 제거)
      if (this.activeLasers.length === 0) {
        this.laserRenderer.clear();
      }
    }
  }

  private triggerBossLaserAttack(bossId: string): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const boss = this.getAliveVisibleBossById(bossId);
    if (!boss) return;

    const startX = boss.x;
    const startY = boss.y;

    // 보스→커서 방향 벡터
    const dx = this.cursorX - startX;
    const dy = this.cursorY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);

    // 보스와 커서가 거의 같은 위치면 발사 취소 (불합리한 피격 방지)
    if (len < 10) {
      return;
    }

    const dirX = dx / len;
    const dirY = dy / len;

    // 보스→커서 방향으로 화면 경계까지 연장한 끝점
    const endPoint = this.findScreenEdgePoint(startX, startY, dirX, dirY);

    // 레이저 발사 동안 보스 이동 정지
    boss.freeze();
    const laserWave = this.waveSystem.getCurrentWave();

    const laser = {
      bossId,
      x1: startX,
      y1: startY,
      x2: endPoint.x,
      y2: endPoint.y,
      isWarning: true,
      isFiring: false,
      startTime: this.gameTime,
    };
    this.activeLasers.push(laser);

    this.soundSystem.playBossChargeSound();

    this.time.delayedCall(config.warningDuration, () => {
      if (this.isGameOver || this.waveSystem.getCurrentWave() !== laserWave) {
        const staleIndex = this.activeLasers.indexOf(laser);
        if (staleIndex > -1) this.activeLasers.splice(staleIndex, 1);
        const staleBoss = this.bosses.get(bossId);
        staleBoss?.unfreeze();
        if (this.activeLasers.length === 0) this.laserRenderer.clear();
        return;
      }

      if (!this.getAliveVisibleBossById(bossId)) {
        const staleIndex = this.activeLasers.indexOf(laser);
        if (staleIndex > -1) this.activeLasers.splice(staleIndex, 1);
        const staleBoss = this.bosses.get(bossId);
        staleBoss?.unfreeze();
        if (this.activeLasers.length === 0) this.laserRenderer.clear();
        return;
      }

      laser.isWarning = false;
      laser.isFiring = true;

      this.soundSystem.playBossFireSound();
      this.cameras.main.shake(200, 0.005);

      this.time.delayedCall(config.fireDuration, () => {
        const index = this.activeLasers.indexOf(laser);
        if (index > -1) {
          this.activeLasers.splice(index, 1);
          if (this.activeLasers.length === 0) {
            this.laserRenderer.clear();
          }
        }
        // 레이저 종료 후 보스 이동 재개
        const ownerBoss = this.bosses.get(bossId);
        ownerBoss?.unfreeze();
      });
    });
  }

  private findScreenEdgePoint(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number
  ): { x: number; y: number } {
    const padding = Data.gameConfig.monsterAttack.laser.trajectory.spawnPadding;
    const minX = padding;
    const maxX = GAME_WIDTH - padding;
    const minY = padding;
    const maxY = GAME_HEIGHT - padding;

    let tMin = Infinity;

    // 각 경계면까지의 t 값 계산 (ray: P = start + t * dir)
    if (dirX !== 0) {
      const tRight = (maxX - startX) / dirX;
      if (tRight > 0 && tRight < tMin) tMin = tRight;
      const tLeft = (minX - startX) / dirX;
      if (tLeft > 0 && tLeft < tMin) tMin = tLeft;
    }
    if (dirY !== 0) {
      const tBottom = (maxY - startY) / dirY;
      if (tBottom > 0 && tBottom < tMin) tMin = tBottom;
      const tTop = (minY - startY) / dirY;
      if (tTop > 0 && tTop < tMin) tMin = tTop;
    }

    // 안전장치: 교차점을 찾지 못한 경우 충분히 먼 점 반환
    if (tMin === Infinity) {
      tMin = Math.max(GAME_WIDTH, GAME_HEIGHT);
    }

    return {
      x: startX + dirX * tMin,
      y: startY + dirY * tMin,
    };
  }

  public getCursorPosition(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  public isUpgradeSelectionVisible(): boolean {
    return this.isUpgrading && this.inGameUpgradeUI.isVisible();
  }

  private getHudFrameContext(): HudFrameContext {
    return {
      cursorX: this.cursorX,
      cursorY: this.cursorY,
      isUpgradeSelectionVisible: this.isUpgradeSelectionVisible(),
    };
  }

  private checkLaserCollisions(_delta: number): void {
    const px = this.cursorX;
    const py = this.cursorY;
    const config = Data.gameConfig.monsterAttack.laser;

    // 커서 히트박스 크기
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    for (const laser of this.activeLasers) {
      if (!laser.isFiring) continue;

      // 점(px, py)과 직선(laser.x1, y1 -> x2, y2) 사이의 거리 계산
      const lineLenSq = Math.pow(laser.x2 - laser.x1, 2) + Math.pow(laser.y2 - laser.y1, 2);
      if (lineLenSq === 0) continue;

      // 선분 위의 가장 가까운 점 찾기 (t: 0 to 1)
      let t =
        ((px - laser.x1) * (laser.x2 - laser.x1) + (py - laser.y1) * (laser.y2 - laser.y1)) /
        lineLenSq;
      t = Math.max(0, Math.min(1, t));

      const nearestX = laser.x1 + t * (laser.x2 - laser.x1);
      const nearestY = laser.y1 + t * (laser.y2 - laser.y1);

      const dist = Phaser.Math.Distance.Between(px, py, nearestX, nearestY);

      if (dist < config.width / 2 + cursorRadius) {
        this.handleLaserHit();
        break;
      }
    }
  }

  private lastLaserHitTime: number = 0;
  private handleLaserHit(): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const now = this.gameTime;
    if (now - this.lastLaserHitTime < config.bonus.invincibilityDuration) return;

    this.lastLaserHitTime = now;
    this.healthSystem.takeDamage(1);
    this.feedbackSystem.onHpLost();
    this.soundSystem.playBossImpactSound();

    // 카메라 흔들림 강화
    this.cameras.main.shake(300, 0.01);
  }

  private setDockPaused(paused: boolean): void {
    if (this.isDockPaused === paused) {
      return;
    }

    this.isDockPaused = paused;
    this.syncSimulationPauseState();
  }

  private syncSimulationPauseState(): void {
    const shouldPauseSimulation = this.isPaused || this.isDockPaused;
    if (this.isSimulationPaused === shouldPauseSimulation) {
      return;
    }

    this.isSimulationPaused = shouldPauseSimulation;

    if (shouldPauseSimulation) {
      this.physics.pause();
      this.time.timeScale = 0;
      this.tweens.pauseAll();
      return;
    }

    this.time.timeScale = 1;
    this.tweens.resumeAll();

    if (!this.isGameOver) {
      this.physics.resume();
    }
  }
}
