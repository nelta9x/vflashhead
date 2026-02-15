import Phaser from 'phaser';
import type { EntityDamageService } from '../services/EntityDamageService';
import type { OrbRenderer } from '../abilities/OrbRenderer';
import type { OrbitingOrbLevelData } from '../../../data/types';
import type { BossRadiusSnapshot } from '../services/ContentContracts';
import type { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import { C_DishTag, C_DishProps, C_Transform, C_BombProps } from '../../../world';
import { FallingBombSystem } from './FallingBombSystem';
import type { EntitySystem, SystemStartContext } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { EntityId } from '../../../world/EntityId';
import type { AbilityProgressionService } from '../services/abilities/AbilityProgressionService';
import type { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import {
  ABILITY_IDS,
  CRITICAL_CHANCE_EFFECT_KEYS,
  ORBITING_ORB_EFFECT_KEYS,
} from '../services/upgrades/AbilityEffectCatalog';

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

  private readonly abilityProgression: AbilityProgressionService;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
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
    abilityProgression: AbilityProgressionService,
    abilityRuntimeQuery: AbilityRuntimeQueryService,
    world: World,
    damageService: EntityDamageService,
    bcc: BossCombatCoordinator,
    renderer: OrbRenderer,
  ) {
    this.abilityProgression = abilityProgression;
    this.abilityRuntimeQuery = abilityRuntimeQuery;
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
    const level = this.abilityProgression.getAbilityLevel(ABILITY_IDS.ORBITING_ORB);
    if (level <= 0) {
      this.orbPositions = [];
      this.resetOverclock();
      return;
    }

    const hitInterval = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ORBITING_ORB,
      ORBITING_ORB_EFFECT_KEYS.HIT_INTERVAL,
    );
    const overclockConfig = this.resolveOverclockConfig();
    this.updateOverclockState(gameTime, overclockConfig);

    const stats = this.resolveOrbStats();
    const criticalChanceBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CRITICAL_CHANCE,
      CRITICAL_CHANCE_EFFECT_KEYS.CRITICAL_CHANCE,
    );

    // Magnet Synergy: Increase Size
    const magnetLevel = this.abilityProgression.getAbilityLevel(ABILITY_IDS.MAGNET);
    const magnetSynergyPerLevel = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ORBITING_ORB,
      ORBITING_ORB_EFFECT_KEYS.MAGNET_SYNERGY_PER_LEVEL,
    );
    const synergySizeMultiplier = 1 + magnetLevel * magnetSynergyPerLevel;
    const finalSize = stats.size * synergySizeMultiplier;

    // Update Angle
    // Speed is in degrees per second
    const speed = stats.speed * this.getOverclockSpeedMultiplier(overclockConfig);
    this.currentAngle += speed * (delta / 1000);
    this.currentAngle %= 360;

    // Calculate Positions
    this.orbPositions = [];
    const count = Math.max(1, Math.floor(stats.count));
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

  private resolveOrbStats(): OrbitingOrbLevelData {
    return {
      count: this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.ORBITING_ORB,
        ORBITING_ORB_EFFECT_KEYS.COUNT,
      ),
      damage: this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.ORBITING_ORB,
        ORBITING_ORB_EFFECT_KEYS.DAMAGE,
      ),
      speed: this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.ORBITING_ORB,
        ORBITING_ORB_EFFECT_KEYS.SPEED,
      ),
      radius: this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.ORBITING_ORB,
        ORBITING_ORB_EFFECT_KEYS.RADIUS,
      ),
      size: this.abilityRuntimeQuery.getEffectValueOrThrow(
        ABILITY_IDS.ORBITING_ORB,
        ORBITING_ORB_EFFECT_KEYS.SIZE,
      ),
    };
  }

  private resolveOverclockConfig(): OrbOverclockConfig {
    const durationMs = Math.max(0, Math.floor(this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ORBITING_ORB,
      ORBITING_ORB_EFFECT_KEYS.OVERCLOCK_DURATION_MS,
    )));
    const speedMultiplier = Math.max(1, this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ORBITING_ORB,
      ORBITING_ORB_EFFECT_KEYS.OVERCLOCK_SPEED_MULTIPLIER,
    ));
    const rawMaxStacks = Math.floor(this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.ORBITING_ORB,
      ORBITING_ORB_EFFECT_KEYS.OVERCLOCK_MAX_STACKS,
    ));
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

  destroy(): void {
    this.lastHitTimes.clear();
    this.bossLastHitTimes.clear();
    this.orbPositions = [];
    this.resetOverclock();
  }

  public getOrbs(): OrbPosition[] {
    return this.orbPositions;
  }
}
