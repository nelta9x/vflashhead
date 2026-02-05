import { Data } from '../data/DataManager';
import { EventBus, GameEvents } from '../utils/EventBus';

export class ComboSystem {
  private combo: number = 0;
  private maxCombo: number = 0;
  private timeSinceLastHit: number = 0;
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

  increment(bonus: number = 0): void {
    const amount = 1 + bonus;
    this.combo += amount;
    this.timeSinceLastHit = 0;

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    EventBus.getInstance().emit(GameEvents.COMBO_INCREASED, this.combo);

    // 마일스톤 체크 (JSON에서 로드)
    const milestones = Data.combo.milestones;
    // 보너스로 인해 마일스톤을 건너뛸 수 있으므로 범위 체크
    for (const milestone of milestones) {
      if (this.combo >= milestone && this.combo - amount < milestone) {
        EventBus.getInstance().emit(GameEvents.COMBO_MILESTONE, milestone);
      }
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
   * 공식: max(minimum, base - combo*comboReduction - wave*waveReduction) + comboDurationBonus
   */
  private getDynamicTimeout(): number {
    const timeout = Data.combo.timeout;
    const baseTimeout = Math.max(
      timeout.minimum,
      timeout.base - this.combo * timeout.comboReduction - this.currentWave * timeout.waveReduction
    );
    return baseTimeout + this.comboDurationBonus;
  }

  getCombo(): number {
    return this.combo;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  /**
   * 배율에 소프트캡 적용
   * 공식: 1 + combo * factor / (1 + combo * softcapFactor)
   */
  getMultiplier(): number {
    const mult = Data.combo.multiplier;
    return 1 + (this.combo * mult.factor) / (1 + this.combo * mult.softcapFactor);
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
