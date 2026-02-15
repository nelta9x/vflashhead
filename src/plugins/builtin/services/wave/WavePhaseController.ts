import { WAVE_TRANSITION } from '../../../../data/constants';
import { EventBus, GameEvents } from '../../../../utils/EventBus';

export type WavePhase = 'waiting' | 'countdown' | 'spawning';

export class WavePhaseController {
  private wavePhase: WavePhase = 'waiting';
  private countdownTimer = 0;
  private countdownElapsed = 0;
  private pendingWaveNumber = 1;

  public startSpawning(): void {
    this.wavePhase = 'spawning';
  }

  public startCountdown(waveNumber: number): void {
    this.pendingWaveNumber = waveNumber;
    this.wavePhase = 'countdown';
    this.countdownTimer = WAVE_TRANSITION.COUNTDOWN_DURATION;
    this.countdownElapsed = 0;
    EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_START, waveNumber);
  }

  public forceWaiting(): void {
    this.wavePhase = 'waiting';
  }

  public getWavePhase(): WavePhase {
    return this.wavePhase;
  }

  public isSpawning(): boolean {
    return this.wavePhase === 'spawning';
  }

  public updateCountdown(delta: number): number | null {
    if (this.wavePhase !== 'countdown') {
      return null;
    }

    const duration = Math.max(1, WAVE_TRANSITION.COUNTDOWN_DURATION);
    const countFrom = Math.max(1, WAVE_TRANSITION.COUNT_FROM ?? 3);
    const stepDuration = duration / countFrom;
    const clampedPrevElapsed = Math.min(this.countdownElapsed, duration);
    const prevStep = Math.floor(clampedPrevElapsed / stepDuration);

    this.countdownElapsed += delta;
    const clampedCurrentElapsed = Math.min(this.countdownElapsed, duration);
    const currentStep = Math.floor(clampedCurrentElapsed / stepDuration);
    this.countdownTimer -= delta;

    if (currentStep > prevStep) {
      const lastStep = Math.min(currentStep, countFrom);
      for (let step = prevStep + 1; step <= lastStep; step++) {
        EventBus.getInstance().emit(GameEvents.WAVE_COUNTDOWN_TICK, Math.max(0, countFrom - step));
      }
    }

    if (this.countdownTimer > 0) {
      return null;
    }

    this.wavePhase = 'spawning';
    EventBus.getInstance().emit(GameEvents.WAVE_READY);
    return this.pendingWaveNumber;
  }
}
