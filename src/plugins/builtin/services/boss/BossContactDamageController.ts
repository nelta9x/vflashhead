import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import type { Entity } from '../../../../entities/Entity';
import type { FeedbackSystem } from '../FeedbackSystem';
import type { HealthSystem } from '../../../../systems/HealthSystem';
import type { MonsterSystem } from '../MonsterSystem';
import type { UpgradeSystem } from '../UpgradeSystem';
import type { CursorSnapshot } from '../../../../scenes/game/GameSceneContracts';

interface BossContactDamageControllerDeps {
  bosses: Map<string, Entity>;
  monsterSystem: MonsterSystem;
  feedbackSystem: FeedbackSystem;
  upgradeSystem: UpgradeSystem;
  healthSystem: HealthSystem;
  bossOverlapLastHitTimeByBossId: Map<string, number>;
}

export class BossContactDamageController {
  private readonly bosses: Map<string, Entity>;
  private readonly monsterSystem: MonsterSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly healthSystem: HealthSystem;
  private readonly bossOverlapLastHitTimeByBossId: Map<string, number>;

  constructor(deps: BossContactDamageControllerDeps) {
    this.bosses = deps.bosses;
    this.monsterSystem = deps.monsterSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.upgradeSystem = deps.upgradeSystem;
    this.healthSystem = deps.healthSystem;
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

      // 변덕 저주: 치명타 배율 오버라이드 / 비치명타 패널티
      const volatilityCritMult = this.upgradeSystem.getVolatilityCritMultiplier();
      if (isCritical) {
        damage *= volatilityCritMult > 0 ? volatilityCritMult : criticalMultiplier;
      } else {
        const nonCritPenalty = this.upgradeSystem.getVolatilityNonCritPenalty();
        if (nonCritPenalty > 0) {
          damage *= nonCritPenalty;
        }
      }

      // 글로벌 데미지 승수 (글래스 캐논 + 광전사)
      damage *= this.upgradeSystem.getGlobalDamageMultiplier(
        this.healthSystem.getHp(),
        this.healthSystem.getMaxHp()
      );

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
