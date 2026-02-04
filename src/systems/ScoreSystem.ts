import { EventBus, GameEvents } from '../utils/EventBus';

export class ScoreSystem {
  private score: number = 0;

  constructor() {
    this.score = 0;
  }

  addScore(points: number): void {
    this.score += points;
    EventBus.getInstance().emit(GameEvents.SCORE_CHANGED, this.score);
  }

  getScore(): number {
    return this.score;
  }

  reset(): void {
    this.score = 0;
    EventBus.getInstance().emit(GameEvents.SCORE_CHANGED, this.score);
  }
}
