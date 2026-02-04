import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScoreSystem } from '../src/systems/ScoreSystem';
import { EventBus, GameEvents } from '../src/utils/EventBus';

describe('ScoreSystem', () => {
  let scoreSystem: ScoreSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    EventBus.resetInstance();
    eventBus = EventBus.getInstance();
    scoreSystem = new ScoreSystem();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('초기화', () => {
    it('초기 점수는 0이어야 함', () => {
      expect(scoreSystem.getScore()).toBe(0);
    });
  });

  describe('addScore', () => {
    it('점수가 추가되어야 함', () => {
      scoreSystem.addScore(100);
      expect(scoreSystem.getScore()).toBe(100);
    });

    it('점수가 누적되어야 함', () => {
      scoreSystem.addScore(100);
      scoreSystem.addScore(200);
      scoreSystem.addScore(50);
      expect(scoreSystem.getScore()).toBe(350);
    });

    it('SCORE_CHANGED 이벤트가 발생해야 함', () => {
      const callback = vi.fn();
      eventBus.on(GameEvents.SCORE_CHANGED, callback);
      scoreSystem.addScore(100);
      expect(callback).toHaveBeenCalledWith(100);
    });
  });

  describe('reset', () => {
    it('점수가 0으로 리셋되어야 함', () => {
      scoreSystem.addScore(500);
      scoreSystem.reset();
      expect(scoreSystem.getScore()).toBe(0);
    });

    it('SCORE_CHANGED 이벤트가 0으로 발생해야 함', () => {
      const callback = vi.fn();
      scoreSystem.addScore(500);
      eventBus.on(GameEvents.SCORE_CHANGED, callback);
      scoreSystem.reset();
      expect(callback).toHaveBeenCalledWith(0);
    });
  });
});
