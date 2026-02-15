import Phaser from 'phaser';
import type { Entity } from '../../../../entities/Entity';
import type { WaveBossAttacksConfig } from '../../../../data/types/waves';
import type { BossAttackType } from '../../../../data/types/bossAttacks';
import type { MonsterSystem } from '../MonsterSystem';
import type { WaveSystem } from '../WaveSystem';
import type { HealthSystem } from '../../../../systems/HealthSystem';
import type { FeedbackSystem } from '../FeedbackSystem';
import type { SoundSystem } from '../SoundSystem';
import type { CursorSnapshot } from '../../../../scenes/game/GameSceneContracts';
import { BossBulletSpreadController } from './BossBulletSpreadController';
import { BossShockwaveController } from './BossShockwaveController';
import { BossDangerZoneController } from './BossDangerZoneController';

interface BossAttackSchedulerDeps {
  scene: Phaser.Scene;
  waveSystem: WaveSystem;
  monsterSystem: MonsterSystem;
  healthSystem: HealthSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  bosses: Map<string, Entity>;
  isGameOver: () => boolean;
}

/** 보스별 공격 스케줄링 상태 */
interface BossAttackTimers {
  /** 공격 유형별 다음 발동 가능 시각 */
  nextAttackTime: Map<BossAttackType, number>;
  /** 현재 활성 공격이 있는지 (보스당 1개 제한) */
  isAttacking: boolean;
}

export class BossAttackScheduler {
  private readonly scene: Phaser.Scene;
  private readonly waveSystem: WaveSystem;
  private readonly monsterSystem: MonsterSystem;
  private readonly healthSystem: HealthSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly bosses: Map<string, Entity>;
  private readonly isGameOver: () => boolean;

  private readonly bossTimers = new Map<string, BossAttackTimers>();

  private readonly bulletSpreadController: BossBulletSpreadController;
  private readonly shockwaveController: BossShockwaveController;
  private readonly dangerZoneController: BossDangerZoneController;

  constructor(deps: BossAttackSchedulerDeps) {
    this.scene = deps.scene;
    this.waveSystem = deps.waveSystem;
    this.monsterSystem = deps.monsterSystem;
    this.healthSystem = deps.healthSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.bosses = deps.bosses;
    this.isGameOver = deps.isGameOver;

    this.bulletSpreadController = new BossBulletSpreadController({
      scene: this.scene,
      healthSystem: this.healthSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      isGameOver: this.isGameOver,
    });
    this.shockwaveController = new BossShockwaveController({
      scene: this.scene,
      healthSystem: this.healthSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      isGameOver: this.isGameOver,
    });
    this.dangerZoneController = new BossDangerZoneController({
      scene: this.scene,
      healthSystem: this.healthSystem,
      feedbackSystem: this.feedbackSystem,
      soundSystem: this.soundSystem,
      isGameOver: this.isGameOver,
    });
  }

  /** 보스 스폰 시 타이머 초기화 */
  public initBossTimers(bossId: string, gameTime: number): void {
    const attacksConfig = this.getBossAttacksConfig(bossId);
    if (!attacksConfig) return;

    const timers: BossAttackTimers = {
      nextAttackTime: new Map(),
      isAttacking: false,
    };

    const attackTypes: BossAttackType[] = ['bulletSpread', 'shockwave', 'dangerZone'];
    for (const type of attackTypes) {
      const entry = attacksConfig[type];
      if (entry?.enabled) {
        const delay = Phaser.Math.Between(entry.minInterval, entry.maxInterval);
        timers.nextAttackTime.set(type, gameTime + delay);
      }
    }

    this.bossTimers.set(bossId, timers);
  }

  /** 보스 제거 시 타이머 정리 */
  public removeBossTimers(bossId: string): void {
    this.bossTimers.delete(bossId);
  }

  public update(delta: number, gameTime: number, cursor: CursorSnapshot, cursorRadius: number): void {
    // 1) 살아있는 보스 목록 확인
    const aliveBossIds = this.monsterSystem
      .getAliveBossIds()
      .filter((bossId) => {
        const boss = this.bosses.get(bossId);
        return boss?.visible === true;
      });
    const aliveBossIdSet = new Set(aliveBossIds);

    // 죽은 보스의 타이머 제거
    const staleIds: string[] = [];
    this.bossTimers.forEach((_timers, bossId) => {
      if (!aliveBossIdSet.has(bossId)) staleIds.push(bossId);
    });
    staleIds.forEach((id) => this.bossTimers.delete(id));

    // 2) 보스별 공격 스케줄링
    for (const bossId of aliveBossIds) {
      const timers = this.bossTimers.get(bossId);
      if (!timers) continue;

      // 이미 공격 중이면 스킵
      if (timers.isAttacking) continue;

      const attacksConfig = this.getBossAttacksConfig(bossId);
      if (!attacksConfig) continue;

      const boss = this.bosses.get(bossId);
      if (!boss) continue;

      // 발동 가능한 공격 중 가장 먼저 준비된 것 선택
      let bestAttack: BossAttackType | null = null;
      let bestTime = Infinity;

      for (const [type, nextTime] of timers.nextAttackTime.entries()) {
        if (gameTime >= nextTime && nextTime < bestTime) {
          bestTime = nextTime;
          bestAttack = type;
        }
      }

      if (bestAttack) {
        this.triggerAttack(bossId, boss, bestAttack, gameTime, cursor);
        timers.isAttacking = true;

        // 다음 타이머 설정
        const entry = attacksConfig[bestAttack];
        if (entry) {
          const interval = Phaser.Math.Between(entry.minInterval, entry.maxInterval);
          timers.nextAttackTime.set(bestAttack, gameTime + interval);
        }
      }
    }

    // 3) 각 컨트롤러 업데이트 (활성 공격 갱신/충돌 처리)
    this.bulletSpreadController.update(delta, gameTime, cursor, cursorRadius);
    this.shockwaveController.update(delta, gameTime, cursor, cursorRadius);
    this.dangerZoneController.update(delta, gameTime, cursor, cursorRadius);
  }

  /** 공격 완료 콜백 — 보스의 isAttacking 플래그 해제 */
  public markAttackComplete(bossId: string): void {
    const timers = this.bossTimers.get(bossId);
    if (timers) {
      timers.isAttacking = false;
    }
  }

  public clear(): void {
    this.bossTimers.clear();
    this.bulletSpreadController.clear();
    this.shockwaveController.clear();
    this.dangerZoneController.clear();
  }

  public destroy(): void {
    this.clear();
    this.bulletSpreadController.destroy();
    this.shockwaveController.destroy();
    this.dangerZoneController.destroy();
  }

  private triggerAttack(
    bossId: string,
    boss: Entity,
    attackType: BossAttackType,
    gameTime: number,
    cursor: CursorSnapshot
  ): void {
    const waveNumber = this.waveSystem.getCurrentWave();
    const onComplete = () => this.markAttackComplete(bossId);

    switch (attackType) {
      case 'bulletSpread':
        this.bulletSpreadController.trigger(bossId, boss.x, boss.y, gameTime, waveNumber, onComplete);
        break;
      case 'shockwave':
        this.shockwaveController.trigger(bossId, boss.x, boss.y, gameTime, waveNumber, onComplete);
        break;
      case 'dangerZone':
        this.dangerZoneController.trigger(bossId, boss.x, boss.y, gameTime, waveNumber, cursor, onComplete);
        break;
    }
  }

  private getBossAttacksConfig(bossId: string): WaveBossAttacksConfig | undefined {
    const bossConfig = this.waveSystem
      .getCurrentWaveBosses()
      .find((candidate) => candidate.id === bossId);
    return bossConfig?.attacks;
  }

  /** 렌더러 그래픽스 객체 반환 (GameScene에서 depth 관리용) */
  public getRenderers(): {
    bulletSpread: BossBulletSpreadController;
    shockwave: BossShockwaveController;
    dangerZone: BossDangerZoneController;
  } {
    return {
      bulletSpread: this.bulletSpreadController,
      shockwave: this.shockwaveController,
      dangerZone: this.dangerZoneController,
    };
  }
}
