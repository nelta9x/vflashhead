import { INITIAL_HP } from '../../data/constants';
import { EventBus, GameEvents } from '../utils/EventBus';

export class HealthSystem {
  private hp: number;
  private maxHp: number;

  constructor(maxHp: number = INITIAL_HP) {
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  takeDamage(amount: number = 1): void {
    const previousHp = this.hp;
    this.hp = Math.max(0, this.hp - amount);

    if (previousHp !== this.hp) {
      EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
        hp: this.hp,
        maxHp: this.maxHp,
        delta: -amount,
      });

      if (this.hp === 0) {
        EventBus.getInstance().emit(GameEvents.GAME_OVER);
      }
    }
  }

  heal(amount: number = 1): void {
    const previousHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);

    if (previousHp !== this.hp) {
      EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
        hp: this.hp,
        maxHp: this.maxHp,
        delta: amount,
      });
    }
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getHpRatio(): number {
    return this.hp / this.maxHp;
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  reset(): void {
    this.hp = this.maxHp;
    EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
      hp: this.hp,
      maxHp: this.maxHp,
      delta: 0,
    });
  }

  setMaxHp(value: number): void {
    const previousMax = this.maxHp;
    this.maxHp = value;

    // 최대 HP가 증가하면 이벤트 발생 (현재 HP는 유지)
    if (this.maxHp !== previousMax) {
      EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
        hp: this.hp,
        maxHp: this.maxHp,
        delta: 0,
      });
    }
  }

  revive(amount: number): boolean {
    // 죽은 상태에서만 부활 가능
    if (!this.isDead()) {
      return false;
    }

    // 부활 시 HP 회복 (최대 HP 제한)
    this.hp = Math.min(this.maxHp, amount);

    EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
      hp: this.hp,
      maxHp: this.maxHp,
      delta: this.hp,
    });

    return true;
  }
}
