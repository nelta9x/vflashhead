import Phaser from 'phaser';
import { Data } from '../../data/DataManager';
import { COLORS, CURSOR_HITBOX, GAME_HEIGHT, GAME_WIDTH } from '../../data/constants';
import type { WaveBossConfig } from '../../data/types';
import { Boss } from '../../entities/Boss';
import type { LaserRenderer } from '../../effects/LaserRenderer';
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

interface ActiveLaser {
  bossId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isFiring: boolean;
  isWarning: boolean;
  startTime: number;
}

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
  isGameOver: () => boolean;
  isPaused: () => boolean;
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
  private readonly isGameOver: () => boolean;
  private readonly isPaused: () => boolean;

  private readonly bosses = new Map<string, Boss>();
  private readonly laserNextTimeByBossId = new Map<string, number>();
  private readonly bossOverlapLastHitTimeByBossId = new Map<string, number>();
  private activeLasers: ActiveLaser[] = [];
  private lastLaserHitTime = 0;
  private currentGameTime = 0;
  private lastCursor: CursorSnapshot = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
  };

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
    this.isGameOver = deps.isGameOver;
    this.isPaused = deps.isPaused;
  }

  public syncBossesForCurrentWave(): void {
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
          this.scene,
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
      this.setNextLaserTime(bossConfig.id, this.currentGameTime);
    }

    if (this.activeLasers.length === 0) {
      this.laserRenderer.clear();
    }
  }

  public update(delta: number, gameTime: number, cursor: CursorSnapshot): void {
    this.currentGameTime = gameTime;
    this.lastCursor = { ...cursor };

    if (this.isGameOver() || this.isPaused()) {
      return;
    }

    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + this.upgradeSystem.getCursorSizeBonus());
    this.updateBossOverlapDamage(cursor, cursorRadius, gameTime);
    this.updateLaser(delta, gameTime, cursor);
  }

  public updateBosses(delta: number): void {
    this.bosses.forEach((boss) => {
      boss.update(delta);
    });
  }

  public clearForWaveTransition(): void {
    this.activeLasers = [];
    this.laserNextTimeByBossId.clear();
    this.bosses.forEach((boss) => boss.unfreeze());
    this.laserRenderer.clear();
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
    let nearestBoss: Boss | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [bossId, boss] of this.bosses.entries()) {
      if (!boss.visible) continue;
      if (!this.monsterSystem.isAlive(bossId)) continue;

      const distance = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBoss = boss;
      }
    }

    if (!nearestBoss) return null;
    return {
      id: nearestBoss.getBossId(),
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
    let cancelledCount = 0;

    for (let i = this.activeLasers.length - 1; i >= 0; i--) {
      const laser = this.activeLasers[i];
      if (laser.bossId === bossId && laser.isWarning) {
        this.activeLasers.splice(i, 1);
        cancelledCount++;
      }
    }

    if (cancelledCount === 0) {
      return;
    }

    const boss = this.bosses.get(bossId);
    boss?.unfreeze();

    const textX = boss?.x ?? this.lastCursor.x;
    const textY = boss ? boss.y - 60 : this.lastCursor.y - 60;
    this.damageText.showText(textX, textY, Data.t('feedback.interrupted'), COLORS.CYAN);

    if (this.activeLasers.length === 0) {
      this.laserRenderer.clear();
    }
  }

  public isAnyLaserFiring(): boolean {
    return this.activeLasers.some((laser) => laser.isFiring);
  }

  public destroy(): void {
    this.clearForWaveTransition();
    this.bosses.forEach((boss) => boss.destroy());
    this.bosses.clear();
    this.bossOverlapLastHitTimeByBossId.clear();
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
        x: Phaser.Math.Clamp(
          centerX + index * Math.max(0, Math.floor(requiredDistance * 0.2)),
          minX,
          maxX
        ),
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

  private getBossLaserConfig(
    bossId: string
  ): { maxCount: number; minInterval: number; maxInterval: number } | null {
    const bossConfig = this.waveSystem
      .getCurrentWaveBosses()
      .find((candidate) => candidate.id === bossId);
    if (!bossConfig) return null;
    return bossConfig.laser;
  }

  private setNextLaserTime(bossId: string, gameTime: number): void {
    const laserConfig = this.getBossLaserConfig(bossId);
    if (!laserConfig || laserConfig.maxCount === 0) {
      this.laserNextTimeByBossId.set(bossId, gameTime + 5000);
      return;
    }

    const interval = Phaser.Math.Between(laserConfig.minInterval, laserConfig.maxInterval);
    this.laserNextTimeByBossId.set(bossId, gameTime + interval);
  }

  private updateLaser(delta: number, gameTime: number, cursor: CursorSnapshot): void {
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
        this.setNextLaserTime(bossId, gameTime);
        continue;
      }

      if (gameTime < nextTime) {
        continue;
      }

      if (laserConfig.maxCount > 0) {
        const activeLaserCountForBoss = this.activeLasers.filter(
          (laser) => laser.bossId === bossId
        ).length;
        if (activeLaserCountForBoss < laserConfig.maxCount) {
          this.triggerBossLaserAttack(bossId, gameTime, cursor);
        }
      }

      this.setNextLaserTime(bossId, gameTime);
    }

    const laserData = this.activeLasers.map((laser) => ({
      ...laser,
      progress: (gameTime - laser.startTime) / Data.gameConfig.monsterAttack.laser.warningDuration,
    }));
    this.laserRenderer.render(laserData);

    if (this.activeLasers.length > 0) {
      this.checkLaserCollisions(delta, gameTime, cursor);
    }
  }

  private triggerBossLaserAttack(
    bossId: string,
    gameTime: number,
    cursor: CursorSnapshot
  ): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const boss = this.getAliveVisibleBossById(bossId);
    if (!boss) return;

    const startX = boss.x;
    const startY = boss.y;

    const dx = cursor.x - startX;
    const dy = cursor.y - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10) {
      return;
    }

    const dirX = dx / len;
    const dirY = dy / len;
    const endPoint = this.findScreenEdgePoint(startX, startY, dirX, dirY);

    boss.freeze();
    const laserWave = this.waveSystem.getCurrentWave();

    const laser: ActiveLaser = {
      bossId,
      x1: startX,
      y1: startY,
      x2: endPoint.x,
      y2: endPoint.y,
      isWarning: true,
      isFiring: false,
      startTime: gameTime,
    };
    this.activeLasers.push(laser);

    this.soundSystem.playBossChargeSound();

    this.scene.time.delayedCall(config.warningDuration, () => {
      if (this.isGameOver() || this.waveSystem.getCurrentWave() !== laserWave) {
        this.removeLaserAndUnfreeze(laser, bossId);
        return;
      }

      if (!this.getAliveVisibleBossById(bossId)) {
        this.removeLaserAndUnfreeze(laser, bossId);
        return;
      }

      laser.isWarning = false;
      laser.isFiring = true;

      this.soundSystem.playBossFireSound();
      this.scene.cameras.main.shake(200, 0.005);

      this.scene.time.delayedCall(config.fireDuration, () => {
        const index = this.activeLasers.indexOf(laser);
        if (index > -1) {
          this.activeLasers.splice(index, 1);
          if (this.activeLasers.length === 0) {
            this.laserRenderer.clear();
          }
        }

        const ownerBoss = this.bosses.get(bossId);
        ownerBoss?.unfreeze();
      });
    });
  }

  private removeLaserAndUnfreeze(laser: ActiveLaser, bossId: string): void {
    const staleIndex = this.activeLasers.indexOf(laser);
    if (staleIndex > -1) {
      this.activeLasers.splice(staleIndex, 1);
    }

    const staleBoss = this.bosses.get(bossId);
    staleBoss?.unfreeze();

    if (this.activeLasers.length === 0) {
      this.laserRenderer.clear();
    }
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

    if (tMin === Infinity) {
      tMin = Math.max(GAME_WIDTH, GAME_HEIGHT);
    }

    return {
      x: startX + dirX * tMin,
      y: startY + dirY * tMin,
    };
  }

  private checkLaserCollisions(_delta: number, gameTime: number, cursor: CursorSnapshot): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + this.upgradeSystem.getCursorSizeBonus());

    for (const laser of this.activeLasers) {
      if (!laser.isFiring) continue;

      const lineLenSq = Math.pow(laser.x2 - laser.x1, 2) + Math.pow(laser.y2 - laser.y1, 2);
      if (lineLenSq === 0) continue;

      let t =
        ((cursor.x - laser.x1) * (laser.x2 - laser.x1) +
          (cursor.y - laser.y1) * (laser.y2 - laser.y1)) /
        lineLenSq;
      t = Math.max(0, Math.min(1, t));

      const nearestX = laser.x1 + t * (laser.x2 - laser.x1);
      const nearestY = laser.y1 + t * (laser.y2 - laser.y1);
      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, nearestX, nearestY);

      if (dist < config.width / 2 + cursorRadius) {
        this.handleLaserHit(gameTime);
        break;
      }
    }
  }

  private handleLaserHit(gameTime: number): void {
    const config = Data.gameConfig.monsterAttack.laser;
    if (gameTime - this.lastLaserHitTime < config.bonus.invincibilityDuration) return;

    this.lastLaserHitTime = gameTime;
    this.healthSystem.takeDamage(1);
    this.feedbackSystem.onHpLost();
    this.soundSystem.playBossImpactSound();
    this.scene.cameras.main.shake(300, 0.01);
  }

  private updateBossOverlapDamage(
    cursor: CursorSnapshot,
    cursorRadius: number,
    gameTime: number
  ): void {
    const damageConfig = Data.dishes.damage;
    const baseDamage = Math.max(
      0,
      damageConfig.playerDamage + this.upgradeSystem.getCursorDamageBonus()
    );
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
      const distance = Phaser.Math.Distance.Between(cursor.x, cursor.y, boss.x, boss.y);
      if (distance > cursorRadius + bossRadius) return;

      overlapBossIds.add(bossId);

      const lastHitTime = this.bossOverlapLastHitTimeByBossId.get(bossId);
      if (lastHitTime !== undefined && gameTime - lastHitTime < tickInterval) return;
      if (baseDamage <= 0) return;

      let damage = baseDamage;
      const isCritical = Math.random() < criticalChance;
      if (isCritical) {
        damage *= criticalMultiplier;
      }

      this.monsterSystem.takeDamage(bossId, damage, cursor.x, cursor.y);
      this.feedbackSystem.onBossContactDamaged(boss.x, boss.y, damage, isCritical);
      this.bossOverlapLastHitTimeByBossId.set(bossId, gameTime);
    });

    const staleBossIds: string[] = [];
    this.bossOverlapLastHitTimeByBossId.forEach((_lastHitTime, bossId) => {
      if (!overlapBossIds.has(bossId)) {
        staleBossIds.push(bossId);
      }
    });
    staleBossIds.forEach((bossId) => this.bossOverlapLastHitTimeByBossId.delete(bossId));
  }
}
