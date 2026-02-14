import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import type { BlackHoleLevelData } from '../../../data/types';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import type { EntityDamageService } from '../../../systems/EntityDamageService';
import { FallingBombSystem } from './FallingBombSystem';
import type { UpgradeSystem } from '../../../systems/UpgradeSystem';
import type { BlackHoleRenderer } from '../abilities/BlackHoleRenderer';
import type { BossCombatCoordinator } from '../services/BossCombatCoordinator';
import { C_DishTag, C_DishProps, C_Transform, C_BombProps } from '../../../world';
import type { EntitySystem, SystemStartContext } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';

export interface BlackHoleSnapshot {
  x: number;
  y: number;
  radius: number;
  spawnedAt: number;
}

interface ActiveBlackHole extends BlackHoleSnapshot {
  damage: number;
  remainingDuration: number;
}

interface PullTarget {
  id: number;
  transform: { x: number; y: number };
  consumable: boolean;
}

interface PullCallbacks {
  isActive: (id: number) => boolean;
  forceDestroy: (id: number) => void;
  onPulled?: (id: number) => void;
}

export class BlackHoleSystem implements EntitySystem {
  readonly id = 'core:black_hole';
  enabled = true;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly world: World;
  private readonly damageService: EntityDamageService;
  private readonly bcc: BossCombatCoordinator;
  private readonly renderer: BlackHoleRenderer;
  private fallingBombSystem!: FallingBombSystem;

  private blackHoles: ActiveBlackHole[] = [];
  private timeSinceLastSpawn = 0;
  private timeSinceLastDamageTick = 0;
  private lastAppliedLevel = 0;

  constructor(
    upgradeSystem: UpgradeSystem,
    world: World,
    damageService: EntityDamageService,
    bcc: BossCombatCoordinator,
    renderer: BlackHoleRenderer,
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
    this.update(delta, this.world.context.gameTime);
    this.renderer.render(this.getBlackHoles(), this.world.context.gameTime);
  }

  update(delta: number, gameTime: number): void {
    const level = this.upgradeSystem.getBlackHoleLevel();
    if (level <= 0) {
      this.clear();
      return;
    }

    const blackHoleData = this.upgradeSystem.getBlackHoleData();
    if (!blackHoleData) {
      this.clear();
      return;
    }
    const criticalChanceBonus = this.upgradeSystem.getCriticalChanceBonus();

    this.expireBlackHoles(delta);

    if (level !== this.lastAppliedLevel) {
      this.spawnBlackHoles(blackHoleData, gameTime);
      this.timeSinceLastSpawn = 0;
      this.timeSinceLastDamageTick = 0;
      this.lastAppliedLevel = level;
    }

    const spawnInterval = Math.max(1, blackHoleData.spawnInterval);
    this.timeSinceLastSpawn += delta;
    while (this.timeSinceLastSpawn >= spawnInterval) {
      this.timeSinceLastSpawn -= spawnInterval;
      this.spawnBlackHoles(blackHoleData, gameTime);
    }

    this.applyPull(delta, blackHoleData);

    const damageInterval = Math.max(1, blackHoleData.damageInterval);
    this.timeSinceLastDamageTick += delta;
    while (this.timeSinceLastDamageTick >= damageInterval) {
      this.timeSinceLastDamageTick -= damageInterval;
      this.applyDamageTick(blackHoleData, criticalChanceBonus);
    }
  }

  public clear(): void {
    this.blackHoles = [];
    this.timeSinceLastSpawn = 0;
    this.timeSinceLastDamageTick = 0;
    this.lastAppliedLevel = 0;
  }

  public getBlackHoles(): BlackHoleSnapshot[] {
    return this.blackHoles.map((hole) => ({
      x: hole.x,
      y: hole.y,
      radius: hole.radius,
      spawnedAt: hole.spawnedAt,
    }));
  }

  private expireBlackHoles(delta: number): void {
    for (const hole of this.blackHoles) {
      hole.remainingDuration -= delta;
    }
    this.blackHoles = this.blackHoles.filter((hole) => hole.remainingDuration > 0);
  }

  private spawnBlackHoles(data: BlackHoleLevelData, gameTime: number): void {
    const safeRadius = this.getSafeRadius(data.radius);
    const spawnCount = Math.max(1, Math.floor(data.spawnCount));
    const baseDamage = Math.max(0, data.damage);
    const duration = Math.max(0, data.duration);

    for (let i = 0; i < spawnCount; i++) {
      this.blackHoles.push(this.createHole(safeRadius, gameTime, baseDamage, duration));
    }
  }

  private getSafeRadius(radius: number): number {
    const maxRadius = Math.min(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    return Phaser.Math.Clamp(radius, 1, maxRadius);
  }

  private createHole(
    radius: number,
    spawnedAt: number,
    damage: number,
    duration: number
  ): ActiveBlackHole {
    const minX = radius;
    const maxX = GAME_WIDTH - radius;
    const minY = radius;
    const maxY = GAME_HEIGHT - radius;

    return {
      x: Phaser.Math.FloatBetween(minX, maxX),
      y: Phaser.Math.FloatBetween(minY, maxY),
      radius,
      spawnedAt,
      damage,
      remainingDuration: duration,
    };
  }

  private applyPull(delta: number, data: BlackHoleLevelData): void {
    if (this.blackHoles.length === 0) return;

    const deltaSeconds = delta / 1000;
    const consumeRatio = Phaser.Math.Clamp(data.bombConsumeRadiusRatio, 0, 1);

    // 접시 pull (consumable: false — 접시는 흡수 불가)
    const dishTargets: PullTarget[] = [];
    for (const [entityId, , , t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      if (!this.world.isActive(entityId)) continue;
      dishTargets.push({ id: entityId, transform: t, consumable: false });
    }
    this.applyPullToTargets(dishTargets, deltaSeconds, consumeRatio, data, {
      isActive: (id) => this.world.isActive(id),
      forceDestroy: (id) => this.damageService.forceDestroy(id, true),
      onPulled: (id) => this.damageService.setBeingPulled(id, true),
    });

    // 폭탄 통합 pull (웨이브 + 낙하, 항상 consumable)
    const bombTargets: PullTarget[] = [];
    for (const [bombId, , bt] of this.world.query(C_BombProps, C_Transform)) {
      const fb = this.world.fallingBomb.get(bombId);
      if (fb && !fb.fullySpawned) continue;
      bombTargets.push({ id: bombId, transform: bt, consumable: true });
    }
    // onPulled 생략: 폭탄은 pull 시각 효과(pullPhase) 불필요 — 흡인 즉시 소멸 대상
    this.applyPullToTargets(bombTargets, deltaSeconds, consumeRatio, data, {
      isActive: (id) => this.world.isActive(id),
      forceDestroy: (id) => {
        if (this.world.fallingBomb.has(id)) {
          this.fallingBombSystem.forceDestroy(id, true);
        } else {
          this.damageService.forceDestroy(id, true);
        }
      },
    });
  }

  private applyPullToTargets(
    targets: PullTarget[],
    deltaSeconds: number,
    consumeRatio: number,
    data: BlackHoleLevelData,
    callbacks: PullCallbacks
  ): void {
    for (const target of targets) {
      if (!callbacks.isActive(target.id)) continue;
      const t = target.transform;

      let pullX = 0;
      let pullY = 0;
      let isPulled = false;
      let consumed = false;

      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, t.x, t.y);
        if (distance > hole.radius) continue;
        if (target.consumable && distance <= hole.radius * consumeRatio) {
          callbacks.forceDestroy(target.id);
          if (!callbacks.isActive(target.id)) {
            this.consumeTarget(hole, data);
          }
          consumed = true;
          break;
        }
        if (distance <= 0.001) continue;

        const pullStrength = 1 - distance / hole.radius;
        const pullAmount = data.force * pullStrength * deltaSeconds;
        const angle = Phaser.Math.Angle.Between(t.x, t.y, hole.x, hole.y);
        pullX += Math.cos(angle) * pullAmount;
        pullY += Math.sin(angle) * pullAmount;
        isPulled = true;
      }

      if (consumed || !callbacks.isActive(target.id)) continue;
      if (!isPulled) continue;

      const newX = Phaser.Math.Clamp(t.x + pullX, 0, GAME_WIDTH);
      const newY = Phaser.Math.Clamp(t.y + pullY, 0, GAME_HEIGHT);
      t.x = newX;
      t.y = newY;
      const node = this.world.phaserNode.get(target.id);
      if (node) {
        node.container.x = newX;
        node.container.y = newY;
      }
      callbacks.onPulled?.(target.id);

      if (!target.consumable) continue;

      for (const hole of this.blackHoles) {
        const movedDistance = Phaser.Math.Distance.Between(hole.x, hole.y, newX, newY);
        if (movedDistance > hole.radius) continue;
        if (movedDistance <= hole.radius * consumeRatio) {
          callbacks.forceDestroy(target.id);
          if (!callbacks.isActive(target.id)) {
            this.consumeTarget(hole, data);
          }
          break;
        }
      }
    }
  }

  private applyDamageTick(data: BlackHoleLevelData, criticalChanceBonus: number): void {
    if (this.blackHoles.length === 0) return;

    for (const [entityId, , , t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, t.x, t.y);
        if (distance > hole.radius) continue;

        const wasActive = this.world.isActive(entityId);
        this.damageService.applyUpgradeDamage(entityId, hole.damage, 0, criticalChanceBonus);
        if (wasActive && !this.world.isActive(entityId)) {
          this.applyConsumeGrowth(hole, data);
        }
        break;
      }
    }

    const bosses = this.bcc.getAliveVisibleBossSnapshotsWithRadius();
    for (const boss of bosses) {
      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, boss.x, boss.y);
        if (distance > hole.radius + boss.radius) continue;

        const criticalResult = this.resolveCriticalDamage(hole.damage, criticalChanceBonus);
        this.bcc.damageBoss(boss.id, criticalResult.damage, hole.x, hole.y, criticalResult.isCritical);
        break;
      }
    }
  }

  private consumeTarget(hole: ActiveBlackHole, data: BlackHoleLevelData): void {
    this.applyConsumeGrowth(hole, data);
    EventBus.getInstance().emit(GameEvents.BLACK_HOLE_CONSUMED, { x: hole.x, y: hole.y });
  }

  private applyConsumeGrowth(hole: ActiveBlackHole, data: BlackHoleLevelData): void {
    const nextRadius =
      hole.radius * (1 + data.consumeRadiusGrowthRatio) + data.consumeRadiusGrowthFlat;
    hole.radius = this.getSafeRadius(nextRadius);
    hole.damage = Math.max(0, hole.damage + data.consumeDamageGrowth);
    hole.remainingDuration += data.consumeDurationGrowth;
  }

  private resolveCriticalDamage(
    baseDamage: number,
    criticalChanceBonus: number
  ): { damage: number; isCritical: boolean } {
    const damageConfig = Data.dishes.damage;
    const criticalChance = Phaser.Math.Clamp(
      (damageConfig.criticalChance ?? 0) + criticalChanceBonus,
      0,
      1
    );
    if (criticalChance <= 0) {
      return { damage: baseDamage, isCritical: false };
    }

    const isCritical = Math.random() < criticalChance;
    if (!isCritical) {
      return { damage: baseDamage, isCritical: false };
    }

    const criticalMultiplier = damageConfig.criticalMultiplier ?? 1;
    return { damage: baseDamage * criticalMultiplier, isCritical: true };
  }
}
