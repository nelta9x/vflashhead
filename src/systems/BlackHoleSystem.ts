import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/constants';
import { Data } from '../data/DataManager';
import type { BlackHoleLevelData } from '../data/types';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { Dish } from '../entities/Dish';
import type { FallingBomb } from '../entities/FallingBomb';
import type { ObjectPool } from '../utils/ObjectPool';
import type { UpgradeSystem } from './UpgradeSystem';

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

interface BossSnapshot {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export class BlackHoleSystem {
  private readonly upgradeSystem: UpgradeSystem;
  private readonly getDishPool: () => ObjectPool<Dish>;
  private readonly getBosses: () => BossSnapshot[];
  private readonly damageBoss: (
    bossId: string,
    amount: number,
    sourceX: number,
    sourceY: number,
    isCritical: boolean
  ) => void;
  private readonly getFallingBombPool?: () => ObjectPool<FallingBomb>;

  private blackHoles: ActiveBlackHole[] = [];
  private timeSinceLastSpawn = 0;
  private timeSinceLastDamageTick = 0;
  private lastAppliedLevel = 0;

  constructor(
    upgradeSystem: UpgradeSystem,
    getDishPool: () => ObjectPool<Dish>,
    getBosses: () => BossSnapshot[],
    damageBoss: (
      bossId: string,
      amount: number,
      sourceX: number,
      sourceY: number,
      isCritical: boolean
    ) => void,
    getFallingBombPool?: () => ObjectPool<FallingBomb>
  ) {
    this.upgradeSystem = upgradeSystem;
    this.getDishPool = getDishPool;
    this.getBosses = getBosses;
    this.damageBoss = damageBoss;
    this.getFallingBombPool = getFallingBombPool;
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
    const dishes = this.getDishPool().getActiveObjects();

    for (const dish of dishes) {
      if (!dish.active) continue;
      const dangerous = dish.isDangerous();

      let pullX = 0;
      let pullY = 0;
      let isPulled = false;
      let bombConsumed = false;

      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, dish.x, dish.y);
        if (distance > hole.radius) continue;
        if (dangerous && distance <= hole.radius * consumeRatio) {
          dish.forceDestroy(true);
          if (!dish.active) {
            this.applyConsumeGrowth(hole, data);
          }
          bombConsumed = true;
          break;
        }
        if (distance <= 0.001) continue;

        const pullStrength = 1 - distance / hole.radius;
        const pullAmount = data.force * pullStrength * deltaSeconds;
        const angle = Phaser.Math.Angle.Between(dish.x, dish.y, hole.x, hole.y);

        pullX += Math.cos(angle) * pullAmount;
        pullY += Math.sin(angle) * pullAmount;
        isPulled = true;
      }

      if (bombConsumed || !dish.active) continue;
      if (!isPulled) continue;

      dish.x = Phaser.Math.Clamp(dish.x + pullX, 0, GAME_WIDTH);
      dish.y = Phaser.Math.Clamp(dish.y + pullY, 0, GAME_HEIGHT);
      dish.setBeingPulled(true);

      if (!dangerous) continue;

      for (const hole of this.blackHoles) {
        const movedDistance = Phaser.Math.Distance.Between(hole.x, hole.y, dish.x, dish.y);
        if (movedDistance > hole.radius) continue;
        if (movedDistance <= hole.radius * consumeRatio) {
          dish.forceDestroy(true);
          if (!dish.active) {
            this.applyConsumeGrowth(hole, data);
          }
          break;
        }
      }
    }

    // 낙하 폭탄 풀/소비
    if (!this.getFallingBombPool) return;
    const bombs = this.getFallingBombPool().getActiveObjects();

    for (const bomb of bombs) {
      if (!bomb.active || !bomb.isFullySpawned()) continue;

      let bombPullX = 0;
      let bombPullY = 0;
      let bombPulled = false;
      let bombConsumed = false;

      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, bomb.x, bomb.y);
        if (distance > hole.radius) continue;

        if (distance <= hole.radius * consumeRatio) {
          bomb.forceDestroy(true);
          if (!bomb.active) {
            this.applyConsumeGrowth(hole, data);
          }
          bombConsumed = true;
          break;
        }

        if (distance <= 0.001) continue;

        const pullStrength = 1 - distance / hole.radius;
        const pullAmount = data.force * pullStrength * deltaSeconds;
        const angle = Phaser.Math.Angle.Between(bomb.x, bomb.y, hole.x, hole.y);

        bombPullX += Math.cos(angle) * pullAmount;
        bombPullY += Math.sin(angle) * pullAmount;
        bombPulled = true;
      }

      if (bombConsumed || !bomb.active) continue;
      if (!bombPulled) continue;

      bomb.x = Phaser.Math.Clamp(bomb.x + bombPullX, 0, GAME_WIDTH);
      bomb.y = Phaser.Math.Clamp(bomb.y + bombPullY, 0, GAME_HEIGHT);

      // 이동 후 소비 체크
      for (const hole of this.blackHoles) {
        const movedDistance = Phaser.Math.Distance.Between(hole.x, hole.y, bomb.x, bomb.y);
        if (movedDistance > hole.radius) continue;
        if (movedDistance <= hole.radius * consumeRatio) {
          bomb.forceDestroy(true);
          if (!bomb.active) {
            this.applyConsumeGrowth(hole, data);
          }
          break;
        }
      }
    }
  }

  private applyDamageTick(data: BlackHoleLevelData, criticalChanceBonus: number): void {
    if (this.blackHoles.length === 0) return;

    const dishes = this.getDishPool().getActiveObjects();
    for (const dish of dishes) {
      if (!dish.active || dish.isDangerous()) continue;

      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, dish.x, dish.y);
        if (distance > hole.radius) continue;

        const wasActive = dish.active;
        dish.applyDamageWithUpgrades(hole.damage, 0, criticalChanceBonus);
        if (wasActive && !dish.active) {
          this.applyConsumeGrowth(hole, data);
        }
        break;
      }
    }

    const bosses = this.getBosses();
    for (const boss of bosses) {
      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, boss.x, boss.y);
        if (distance > hole.radius + boss.radius) continue;

        const criticalResult = this.resolveCriticalDamage(hole.damage, criticalChanceBonus);
        this.damageBoss(boss.id, criticalResult.damage, hole.x, hole.y, criticalResult.isCritical);
        break;
      }
    }
  }

  private applyConsumeGrowth(hole: ActiveBlackHole, data: BlackHoleLevelData): void {
    const nextRadius =
      hole.radius * (1 + data.consumeRadiusGrowthRatio) + data.consumeRadiusGrowthFlat;
    hole.radius = this.getSafeRadius(nextRadius);
    hole.damage = Math.max(0, hole.damage + data.consumeDamageGrowth);
    hole.remainingDuration += data.consumeDurationGrowth;

    EventBus.getInstance().emit(GameEvents.BLACK_HOLE_CONSUMED, { x: hole.x, y: hole.y });
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
