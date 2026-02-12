import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/constants';
import { Data } from '../data/DataManager';
import type { BlackHoleLevelData } from '../data/types';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { EntityDamageService } from './EntityDamageService';
import type { FallingBombSystem } from './FallingBombSystem';
import type { UpgradeSystem } from './UpgradeSystem';
import type { BlackHoleRenderer } from '../effects/BlackHoleRenderer';
import { C_DishTag, C_DishProps, C_Transform, C_FallingBomb } from '../world';
import type { EntitySystem } from './entity-systems/EntitySystem';
import type { World } from '../world';

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

export class BlackHoleSystem implements EntitySystem {
  readonly id = 'core:black_hole';
  enabled = true;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly world: World;
  private readonly damageService: EntityDamageService;
  private readonly getBosses: () => BossSnapshot[];
  private readonly damageBoss: (
    bossId: string,
    amount: number,
    sourceX: number,
    sourceY: number,
    isCritical: boolean
  ) => void;
  private readonly renderer: BlackHoleRenderer;
  private fallingBombSystem?: FallingBombSystem;

  private blackHoles: ActiveBlackHole[] = [];
  private timeSinceLastSpawn = 0;
  private timeSinceLastDamageTick = 0;
  private lastAppliedLevel = 0;

  constructor(
    upgradeSystem: UpgradeSystem,
    world: World,
    damageService: EntityDamageService,
    getBosses: () => BossSnapshot[],
    damageBoss: (
      bossId: string,
      amount: number,
      sourceX: number,
      sourceY: number,
      isCritical: boolean
    ) => void,
    renderer: BlackHoleRenderer,
  ) {
    this.upgradeSystem = upgradeSystem;
    this.world = world;
    this.damageService = damageService;
    this.getBosses = getBosses;
    this.damageBoss = damageBoss;
    this.renderer = renderer;
  }

  setFallingBombSystem(system: FallingBombSystem): void {
    this.fallingBombSystem = system;
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

    for (const [entityId, , dp, t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      if (!this.world.isActive(entityId)) continue;
      const dangerous = dp.dangerous;

      let pullX = 0;
      let pullY = 0;
      let isPulled = false;
      let bombConsumed = false;

      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, t.x, t.y);
        if (distance > hole.radius) continue;
        if (dangerous && distance <= hole.radius * consumeRatio) {
          this.damageService.forceDestroy(entityId, true);
          if (!this.world.isActive(entityId)) {
            this.consumeTarget(hole, data);
          }
          bombConsumed = true;
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

      if (bombConsumed || !this.world.isActive(entityId)) continue;
      if (!isPulled) continue;

      const newX = Phaser.Math.Clamp(t.x + pullX, 0, GAME_WIDTH);
      const newY = Phaser.Math.Clamp(t.y + pullY, 0, GAME_HEIGHT);
      t.x = newX;
      t.y = newY;
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        node.container.x = newX;
        node.container.y = newY;
      }
      this.damageService.setBeingPulled(entityId, true);

      if (!dangerous) continue;

      for (const hole of this.blackHoles) {
        const movedDistance = Phaser.Math.Distance.Between(hole.x, hole.y, newX, newY);
        if (movedDistance > hole.radius) continue;
        if (movedDistance <= hole.radius * consumeRatio) {
          this.damageService.forceDestroy(entityId, true);
          if (!this.world.isActive(entityId)) {
            this.consumeTarget(hole, data);
          }
          break;
        }
      }
    }

    // 낙하 폭탄 (ECS World query)
    if (!this.fallingBombSystem) return;

    for (const [bombId, fb, bt] of this.world.query(C_FallingBomb, C_Transform)) {
      if (!fb.fullySpawned) continue;

      let bombPullX = 0;
      let bombPullY = 0;
      let bombPulled = false;
      let bombConsumedFlag = false;

      for (const hole of this.blackHoles) {
        const distance = Phaser.Math.Distance.Between(hole.x, hole.y, bt.x, bt.y);
        if (distance > hole.radius) continue;

        if (distance <= hole.radius * consumeRatio) {
          this.fallingBombSystem.forceDestroy(bombId, true);
          if (!this.world.isActive(bombId)) {
            this.consumeTarget(hole, data);
          }
          bombConsumedFlag = true;
          break;
        }

        if (distance <= 0.001) continue;

        const pullStrength = 1 - distance / hole.radius;
        const pullAmount = data.force * pullStrength * deltaSeconds;
        const angle = Phaser.Math.Angle.Between(bt.x, bt.y, hole.x, hole.y);

        bombPullX += Math.cos(angle) * pullAmount;
        bombPullY += Math.sin(angle) * pullAmount;
        bombPulled = true;
      }

      if (bombConsumedFlag || !this.world.isActive(bombId)) continue;
      if (!bombPulled) continue;

      bt.x = Phaser.Math.Clamp(bt.x + bombPullX, 0, GAME_WIDTH);
      bt.y = Phaser.Math.Clamp(bt.y + bombPullY, 0, GAME_HEIGHT);
      const bombNode = this.world.phaserNode.get(bombId);
      if (bombNode) {
        bombNode.container.x = bt.x;
        bombNode.container.y = bt.y;
      }

      // 이동 후 소비 체크
      for (const hole of this.blackHoles) {
        const movedDistance = Phaser.Math.Distance.Between(hole.x, hole.y, bt.x, bt.y);
        if (movedDistance > hole.radius) continue;
        if (movedDistance <= hole.radius * consumeRatio) {
          this.fallingBombSystem.forceDestroy(bombId, true);
          if (!this.world.isActive(bombId)) {
            this.consumeTarget(hole, data);
          }
          break;
        }
      }
    }
  }

  private applyDamageTick(data: BlackHoleLevelData, criticalChanceBonus: number): void {
    if (this.blackHoles.length === 0) return;

    for (const [entityId, , dp, t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      if (dp.dangerous) continue;

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
