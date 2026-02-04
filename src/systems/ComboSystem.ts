import { EventBus, GameEvents } from '../utils/EventBus';

export class ComboSystem {
  private combo: number = 0;
  private maxCombo: number = 0;
  private timeSinceLastHit: number = 0;
  private comboMilestones: number[] = [5, 10, 25, 50, 100];
  private currentWave: number = 1;
  private comboDurationBonus: number = 0;
  private infiniteTimeout: boolean = false;

  constructor() {
    this.combo = 0;
    this.maxCombo = 0;
    this.timeSinceLastHit = 0;
    this.currentWave = 1;
    this.comboDurationBonus = 0;
    this.infiniteTimeout = false;
  }

  setWave(wave: number): void {
    this.currentWave = wave;
  }

  setComboDurationBonus(bonus: number): void {
    this.comboDurationBonus = bonus;
  }

  setInfiniteTimeout(enabled: boolean): void {
    this.infiniteTimeout = enabled;
  }

  increment(): void {
    this.combo++;
    this.timeSinceLastHit = 0;

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    EventBus.getInstance().emit(GameEvents.COMBO_INCREASED, this.combo);

    // 마일스톤 체크
    if (this.comboMilestones.includes(this.combo)) {
      EventBus.getInstance().emit(GameEvents.COMBO_MILESTONE, this.combo);
    }
  }

  reset(): void {
    if (this.combo > 0) {
      EventBus.getInstance().emit(GameEvents.COMBO_RESET, this.combo);
    }
    this.combo = 0;
    this.timeSinceLastHit = 0;
  }

  update(delta: number): void {
    if (this.combo > 0 && !this.infiniteTimeout) {
      this.timeSinceLastHit += delta;

      if (this.timeSinceLastHit >= this.getDynamicTimeout()) {
        this.reset();
      }
    }
  }

  /**
   * 동적 타임아웃: 콤보와 웨이브가 높을수록 타임아웃이 짧아짐
   * 공식: max(600, 1500 - combo*15 - wave*80) + comboDurationBonus
   */
  private getDynamicTimeout(): number {
    const baseTimeout = Math.max(600, 1500 - this.combo * 15 - this.currentWave * 80);
    return baseTimeout + this.comboDurationBonus;
  }

  getCombo(): number {
    return this.combo;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  /**
   * 배율에 소프트캡 적용: 1 + combo * 0.1 / (1 + combo * 0.01)
   * 콤보 10: 1.83x, 콤보 50: 3.33x, 콤보 100: 5.0x
   */
  getMultiplier(): number {
    return 1 + (this.combo * 0.1) / (1 + this.combo * 0.01);
  }

  getTimeRemaining(): number {
    if (this.combo === 0) return 0;
    return Math.max(0, this.getDynamicTimeout() - this.timeSinceLastHit);
  }

  getTimeRatio(): number {
    if (this.combo === 0) return 0;
    return this.getTimeRemaining() / this.getDynamicTimeout();
  }

  getCurrentTimeout(): number {
    return this.getDynamicTimeout();
  }
}
