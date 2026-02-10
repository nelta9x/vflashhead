import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { COLORS, CURSOR_HITBOX, GAME_HEIGHT, GAME_WIDTH } from '../../../data/constants';
import { Boss } from '../../../entities/Boss';
import type { LaserRenderer } from '../../../effects/LaserRenderer';
import type { DamageText } from '../../../ui/DamageText';
import type { FeedbackSystem } from '../../../systems/FeedbackSystem';
import type { HealthSystem } from '../../../systems/HealthSystem';
import type { MonsterSystem } from '../../../systems/MonsterSystem';
import type { SoundSystem } from '../../../systems/SoundSystem';
import type { UpgradeSystem } from '../../../systems/UpgradeSystem';
import type { WaveSystem } from '../../../systems/WaveSystem';
import type { CursorSnapshot } from '../GameSceneContracts';
import type { ActiveLaser } from './BossCombatTypes';

interface BossLaserControllerDeps {
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
  bosses: Map<string, Boss>;
  laserNextTimeByBossId: Map<string, number>;
  getActiveLasers: () => ActiveLaser[];
  setActiveLasers: (lasers: ActiveLaser[]) => void;
  getLastLaserHitTime: () => number;
  setLastLaserHitTime: (time: number) => void;
}

export class BossLaserController {
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
  private readonly bosses: Map<string, Boss>;
  private readonly laserNextTimeByBossId: Map<string, number>;
  private readonly getActiveLasers: () => ActiveLaser[];
  private readonly setActiveLasers: (lasers: ActiveLaser[]) => void;
  private readonly getLastLaserHitTime: () => number;
  private readonly setLastLaserHitTime: (time: number) => void;

  constructor(deps: BossLaserControllerDeps) {
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
    this.bosses = deps.bosses;
    this.laserNextTimeByBossId = deps.laserNextTimeByBossId;
    this.getActiveLasers = deps.getActiveLasers;
    this.setActiveLasers = deps.setActiveLasers;
    this.getLastLaserHitTime = deps.getLastLaserHitTime;
    this.setLastLaserHitTime = deps.setLastLaserHitTime;
  }

  public setNextLaserTime(bossId: string, gameTime: number): void {
    const laserConfig = this.getBossLaserConfig(bossId);
    if (!laserConfig || laserConfig.maxCount === 0) {
      this.laserNextTimeByBossId.set(bossId, gameTime + Data.gameConfig.monsterAttack.laser.fallbackCooldown);
      return;
    }

    const interval = Phaser.Math.Between(laserConfig.minInterval, laserConfig.maxInterval);
    this.laserNextTimeByBossId.set(bossId, gameTime + interval);
  }

  public cancelChargingLasers(bossId: string, lastCursor: CursorSnapshot): void {
    const activeLasers = this.getActiveLasers();
    let cancelledCount = 0;

    for (let i = activeLasers.length - 1; i >= 0; i--) {
      const laser = activeLasers[i];
      if (laser.bossId === bossId && laser.isWarning) {
        activeLasers.splice(i, 1);
        cancelledCount++;
      }
    }

    if (cancelledCount === 0) {
      return;
    }

    const boss = this.bosses.get(bossId);
    boss?.unfreeze();

    const textX = boss?.x ?? lastCursor.x;
    const textY = boss ? boss.y - 60 : lastCursor.y - 60;
    this.damageText.showText(textX, textY, Data.t('feedback.interrupted'), COLORS.CYAN);

    if (activeLasers.length === 0) {
      this.laserRenderer.clear();
    }
  }

  public isAnyLaserFiring(): boolean {
    return this.getActiveLasers().some((laser) => laser.isFiring);
  }

  public updateLaser(_delta: number, gameTime: number, cursor: CursorSnapshot): void {
    let activeLasers = this.getActiveLasers();
    activeLasers = activeLasers.filter((laser) => this.getAliveVisibleBossById(laser.bossId) !== null);
    this.setActiveLasers(activeLasers);

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
        const activeLaserCountForBoss = activeLasers.filter((laser) => laser.bossId === bossId).length;
        if (activeLaserCountForBoss < laserConfig.maxCount) {
          this.triggerBossLaserAttack(bossId, gameTime, cursor);
        }
      }

      this.setNextLaserTime(bossId, gameTime);
    }

    activeLasers = this.getActiveLasers();
    const laserData = activeLasers.map((laser) => ({
      ...laser,
      progress: (gameTime - laser.startTime) / Data.gameConfig.monsterAttack.laser.warningDuration,
    }));
    this.laserRenderer.render(laserData);
  }

  public checkLaserCollisions(_delta: number, gameTime: number, cursor: CursorSnapshot): void {
    const config = Data.gameConfig.monsterAttack.laser;
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + this.upgradeSystem.getCursorSizeBonus());

    for (const laser of this.getActiveLasers()) {
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

  private triggerBossLaserAttack(bossId: string, gameTime: number, cursor: CursorSnapshot): void {
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
    this.getActiveLasers().push(laser);

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
        if (this.isGameOver()) return;

        const activeLasers = this.getActiveLasers();
        const index = activeLasers.indexOf(laser);
        if (index > -1) {
          activeLasers.splice(index, 1);
          if (activeLasers.length === 0) {
            this.laserRenderer.clear();
          }
        }

        const ownerBoss = this.bosses.get(bossId);
        ownerBoss?.unfreeze();
      });
    });
  }

  private removeLaserAndUnfreeze(laser: ActiveLaser, bossId: string): void {
    const activeLasers = this.getActiveLasers();
    const staleIndex = activeLasers.indexOf(laser);
    if (staleIndex > -1) {
      activeLasers.splice(staleIndex, 1);
    }

    const staleBoss = this.bosses.get(bossId);
    staleBoss?.unfreeze();

    if (activeLasers.length === 0) {
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

  private handleLaserHit(gameTime: number): void {
    const config = Data.gameConfig.monsterAttack.laser;
    if (gameTime - this.getLastLaserHitTime() < config.bonus.invincibilityDuration) return;

    this.setLastLaserHitTime(gameTime);
    this.healthSystem.takeDamage(1);
    this.feedbackSystem.onHpLost();
    this.soundSystem.playBossImpactSound();
    this.scene.cameras.main.shake(300, 0.01);
  }
}
