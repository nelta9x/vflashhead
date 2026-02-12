import Phaser from 'phaser';
import { Data } from '../../data/DataManager';
import { COLORS, CURSOR_HITBOX } from '../../data/constants';
import type { ParticleManager } from '../../effects/ParticleManager';
import type { PlayerAttackRenderer } from '../../effects/PlayerAttackRenderer';
import type { FeedbackSystem } from '../../systems/FeedbackSystem';
import type { MonsterSystem } from '../../systems/MonsterSystem';
import type { SoundSystem } from '../../systems/SoundSystem';
import type { UpgradeSystem } from '../../systems/UpgradeSystem';
import type { WaveSystem } from '../../systems/WaveSystem';
import type { EntityDamageService } from '../../systems/EntityDamageService';
import { C_DishTag, C_DishProps, C_Transform, C_Lifetime } from '../../world';
import type { World } from '../../world';
import type { EntityId } from '../../world/EntityId';
import type { BossInteractionGateway, CursorSnapshot } from './GameSceneContracts';

interface PlayerAttackControllerDeps {
  scene: Phaser.Scene;
  world: World;
  damageService: EntityDamageService;
  upgradeSystem: UpgradeSystem;
  waveSystem: WaveSystem;
  monsterSystem: MonsterSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  particleManager: ParticleManager;
  getCursor: () => CursorSnapshot;
  getPlayerAttackRenderer: () => PlayerAttackRenderer;
  bossGateway: BossInteractionGateway;
  isGameOver: () => boolean;
}

export class PlayerAttackController {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly damageService: EntityDamageService;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly waveSystem: WaveSystem;
  private readonly monsterSystem: MonsterSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly particleManager: ParticleManager;
  private readonly getCursor: () => CursorSnapshot;
  private readonly getPlayerAttackRenderer: () => PlayerAttackRenderer;
  private readonly bossGateway: BossInteractionGateway;
  private readonly isGameOver: () => boolean;

  constructor(deps: PlayerAttackControllerDeps) {
    this.scene = deps.scene;
    this.world = deps.world;
    this.damageService = deps.damageService;
    this.upgradeSystem = deps.upgradeSystem;
    this.waveSystem = deps.waveSystem;
    this.monsterSystem = deps.monsterSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.particleManager = deps.particleManager;
    this.getCursor = deps.getCursor;
    this.getPlayerAttackRenderer = deps.getPlayerAttackRenderer;
    this.bossGateway = deps.bossGateway;
    this.isGameOver = deps.isGameOver;
  }

  public performPlayerAttack(): void {
    if (this.isGameOver()) return;

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
        const cursor = this.getCursor();
        chargeVisual.update(p, cursor.x, cursor.y, this.getCursorRadius());
      },
      onComplete: () => {
        chargeVisual.destroy();
        if (this.isGameOver()) return;
        if (this.waveSystem.getCurrentWave() !== attackWave) return;

        const baseAttack = Data.gameConfig.playerAttack;
        const missileCount =
          this.upgradeSystem.getMissileLevel() > 0
            ? this.upgradeSystem.getMissileCount()
            : baseAttack.baseMissileCount;

        for (let i = 0; i < missileCount; i++) {
          this.scene.time.delayedCall(i * config.fire.missileInterval, () => {
            if (this.isGameOver()) return;
            if (this.waveSystem.getCurrentWave() !== attackWave) return;

            const cursor = this.getCursor();
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
    if (this.isGameOver()) return;
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
        if (this.isGameOver()) return;
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
        if (this.isGameOver()) return;
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
        if (isCritical) {
          totalDamage *= attackConfig.criticalMultiplier;
        }

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

    for (const [entityId, , dp, t, lt] of this.world.query(C_DishTag, C_DishProps, C_Transform, C_Lifetime)) {
      const dangerous = dp.dangerous;

      if (dangerous && lt.elapsedTime < lt.spawnDuration) continue;

      const collisionRadius = pathRadius + dp.size;
      if (!this.isPointInsideSegmentRadius(t.x, t.y, fromX, fromY, toX, toY, collisionRadius)) {
        continue;
      }

      hitCandidates.push(entityId);
    }

    for (const entityId of hitCandidates) {
      if (!this.world.isActive(entityId)) continue;
      const dp = this.world.dishProps.get(entityId);
      this.damageService.forceDestroy(entityId, dp?.dangerous ?? false);
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
