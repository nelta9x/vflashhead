import Phaser from 'phaser';
import type { UpgradeSystem } from '../services/UpgradeSystem';
import type { EntityDamageService } from '../services/EntityDamageService';
import type { OrbRenderer } from '../abilities/OrbRenderer';
import type { SystemUpgradeData } from '../../../data/types';
import type { BossRadiusSnapshot } from '../services/ContentContracts';
import type { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import { C_DishTag, C_DishProps, C_Transform, C_BombProps } from '../../../world';
import { FallingBombSystem } from './FallingBombSystem';
import type { EntitySystem, SystemStartContext } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';

export interface OrbPosition {
  x: number;
  y: number;
  size: number;
}

interface OrbOverclockConfig {
  durationMs: number;
  speedMultiplier: number;
  maxStacks: number;
}

export class OrbSystem implements EntitySystem {
  readonly id = 'core:orb';
  enabled = true;

  private readonly upgradeSystem: UpgradeSystem;
  private readonly world: World;
  private readonly damageService: EntityDamageService;
  private readonly bcc: BossCombatCoordinator;
  private readonly renderer: OrbRenderer;
  private currentAngle: number = 0;

  // Cooldown tracking per entity: Map<entityId, NextHitTime>
  private lastHitTimes: Map<EntityId, number> = new Map();
  private bossLastHitTimes: Map<string, number> = new Map();

  private orbPositions: OrbPosition[] = [];
  private overclockStacks: number = 0;
  private overclockExpireAt: number = 0;
  private fallingBombSystem!: FallingBombSystem;

  constructor(
    upgradeSystem: UpgradeSystem,
    world: World,
    damageService: EntityDamageService,
    bcc: BossCombatCoordinator,
    renderer: OrbRenderer,
  ) {
    this.upgradeSystem = upgradeSystem;
    this.world = world;
    this.damageService = damageService;
    this.bcc = bcc;
    this.renderer = renderer;
  }

  start(ctx: SystemStartContext): void {
    this.fallingBombSystem = ctx.services.get(FallingBombSystem);
  }

  tick(delta: number): void {
    const ctx = this.world.context;
    const playerT = this.world.transform.get(ctx.playerId);
    if (!playerT) return;
    this.update(delta, ctx.gameTime, playerT.x, playerT.y,
      () => this.bcc.getAliveVisibleBossSnapshotsWithRadius(),
      this.onBossDamage);
    this.renderer.render(this.orbPositions);
  }

  private onBossDamage = (bossId: string, damage: number, x: number, y: number): void => {
    this.bcc.damageBoss(bossId, damage, x, y, false);
  };

  update(
    delta: number,
    gameTime: number,
    playerX: number,
    playerY: number,
    getBossSnapshots: () => BossRadiusSnapshot[] = () => [],
    onBossDamage: (bossId: string, damage: number, x: number, y: number) => void = () => {},
  ): void {
    const level = this.upgradeSystem.getOrbitingOrbLevel();
    if (level <= 0) {
      this.orbPositions = [];
      this.resetOverclock();
      return;
    }

    const upgradeData = this.upgradeSystem.getSystemUpgrade('orbiting_orb');
    const hitInterval = upgradeData?.hitInterval ?? 300;
    const overclockConfig = this.resolveOverclockConfig(upgradeData);
    this.updateOverclockState(gameTime, overclockConfig);

    const stats = this.upgradeSystem.getOrbitingOrbData();
    if (!stats) return;
    const criticalChanceBonus = this.upgradeSystem.getCriticalChanceBonus();

    // Magnet Synergy: Increase Size
    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    const magnetSynergyPerLevel = upgradeData?.magnetSynergyPerLevel ?? 0.2;
    const synergySizeMultiplier = 1 + magnetLevel * magnetSynergyPerLevel;
    const finalSize = stats.size * synergySizeMultiplier;

    // Update Angle
    // Speed is in degrees per second
    const speed = stats.speed * this.getOverclockSpeedMultiplier(overclockConfig);
    this.currentAngle += speed * (delta / 1000);
    this.currentAngle %= 360;

    // Calculate Positions
    this.orbPositions = [];
    const count = stats.count;
    const radius = stats.radius;
    const angleStep = 360 / count;

    for (let i = 0; i < count; i++) {
      const angleDeg = this.currentAngle + i * angleStep;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      const orbX = playerX + Math.cos(angleRad) * radius;
      const orbY = playerY + Math.sin(angleRad) * radius;

      this.orbPositions.push({
        x: orbX,
        y: orbY,
        size: finalSize,
      });
    }

    // Check Collisions
    this.checkCollisions(
      gameTime,
      stats.damage,
      finalSize,
      hitInterval,
      criticalChanceBonus,
      overclockConfig,
      getBossSnapshots,
      onBossDamage,
    );
  }

  private checkCollisions(
    gameTime: number,
    damage: number,
    orbSize: number,
    hitInterval: number,
    criticalChanceBonus: number,
    overclockConfig: OrbOverclockConfig,
    getBossSnapshots: () => BossRadiusSnapshot[],
    onBossDamage: (bossId: string, damage: number, x: number, y: number) => void,
  ): void {
    // 접시 충돌 (bomb 제외 — C_DishTag 쿼리)
    for (const [entityId, , dp, t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      const size = dp.size;

      let hit = false;
      for (const orb of this.orbPositions) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, t.x, t.y);
        if (dist <= (orbSize + size) * 1.5) {
          hit = true;
          break;
        }
      }

      if (hit) {
        const nextHitTime = this.lastHitTimes.get(entityId) || 0;
        if (gameTime >= nextHitTime) {
          this.damageService.applyUpgradeDamage(entityId, damage, 0, criticalChanceBonus);
          this.lastHitTimes.set(entityId, gameTime + hitInterval);
        }
      }
    }

    // 폭탄 통합 충돌 (웨이브 + 낙하)
    for (const [bombId, bp, bt] of this.world.query(C_BombProps, C_Transform)) {
      // 스폰 완료 체크: 낙하 폭탄은 fullySpawned, 웨이브 폭탄은 spawnDuration
      const fb = this.world.fallingBomb.get(bombId);
      if (fb && !fb.fullySpawned) continue;
      const lt = this.world.lifetime.get(bombId);
      if (lt && lt.elapsedTime < lt.spawnDuration) continue;

      const hitSize = bp.size;
      let hit = false;
      for (const orb of this.orbPositions) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, bt.x, bt.y);
        if (dist <= (orbSize + hitSize) * 1.5) {
          hit = true;
          break;
        }
      }

      if (hit) {
        if (fb) {
          this.fallingBombSystem.forceDestroy(bombId, true);
        } else {
          this.damageService.forceDestroy(bombId, true);
        }
        this.activateOverclock(gameTime, overclockConfig);
      }
    }

    // Boss collision check
    const bosses = getBossSnapshots();
    for (const boss of bosses) {
      for (const orb of this.orbPositions) {
        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, boss.x, boss.y);
        if (dist <= orbSize + boss.radius) {
          const nextHitTime = this.bossLastHitTimes.get(boss.id) ?? 0;
          if (gameTime >= nextHitTime) {
            onBossDamage(boss.id, damage, orb.x, orb.y);
            this.bossLastHitTimes.set(boss.id, gameTime + hitInterval);
          }
          break;
        }
      }
    }
  }

  private resolveOverclockConfig(upgradeData?: SystemUpgradeData): OrbOverclockConfig {
    const durationMs = Math.max(0, Math.floor(upgradeData?.overclockDurationMs ?? 0));
    const speedMultiplier = Math.max(1, upgradeData?.overclockSpeedMultiplier ?? 1);
    const rawMaxStacks = Math.floor(upgradeData?.overclockMaxStacks ?? 0);
    const maxStacks =
      durationMs > 0 && speedMultiplier > 1 ? Math.max(1, rawMaxStacks) : 0;

    return {
      durationMs,
      speedMultiplier,
      maxStacks,
    };
  }

  private updateOverclockState(gameTime: number, config: OrbOverclockConfig): void {
    if (config.maxStacks <= 0) {
      this.resetOverclock();
      return;
    }

    if (this.overclockStacks > 0 && gameTime >= this.overclockExpireAt) {
      this.resetOverclock();
    }
  }

  private getOverclockSpeedMultiplier(config: OrbOverclockConfig): number {
    if (this.overclockStacks <= 0) {
      return 1;
    }
    return 1 + (config.speedMultiplier - 1) * this.overclockStacks;
  }

  private activateOverclock(gameTime: number, config: OrbOverclockConfig): void {
    if (config.maxStacks <= 0 || config.durationMs <= 0 || config.speedMultiplier <= 1) {
      return;
    }

    this.overclockStacks = Math.min(config.maxStacks, this.overclockStacks + 1);
    this.overclockExpireAt = gameTime + config.durationMs;
  }

  private resetOverclock(): void {
    this.overclockStacks = 0;
    this.overclockExpireAt = 0;
  }

  public getOrbs(): OrbPosition[] {
    return this.orbPositions;
  }
}
