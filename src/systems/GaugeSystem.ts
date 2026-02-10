import { Data } from '../data/DataManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ComboSystem } from './ComboSystem';

export class GaugeSystem {
  private currentGauge: number = 0;
  private readonly maxGauge: number = Data.gameConfig.gauge.maxGauge;
  private readonly gainPerDish: number = Data.gameConfig.gauge.gainPerDish;
  private comboSystem: ComboSystem;

  private onDishDestroyed = () => this.increaseGauge(this.calculateGain());
  private onWaveStarted = () => this.reset();

  constructor(comboSystem: ComboSystem) {
    this.comboSystem = comboSystem;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    EventBus.getInstance().on(GameEvents.DISH_DESTROYED, this.onDishDestroyed);
    EventBus.getInstance().on(GameEvents.WAVE_STARTED, this.onWaveStarted);
  }

  private calculateGain(): number {
    const currentCombo = this.comboSystem.getCombo();
    const bonusPerCombo = Data.combo.gaugeBonusPerCombo;

    // 콤보 1당 gaugeBonusPerCombo (기본 1%) 만큼 추가 증가
    // 공식: 기본 증가량 * (1 + 콤보 * 보너스율)
    const multiplier = 1 + currentCombo * bonusPerCombo;
    return this.gainPerDish * multiplier;
  }

  private increaseGauge(amount: number): void {
    this.currentGauge = Math.min(this.maxGauge, this.currentGauge + amount);
    this.emitUpdate();

    if (this.currentGauge >= this.maxGauge) {
      this.triggerAttack();
    }
  }

  private triggerAttack(): void {
    EventBus.getInstance().emit(GameEvents.PLAYER_ATTACK);
    this.currentGauge = 0; // Reset after attack
    this.emitUpdate();
  }

  private emitUpdate(): void {
    EventBus.getInstance().emit(GameEvents.GAUGE_UPDATED, {
      current: this.currentGauge,
      max: this.maxGauge,
      ratio: this.currentGauge / this.maxGauge,
    });
  }

  reset(): void {
    this.currentGauge = 0;
    this.emitUpdate();
  }

  destroy(): void {
    EventBus.getInstance().off(GameEvents.DISH_DESTROYED, this.onDishDestroyed);
    EventBus.getInstance().off(GameEvents.WAVE_STARTED, this.onWaveStarted);
  }
}
