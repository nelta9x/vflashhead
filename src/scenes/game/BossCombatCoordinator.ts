import Phaser from 'phaser';
import { Data } from '../../data/DataManager';
import { CURSOR_HITBOX, GAME_HEIGHT, GAME_WIDTH } from '../../data/constants';
import { Entity } from '../../entities/Entity';
import type { LaserRenderer } from '../../plugins/builtin/entities/LaserRenderer';
import type { DamageText } from '../../ui/DamageText';
import type { FeedbackSystem } from '../../systems/FeedbackSystem';
import type { HealthSystem } from '../../systems/HealthSystem';
import type { MonsterSystem } from '../../systems/MonsterSystem';
import type { SoundSystem } from '../../systems/SoundSystem';
import type { UpgradeSystem } from '../../systems/UpgradeSystem';
import type { WaveSystem } from '../../systems/WaveSystem';
import type {
  BossInteractionGateway,
  BossRadiusSnapshot,
  BossTargetSnapshot,
  BossVisibilitySnapshot,
  CursorSnapshot,
} from './GameSceneContracts';
import type { EntityDamageService } from '../../systems/EntityDamageService';
import type { StatusEffectManager } from '../../systems/StatusEffectManager';
import type { World } from '../../world';
import type { GameEnvironment } from './GameEnvironment';
import { BossAttackScheduler } from './boss/BossAttackScheduler';
import { BossContactDamageController } from './boss/BossContactDamageController';
import { BossLaserController } from './boss/BossLaserController';
import { BossRosterSync } from './boss/BossRosterSync';
import type { ActiveLaser } from './boss/BossCombatTypes';

interface BossCombatCoordinatorDeps {
  scene: Phaser.Scene;
  waveSystem: WaveSystem;
  monsterSystem: MonsterSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  damageText: DamageText;
  laserRenderer: LaserRenderer;
  healthSystem: HealthSystem;
  upgradeSystem: UpgradeSystem;
  damageService: EntityDamageService;
  world: World;
  statusEffectManager: StatusEffectManager;
  gameEnv: GameEnvironment;
}

export class BossCombatCoordinator implements BossInteractionGateway {
  private readonly scene: Phaser.Scene;
  private readonly waveSystem: WaveSystem;
  private readonly monsterSystem: MonsterSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly damageText: DamageText;
  private readonly laserRenderer: LaserRenderer;
  private readonly healthSystem: HealthSystem;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly gameEnv: GameEnvironment;

  private readonly bosses = new Map<string, Entity>();
  private readonly laserNextTimeByBossId = new Map<string, number>();
  private readonly bossOverlapLastHitTimeByBossId = new Map<string, number>();
  private activeLasers: ActiveLaser[] = [];
  private lastLaserHitTime = 0;
  private currentGameTime = 0;
  private lastCursor: CursorSnapshot = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
  };

  private readonly bossRosterSync: BossRosterSync;
  private readonly bossLaserController: BossLaserController;
  private readonly bossContactDamageController: BossContactDamageController;
  private readonly bossAttackScheduler: BossAttackScheduler;

  constructor(deps: BossCombatCoordinatorDeps) {
    this.scene = deps.scene;
    this.waveSystem = deps.waveSystem;
    this.monsterSystem = deps.monsterSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.damageText = deps.damageText;
    this.laserRenderer = deps.laserRenderer;
    this.healthSystem = deps.healthSystem;
    this.upgradeSystem = deps.upgradeSystem;
    this.gameEnv = deps.gameEnv;

    this.bossRosterSync = new BossRosterSync({
      scene: this.scene,
      waveSystem: this.waveSystem,
      monsterSystem: this.monsterSystem,
      laserRenderer: this.laserRenderer,
      bosses: this.bosses,
      laserNextTimeByBossId: this.laserNextTimeByBossId,
      bossOverlapLastHitTimeByBossId: this.bossOverlapLastHitTimeByBossId,
      getActiveLasers: () => this.activeLasers,
      setActiveLasers: (lasers) => {
        this.activeLasers = lasers;
      },
      setNextLaserTime: (bossId, gameTime) => this.setNextLaserTime(bossId, gameTime),
      getCurrentGameTime: () => this.currentGameTime,
      damageService: deps.damageService,
      world: deps.world,
      statusEffectManager: deps.statusEffectManager,
      initBossAttackTimers: (bossId, gameTime) => this.bossAttackScheduler.initBossTimers(bossId, gameTime),
    });

    this.bossLaserController = new BossLaserController({
      scene: this.scene,
      waveSystem: this.waveSystem,
      monsterSystem: this.monsterSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      damageText: this.damageText,
      laserRenderer: this.laserRenderer,
      healthSystem: this.healthSystem,
      upgradeSystem: this.upgradeSystem,
      isGameOver: () => this.gameEnv.isGameOver,
      damageService: deps.damageService,
      bosses: this.bosses,
      laserNextTimeByBossId: this.laserNextTimeByBossId,
      getActiveLasers: () => this.activeLasers,
      setActiveLasers: (lasers) => {
        this.activeLasers = lasers;
      },
      getLastLaserHitTime: () => this.lastLaserHitTime,
      setLastLaserHitTime: (time) => {
        this.lastLaserHitTime = time;
      },
    });

    this.bossContactDamageController = new BossContactDamageController({
      bosses: this.bosses,
      monsterSystem: this.monsterSystem,
      feedbackSystem: this.feedbackSystem,
      upgradeSystem: this.upgradeSystem,
      healthSystem: this.healthSystem,
      bossOverlapLastHitTimeByBossId: this.bossOverlapLastHitTimeByBossId,
    });

    this.bossAttackScheduler = new BossAttackScheduler({
      scene: this.scene,
      waveSystem: this.waveSystem,
      monsterSystem: this.monsterSystem,
      healthSystem: this.healthSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      bosses: this.bosses,
      isGameOver: () => this.gameEnv.isGameOver,
    });
  }

  public syncBossesForCurrentWave(): void {
    this.bossRosterSync.syncBossesForCurrentWave();
  }

  public update(delta: number, gameTime: number, cursor: CursorSnapshot): void {
    this.currentGameTime = gameTime;
    this.lastCursor = { ...cursor };

    if (this.gameEnv.isGameOver || this.gameEnv.isPaused) {
      return;
    }

    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + this.upgradeSystem.getCursorSizeBonus());
    this.bossContactDamageController.updateBossOverlapDamage(cursor, cursorRadius, gameTime);
    this.updateLaser(delta, gameTime, cursor);
    this.bossAttackScheduler.update(delta, gameTime, cursor, cursorRadius);
  }

  /** Expose active boss entities for external iteration */
  public forEachBoss(callback: (boss: Entity) => void): void {
    this.bosses.forEach((boss) => callback(boss));
  }

  public clearForWaveTransition(): void {
    this.bossRosterSync.clearForWaveTransition();
    this.bossAttackScheduler.clear();
  }

  public getVisibleBossSnapshots(): BossVisibilitySnapshot[] {
    const visibleBosses: BossVisibilitySnapshot[] = [];
    this.bosses.forEach((boss, bossId) => {
      if (!boss.visible) return;
      visibleBosses.push({
        id: bossId,
        x: boss.x,
        y: boss.y,
        visible: true,
      });
    });
    return visibleBosses;
  }

  public getAliveVisibleBossSnapshotsWithRadius(): BossRadiusSnapshot[] {
    const snapshots: BossRadiusSnapshot[] = [];
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

  public findNearestAliveBoss(x: number, y: number): BossTargetSnapshot | null {
    let nearestBossId: string | null = null;
    let nearestBoss: Entity | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [bossId, boss] of this.bosses.entries()) {
      if (!boss.visible) continue;
      if (!this.monsterSystem.isAlive(bossId)) continue;

      const distance = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBossId = bossId;
        nearestBoss = boss;
      }
    }

    if (!nearestBoss || !nearestBossId) return null;
    return {
      id: nearestBossId,
      x: nearestBoss.x,
      y: nearestBoss.y,
    };
  }

  public getAliveBossTarget(bossId: string): BossTargetSnapshot | null {
    const boss = this.getAliveVisibleBossById(bossId);
    if (!boss) return null;
    return {
      id: bossId,
      x: boss.x,
      y: boss.y,
    };
  }

  public cancelChargingLasers(bossId: string): void {
    this.bossLaserController.cancelChargingLasers(bossId, this.lastCursor);
  }

  public damageBoss(bossId: string, amount: number, sourceX: number, sourceY: number, isCritical: boolean): void {
    this.monsterSystem.takeDamage(bossId, amount, sourceX, sourceY);
    const bossTarget = this.getAliveBossTarget(bossId);
    const textX = bossTarget?.x ?? sourceX;
    const textY = bossTarget?.y ?? sourceY;
    this.feedbackSystem.onBossContactDamaged(textX, textY, amount, isCritical);
  }

  public isAnyLaserFiring(): boolean {
    return this.bossLaserController.isAnyLaserFiring();
  }

  public destroy(): void {
    this.clearForWaveTransition();
    this.bossAttackScheduler.destroy();
    this.bosses.forEach((boss) => boss.destroy());
    this.bosses.clear();
    this.bossOverlapLastHitTimeByBossId.clear();
  }

  private getAliveVisibleBossById(bossId: string): Entity | null {
    const boss = this.bosses.get(bossId);
    if (!boss) return null;
    if (!boss.visible) return null;
    if (!this.monsterSystem.isAlive(bossId)) return null;
    return boss;
  }

  private updateLaser(delta: number, gameTime: number, cursor: CursorSnapshot): void {
    this.bossLaserController.updateLaser(delta, gameTime, cursor);
    this.checkLaserCollisions(delta, gameTime, cursor);
  }

  private checkLaserCollisions(delta: number, gameTime: number, cursor: CursorSnapshot): void {
    this.bossLaserController.checkLaserCollisions(delta, gameTime, cursor);
  }

  private setNextLaserTime(bossId: string, gameTime: number): void {
    this.bossLaserController.setNextLaserTime(bossId, gameTime);
  }
}
