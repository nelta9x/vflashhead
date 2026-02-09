import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { GAME_WIDTH } from '../../../data/constants';
import type { WaveBossConfig } from '../../../data/types/waves';
import { Boss } from '../../../entities/Boss';
import type { LaserRenderer } from '../../../effects/LaserRenderer';
import type { FeedbackSystem } from '../../../systems/FeedbackSystem';
import type { MonsterSystem } from '../../../systems/MonsterSystem';
import type { WaveSystem } from '../../../systems/WaveSystem';
import type { ActiveLaser } from './BossCombatTypes';

interface BossRosterSyncDeps {
  scene: Phaser.Scene;
  waveSystem: WaveSystem;
  monsterSystem: MonsterSystem;
  feedbackSystem: FeedbackSystem;
  laserRenderer: LaserRenderer;
  bosses: Map<string, Boss>;
  laserNextTimeByBossId: Map<string, number>;
  bossOverlapLastHitTimeByBossId: Map<string, number>;
  getActiveLasers: () => ActiveLaser[];
  setActiveLasers: (lasers: ActiveLaser[]) => void;
  setNextLaserTime: (bossId: string, gameTime: number) => void;
  getCurrentGameTime: () => number;
}

export class BossRosterSync {
  private readonly scene: Phaser.Scene;
  private readonly waveSystem: WaveSystem;
  private readonly monsterSystem: MonsterSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly laserRenderer: LaserRenderer;
  private readonly bosses: Map<string, Boss>;
  private readonly laserNextTimeByBossId: Map<string, number>;
  private readonly bossOverlapLastHitTimeByBossId: Map<string, number>;
  private readonly getActiveLasers: () => ActiveLaser[];
  private readonly setActiveLasers: (lasers: ActiveLaser[]) => void;
  private readonly setNextLaserTime: (bossId: string, gameTime: number) => void;
  private readonly getCurrentGameTime: () => number;

  constructor(deps: BossRosterSyncDeps) {
    this.scene = deps.scene;
    this.waveSystem = deps.waveSystem;
    this.monsterSystem = deps.monsterSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.laserRenderer = deps.laserRenderer;
    this.bosses = deps.bosses;
    this.laserNextTimeByBossId = deps.laserNextTimeByBossId;
    this.bossOverlapLastHitTimeByBossId = deps.bossOverlapLastHitTimeByBossId;
    this.getActiveLasers = deps.getActiveLasers;
    this.setActiveLasers = deps.setActiveLasers;
    this.setNextLaserTime = deps.setNextLaserTime;
    this.getCurrentGameTime = deps.getCurrentGameTime;
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

    this.setActiveLasers(this.getActiveLasers().filter((laser) => activeBossIds.has(laser.bossId)));
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
      this.setNextLaserTime(bossConfig.id, this.getCurrentGameTime());
    }

    if (this.getActiveLasers().length === 0) {
      this.laserRenderer.clear();
    }
  }

  public clearForWaveTransition(): void {
    this.setActiveLasers([]);
    this.laserNextTimeByBossId.clear();
    this.bosses.forEach((boss) => boss.unfreeze());
    this.laserRenderer.clear();
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
}
