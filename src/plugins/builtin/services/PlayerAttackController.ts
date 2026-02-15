import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { COLORS, CURSOR_HITBOX } from '../../../data/constants';
import type { ParticleManager } from '../../../effects/ParticleManager';
import type { PlayerAttackRenderer } from '../abilities/PlayerAttackRenderer';
import type { FeedbackSystem } from './FeedbackSystem';
import type { HealthSystem } from '../../../systems/HealthSystem';
import type { MonsterSystem } from './MonsterSystem';
import type { SoundSystem } from './SoundSystem';
import type { UpgradeSystem } from './UpgradeSystem';
import type { WaveSystem } from './WaveSystem';
import type { EntityDamageService } from './EntityDamageService';
import { C_DishTag, C_DishProps, C_Transform, C_BombProps } from '../../../world';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { BossInteractionGateway } from './ContentContracts';
import type { GameEnvironment } from '../../../scenes/game/GameEnvironment';

interface PlayerAttackControllerDeps {
  scene: Phaser.Scene;
  world: World;
  damageService: EntityDamageService;
  upgradeSystem: UpgradeSystem;
  healthSystem: HealthSystem;
  waveSystem: WaveSystem;
  monsterSystem: MonsterSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  particleManager: ParticleManager;
  gameEnv: GameEnvironment;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  bossGateway: BossInteractionGateway;
}

export class PlayerAttackController {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly damageService: EntityDamageService;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly healthSystem: HealthSystem;
  private readonly waveSystem: WaveSystem;
  private readonly monsterSystem: MonsterSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly particleManager: ParticleManager;
  private readonly gameEnv: GameEnvironment;
  private readonly getPlayerAttackRenderer: () => PlayerAttackRenderer;
  private readonly bossGateway: BossInteractionGateway;

  constructor(deps: PlayerAttackControllerDeps) {
    this.scene = deps.scene;
    this.world = deps.world;
    this.damageService = deps.damageService;
    this.upgradeSystem = deps.upgradeSystem;
    this.healthSystem = deps.healthSystem;
    this.waveSystem = deps.waveSystem;
    this.monsterSystem = deps.monsterSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.particleManager = deps.particleManager;
    this.gameEnv = deps.gameEnv;
    this.getPlayerAttackRenderer = deps.getPlayerAttackRenderer;
    this.bossGateway = deps.bossGateway;
  }

  public performPlayerAttack(): void {
    if (this.gameEnv.isGameOver) return;

    const config = Data.feedback.bossAttack;
    const attackWave = this.waveSystem.getCurrentWave();

    const mainColor = Phaser.Display.Color.HexStringToColor(config.mainColor).color;
    const accentColor = Phaser.Display.Color.HexStringToColor(config.accentColor).color;
    const preFireGlowColor = Phaser.Display.Color.HexStringToColor(config.fire.preFireGlow.color).color;

    const chargeDuration = config.charge.duration;
    this.soundSystem.playPlayerChargeSound();

    const chargeVisual = this.getPlayerAttackRenderer().createChargeVisual(
      mainColor,
      accentColor,
      config.charge
    );

    this.scene.tweens.add({
      targets: { progress: 0 },
      progress: 1,
      duration: chargeDuration,
      ease: 'Linear',
      onUpdate: (_tween, target) => {
        const p = target.progress;
        const cursor = this.gameEnv.getCursorPosition();
        chargeVisual.update(p, cursor.x, cursor.y, this.getCursorRadius());
      },
      onComplete: () => {
        chargeVisual.destroy();
        if (this.gameEnv.isGameOver) return;
        if (this.waveSystem.getCurrentWave() !== attackWave) return;

        const baseAttack = Data.gameConfig.playerAttack;
        const missileCount =
          this.upgradeSystem.getMissileLevel() > 0
            ? this.upgradeSystem.getMissileCount()
            : baseAttack.baseMissileCount;

        for (let i = 0; i < missileCount; i++) {
          this.scene.time.delayedCall(i * config.fire.missileInterval, () => {
            if (this.gameEnv.isGameOver) return;
            if (this.waveSystem.getCurrentWave() !== attackWave) return;

            const cursor = this.gameEnv.getCursorPosition();
            const nearestBoss = this.bossGateway.findNearestAliveBoss(cursor.x, cursor.y);
            if (!nearestBoss) return;

            this.getPlayerAttackRenderer().showPreFireCursorGlow(
              cursor.x,
              cursor.y,
              this.getCursorRadius(),
              preFireGlowColor,
              config.fire.preFireGlow
            );

            this.fireSequentialMissile(cursor.x, cursor.y, i, missileCount, nearestBoss.id);
          });
        }
      },
    });
  }

  public destroy(): void {}

  private fireSequentialMissile(
    startX: number,
    startY: number,
    index: number,
    total: number,
    initialTargetBossId: string
  ): void {
    if (this.gameEnv.isGameOver) return;
    const missileWave = this.waveSystem.getCurrentWave();

    const config = Data.feedback.bossAttack;
    const mainColor = Phaser.Display.Color.HexStringToColor(config.mainColor).color;
    const innerTrailColor = Phaser.Display.Color.HexStringToColor(config.innerTrailColor).color;

    const intensity = (index + 1) / total;
    const speed = config.fire.duration * (1 - intensity * 0.3);
    const missileThicknessMultiplier = Math.max(
      0.1,
      1 + this.upgradeSystem.getCursorMissileThicknessBonus()
    );

    const offsetRange = 30 * intensity;
    const curStartX = startX + Phaser.Math.Between(-offsetRange, offsetRange);
    const curStartY = startY + Phaser.Math.Between(-offsetRange, offsetRange);

    const tracking = config.fire.trackingOffset || { x: 20, y: 10 };
    let targetBossId = initialTargetBossId;
    let targetOffsetX = Phaser.Math.Between(-tracking.x, tracking.x);
    let targetOffsetY = Phaser.Math.Between(-tracking.y, tracking.y);

    let trackedBoss = this.bossGateway.getAliveBossTarget(targetBossId);
    if (!trackedBoss) {
      trackedBoss = this.bossGateway.findNearestAliveBoss(curStartX, curStartY);
      if (!trackedBoss) return;
      targetBossId = trackedBoss.id;
    }

    let fallbackTargetX = trackedBoss.x + targetOffsetX;
    let fallbackTargetY = trackedBoss.y + targetOffsetY;

    const missile = this.getPlayerAttackRenderer().createMissile(
      curStartX,
      curStartY,
      (8 + 4 * intensity) * missileThicknessMultiplier,
      mainColor,
      2000
    );

    this.soundSystem.playBossFireSound();
    this.particleManager.createSparkBurst(curStartX, curStartY, mainColor);

    let lastTrailX = curStartX;
    let lastTrailY = curStartY;

    this.scene.tweens.add({
      targets: { progress: 0 },
      progress: 1,
      duration: speed,
      ease: 'Expo.In',
      onUpdate: (_tween, target) => {
        if (this.gameEnv.isGameOver) return;
        if (this.waveSystem.getCurrentWave() !== missileWave) return;

        const p = target.progress;

        let activeTargetBoss = this.bossGateway.getAliveBossTarget(targetBossId);
        if (!activeTargetBoss) {
          const retargetedBoss = this.bossGateway.findNearestAliveBoss(missile.x, missile.y);
          if (retargetedBoss) {
            targetBossId = retargetedBoss.id;
            targetOffsetX = Phaser.Math.Between(-tracking.x, tracking.x);
            targetOffsetY = Phaser.Math.Between(-tracking.y, tracking.y);
            activeTargetBoss = retargetedBoss;
          }
        }

        const curTargetX = activeTargetBoss ? activeTargetBoss.x + targetOffsetX : fallbackTargetX;
        const curTargetY = activeTargetBoss ? activeTargetBoss.y + targetOffsetY : fallbackTargetY;
        fallbackTargetX = curTargetX;
        fallbackTargetY = curTargetY;

        missile.x = curStartX + (curTargetX - curStartX) * p;
        missile.y = curStartY + (curTargetY - curStartY) * p;

        const curX = missile.x;
        const curY = missile.y;

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
        if (this.gameEnv.isGameOver) return;
        if (this.waveSystem.getCurrentWave() !== missileWave) return;

        let finalTargetBoss = this.bossGateway.getAliveBossTarget(targetBossId);
        if (!finalTargetBoss) {
          finalTargetBoss = this.bossGateway.findNearestAliveBoss(missile.x, missile.y);
          if (!finalTargetBoss) {
            return;
          }
          targetBossId = finalTargetBoss.id;
          targetOffsetX = Phaser.Math.Between(-tracking.x, tracking.x);
          targetOffsetY = Phaser.Math.Between(-tracking.y, tracking.y);
        }

        const finalTargetX = finalTargetBoss.x + targetOffsetX;
        const finalTargetY = finalTargetBoss.y + targetOffsetY;

        const attackConfig = Data.gameConfig.playerAttack;
        let totalDamage =
          this.upgradeSystem.getMissileLevel() > 0
            ? this.upgradeSystem.getMissileDamage()
            : attackConfig.baseMissileDamage;

        const criticalChance = Math.min(
          1,
          attackConfig.criticalChance + this.upgradeSystem.getCriticalChanceBonus()
        );
        const isCritical = Math.random() < criticalChance;

        // 변덕 저주: 치명타 배율 오버라이드 / 비치명타 패널티
        const volatilityCritMult = this.upgradeSystem.getVolatilityCritMultiplier();
        if (isCritical) {
          totalDamage *= volatilityCritMult > 0 ? volatilityCritMult : attackConfig.criticalMultiplier;
        } else {
          const nonCritPenalty = this.upgradeSystem.getVolatilityNonCritPenalty();
          if (nonCritPenalty > 0) {
            totalDamage *= nonCritPenalty;
          }
        }

        // 글로벌 데미지 승수 (글래스 캐논 + 광전사)
        totalDamage *= this.upgradeSystem.getGlobalDamageMultiplier(
          this.healthSystem.getHp(),
          this.healthSystem.getMaxHp()
        );

        this.monsterSystem.takeDamage(targetBossId, totalDamage, curStartX, curStartY);

        if (isCritical) {
          this.bossGateway.cancelChargingLasers(targetBossId);
        }

        this.feedbackSystem.onBossDamaged(finalTargetX, finalTargetY, totalDamage, isCritical);
        if (index === total - 1) {
          this.scene.cameras.main.shake(
            config.impact.shakeDuration,
            config.impact.shakeIntensity * (isCritical ? 2 : 1.5)
          );
        } else {
          this.particleManager.createHitEffect(
            finalTargetX,
            finalTargetY,
            isCritical ? COLORS.YELLOW : COLORS.WHITE
          );
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
    const hitCandidates: EntityId[] = [];

    // 접시 충돌
    for (const [entityId, , dp, t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      const collisionRadius = pathRadius + dp.size;
      if (!this.isPointInsideSegmentRadius(t.x, t.y, fromX, fromY, toX, toY, collisionRadius)) {
        continue;
      }
      hitCandidates.push(entityId);
    }

    // 폭탄 충돌 (웨이브 폭탄 — C_BombProps 쿼리)
    for (const [bombId, bp, bt] of this.world.query(C_BombProps, C_Transform)) {
      // 낙하 폭탄은 별도 시스템 관리
      if (this.world.fallingBomb.has(bombId)) continue;
      const lt = this.world.lifetime.get(bombId);
      if (lt && lt.elapsedTime < lt.spawnDuration) continue;

      const collisionRadius = pathRadius + bp.size;
      if (!this.isPointInsideSegmentRadius(bt.x, bt.y, fromX, fromY, toX, toY, collisionRadius)) {
        continue;
      }
      hitCandidates.push(bombId);
    }

    for (const entityId of hitCandidates) {
      if (!this.world.isActive(entityId)) continue;
      this.damageService.forceDestroy(entityId, true);
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

  private getCursorRadius(): number {
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    return CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
  }
}
