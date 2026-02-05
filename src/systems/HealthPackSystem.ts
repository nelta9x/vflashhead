import Phaser from 'phaser';
import { GAME_WIDTH, HEAL_PACK } from '../data/constants';
import { HealthPack } from '../entities/HealthPack';
import { ObjectPool } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';

export class HealthPackSystem {
  private pool: ObjectPool<HealthPack>;
  private lastSpawnTime: number = -HEAL_PACK.COOLDOWN; // 게임 시작 시 바로 스폰 가능
  private timeSinceLastCheck: number = 0;
  private currentHp: number = 5;

  constructor(scene: Phaser.Scene) {
    this.pool = new ObjectPool<HealthPack>(
      () => new HealthPack(scene, 0, 0),
      2, // 초기 크기
      5 // 최대 크기
    );

    // HP 변경 이벤트 구독
    EventBus.getInstance().on(GameEvents.HP_CHANGED, (...args: unknown[]) => {
      const data = args[0] as { hp: number; maxHp: number; delta: number };
      this.currentHp = data.hp;
    });

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

    // 쿨다운 체크
    if (gameTime < this.lastSpawnTime + HEAL_PACK.COOLDOWN) {
      return;
    }

    // 동시 스폰 제한 체크
    if (this.pool.getActiveCount() >= HEAL_PACK.MAX_ACTIVE) {
      return;
    }

    // 1초마다 확률 체크
    this.timeSinceLastCheck += delta;
    if (this.timeSinceLastCheck < 1000) {
      return;
    }
    this.timeSinceLastCheck = 0;

    // HP 기반 스폰 확률 계산
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
    return HEAL_PACK.SPAWN_CHANCE[this.currentHp] ?? 0;
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
