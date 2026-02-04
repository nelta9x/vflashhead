import { INITIAL_HP } from '../config/constants';
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
}
