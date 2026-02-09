import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { Boss } from '../../../entities/Boss';
import type { FeedbackSystem } from '../../../systems/FeedbackSystem';
import type { MonsterSystem } from '../../../systems/MonsterSystem';
import type { UpgradeSystem } from '../../../systems/UpgradeSystem';
import type { CursorSnapshot } from '../GameSceneContracts';

interface BossContactDamageControllerDeps {
  bosses: Map<string, Boss>;
  monsterSystem: MonsterSystem;
  feedbackSystem: FeedbackSystem;
  upgradeSystem: UpgradeSystem;
  bossOverlapLastHitTimeByBossId: Map<string, number>;
}

export class BossContactDamageController {
  private readonly bosses: Map<string, Boss>;
  private readonly monsterSystem: MonsterSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly bossOverlapLastHitTimeByBossId: Map<string, number>;

  constructor(deps: BossContactDamageControllerDeps) {
    this.bosses = deps.bosses;
    this.monsterSystem = deps.monsterSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.upgradeSystem = deps.upgradeSystem;
    this.bossOverlapLastHitTimeByBossId = deps.bossOverlapLastHitTimeByBossId;
  }

  public updateBossOverlapDamage(
    cursor: CursorSnapshot,
    cursorRadius: number,
    gameTime: number
  ): void {
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
