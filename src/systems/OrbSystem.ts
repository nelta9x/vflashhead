import Phaser from 'phaser';
import type { UpgradeSystem } from './UpgradeSystem';
import type { EntityDamageService } from './EntityDamageService';
import type { FallingBombSystem } from './FallingBombSystem';
import type { OrbRenderer } from '../effects/OrbRenderer';
import type { SystemUpgradeData } from '../data/types';
import type { BossRadiusSnapshot } from '../scenes/game/GameSceneContracts';
import { C_DishTag, C_DishProps, C_Transform, C_Lifetime, C_FallingBomb } from '../world';
import { Data } from '../data/DataManager';
import type { EntitySystem } from './entity-systems/EntitySystem';
import type { World } from '../world';
import type { EntityId } from '../world/EntityId';

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
  private readonly getBossSnapshots: () => BossRadiusSnapshot[];
  private readonly damageBoss: (
    bossId: string,
    amount: number,
    sourceX: number,
    sourceY: number,
    isCritical: boolean
  ) => void;
  private readonly renderer: OrbRenderer;
  private currentAngle: number = 0;

  // Cooldown tracking per entity: Map<entityId, NextHitTime>
  private lastHitTimes: Map<EntityId, number> = new Map();
  private bossLastHitTimes: Map<string, number> = new Map();

  private orbPositions: OrbPosition[] = [];
  private overclockStacks: number = 0;
  private overclockExpireAt: number = 0;
  private fallingBombSystem?: FallingBombSystem;

  constructor(
    upgradeSystem: UpgradeSystem,
    world: World,
    damageService: EntityDamageService,
    getBossSnapshots: () => BossRadiusSnapshot[],
    damageBoss: (
      bossId: string,
      amount: number,
      sourceX: number,
      sourceY: number,
      isCritical: boolean
    ) => void,
    renderer: OrbRenderer,
  ) {
    this.upgradeSystem = upgradeSystem;
    this.world = world;
    this.damageService = damageService;
    this.getBossSnapshots = getBossSnapshots;
    this.damageBoss = damageBoss;
    this.renderer = renderer;
  }

  setFallingBombSystem(system: FallingBombSystem): void {
    this.fallingBombSystem = system;
  }

  tick(delta: number): void {
    const ctx = this.world.context;
    const playerT = this.world.transform.get(ctx.playerId);
    if (!playerT) return;
    this.update(delta, ctx.gameTime, playerT.x, playerT.y,
      this.getBossSnapshots, this.onBossDamage);
    this.renderer.render(this.orbPositions);
  }

  private onBossDamage = (bossId: string, damage: number, x: number, y: number): void => {
    this.damageBoss(bossId, damage, x, y, false);
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
    for (const [entityId, , dp, t, lt] of this.world.query(C_DishTag, C_DishProps, C_Transform, C_Lifetime)) {
      const dangerous = dp.dangerous;
      const size = dp.size;

      // 폭탄(dangerous)은 완전히 스폰된 후에만 타격 가능
      if (dangerous && lt.elapsedTime < lt.spawnDuration) continue;

      // Collision Check (Circle vs Circle)
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
          if (dangerous) {
            this.damageService.forceDestroy(entityId, true);
            this.activateOverclock(gameTime, overclockConfig);
          } else {
            this.damageService.applyUpgradeDamage(entityId, damage, 0, criticalChanceBonus);
          }
          this.lastHitTimes.set(entityId, gameTime + hitInterval);
        }
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

    // Falling bomb collision check (ECS World query)
    if (this.fallingBombSystem) {
      for (const [bombId, fb, bt] of this.world.query(C_FallingBomb, C_Transform)) {
        if (!fb.fullySpawned) continue;

        for (const orb of this.orbPositions) {
          const dist = Phaser.Math.Distance.Between(orb.x, orb.y, bt.x, bt.y);
          if (dist <= (orbSize + Data.fallingBomb.hitboxSize) * 1.5) {
            this.fallingBombSystem.forceDestroy(bombId, true);
            this.activateOverclock(gameTime, overclockConfig);
            break;
          }
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
