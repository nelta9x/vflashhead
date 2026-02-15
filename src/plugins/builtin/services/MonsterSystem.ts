import { EventBus, GameEvents } from '../../../utils/EventBus';
import { resolveWaveBossConfig, splitBossTotalHpByWeight } from './waveBossConfig';

interface BossState {
  currentHp: number;
  maxHp: number;
  isDead: boolean;
}

export class MonsterSystem {
  private bossStates: Map<string, BossState> = new Map();
  private readonly onWaveStarted: (...args: unknown[]) => void;

  constructor() {
    this.onWaveStarted = (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.reset(waveNumber);
    };
    EventBus.getInstance().on(GameEvents.WAVE_STARTED, this.onWaveStarted);
  }

  destroy(): void {
    EventBus.getInstance().off(GameEvents.WAVE_STARTED, this.onWaveStarted);
  }

  reset(waveNumber: number): void {
    const bossConfig = resolveWaveBossConfig(waveNumber);
    const hpById = splitBossTotalHpByWeight(bossConfig.bossTotalHp, bossConfig.bosses);

    this.bossStates.clear();

    for (const boss of bossConfig.bosses) {
      const maxHp = Math.max(1, hpById.get(boss.id) ?? 1);
      this.bossStates.set(boss.id, {
        currentHp: maxHp,
        maxHp,
        isDead: false,
      });
      this.emitHpChange(boss.id);
    }
  }

  takeDamage(bossId: string, amount: number, sourceX?: number, sourceY?: number): void {
    const state = this.bossStates.get(bossId);
    if (!state || state.isDead) return;
    if (amount <= 0) return;

    state.currentHp = Math.max(0, state.currentHp - amount);
    this.emitHpChange(bossId, sourceX, sourceY);

    if (state.currentHp === 0) {
      this.die(bossId);
    }
  }

  private die(bossId: string): void {
    const state = this.bossStates.get(bossId);
    if (!state || state.isDead) return;

    state.isDead = true;
    EventBus.getInstance().emit(GameEvents.MONSTER_DIED, { bossId });
  }

  private emitHpChange(bossId: string, sourceX?: number, sourceY?: number): void {
    const state = this.bossStates.get(bossId);
    if (!state) return;

    EventBus.getInstance().emit(GameEvents.MONSTER_HP_CHANGED, {
      bossId,
      current: state.currentHp,
      max: state.maxHp,
      ratio: state.currentHp / state.maxHp,
      sourceX,
      sourceY,
    });
  }

  getCurrentHp(bossId?: string): number {
    if (bossId) {
      return this.bossStates.get(bossId)?.currentHp ?? 0;
    }

    let total = 0;
    for (const state of this.bossStates.values()) {
      total += state.currentHp;
    }
    return total;
  }

  getMaxHp(bossId?: string): number {
    if (bossId) {
      return this.bossStates.get(bossId)?.maxHp ?? 0;
    }

    let total = 0;
    for (const state of this.bossStates.values()) {
      total += state.maxHp;
    }
    return total;
  }

  isAlive(bossId?: string): boolean {
    if (bossId) {
      const state = this.bossStates.get(bossId);
      return !!state && !state.isDead;
    }

    for (const state of this.bossStates.values()) {
      if (!state.isDead) return true;
    }
    return false;
  }

  getAliveBossIds(): string[] {
    const aliveBossIds: string[] = [];
    for (const [bossId, state] of this.bossStates.entries()) {
      if (!state.isDead) {
        aliveBossIds.push(bossId);
      }
    }
    return aliveBossIds;
  }

  areAllDead(): boolean {
    if (this.bossStates.size === 0) return false;
    for (const state of this.bossStates.values()) {
      if (!state.isDead) return false;
    }
    return true;
  }

  publishBossHpSnapshot(bossId: string): void {
    this.emitHpChange(bossId);
  }
}
