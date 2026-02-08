import Phaser from 'phaser';
import { GAME_WIDTH, HEAL_PACK } from '../data/constants';
import { HealthPack } from '../entities/HealthPack';
import { ObjectPool } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';
import { UpgradeSystem } from './UpgradeSystem';

export class HealthPackSystem {
  private pool: ObjectPool<HealthPack>;
  private lastSpawnTime: number = -HEAL_PACK.COOLDOWN; // 게임 시작 시 바로 스폰 가능
  private timeSinceLastCheck: number = 0;
  private upgradeSystem: UpgradeSystem;

  constructor(scene: Phaser.Scene, upgradeSystem: UpgradeSystem) {
    this.upgradeSystem = upgradeSystem;
    this.pool = new ObjectPool<HealthPack>(
      () => new HealthPack(scene, 0, 0),
      2, // 초기 크기
      5 // 최대 크기
    );

    // 힐팩 수집 이벤트 구독
    EventBus.getInstance().on(GameEvents.HEALTH_PACK_COLLECTED, (...args: unknown[]) => {
      const data = args[0] as { pack: HealthPack };
      this.releaseHealthPack(data.pack);
    });

    // 힐팩 놓침 이벤트 구독
    EventBus.getInstance().on(GameEvents.HEALTH_PACK_MISSED, (...args: unknown[]) => {
      const data = args[0] as { pack: HealthPack };
      this.releaseHealthPack(data.pack);
    });
  }

  update(delta: number, gameTime: number): void {
    // 활성 힐팩 업데이트
    this.pool.forEach((pack) => {
      pack.update(delta);
    });

    this.checkSpawning(delta, gameTime);
  }

  /**
   * 커서 위치와 힐팩 간의 충돌을 체크하여 수집 처리 (키보드 조작 대응)
   */
  checkCollection(cursorX: number, cursorY: number, cursorRadius: number): void {
    this.pool.forEach((pack) => {
      if (!pack.active) return;

      const dist = Phaser.Math.Distance.Between(cursorX, cursorY, pack.x, pack.y);
      const hitDistance = cursorRadius + pack.getRadius();

      if (dist <= hitDistance) {
        pack.collect();
      }
    });
  }

  // 쿨다운 체크
  private checkSpawning(delta: number, gameTime: number): void {
    if (gameTime < this.lastSpawnTime + HEAL_PACK.COOLDOWN) {
      return;
    }

    // 동시 스폰 제한 체크
    if (this.pool.getActiveCount() >= HEAL_PACK.MAX_ACTIVE) {
      return;
    }

    // 설정된 주기(5초)마다 확률 체크
    this.timeSinceLastCheck += delta;
    if (this.timeSinceLastCheck < HEAL_PACK.CHECK_INTERVAL) {
      return;
    }
    this.timeSinceLastCheck = 0;

    // 고정 기본 확률 + 업그레이드 보너스 계산
    const spawnChance = this.getSpawnChance();
    if (spawnChance <= 0) {
      return;
    }

    // 확률 롤
    if (Math.random() < spawnChance) {
      this.spawnHealthPack(gameTime);
    }
  }

  getSpawnChance(): number {
    const upgradeBonus = this.upgradeSystem.getHealthPackDropBonus();
    return HEAL_PACK.BASE_SPAWN_CHANCE + upgradeBonus;
  }

  private spawnHealthPack(gameTime: number): void {
    const pack = this.pool.acquire();
    if (!pack) return;

    // 화면 좌우 마진을 두고 랜덤 X 위치
    const margin = 80;
    const x = Phaser.Math.Between(margin, GAME_WIDTH - margin);

    pack.spawn(x);
    this.lastSpawnTime = gameTime;
  }

  private releaseHealthPack(pack: HealthPack): void {
    this.pool.release(pack);
  }

  getActiveCount(): number {
    return this.pool.getActiveCount();
  }

  clear(): void {
    this.pool.clear();
  }
}
