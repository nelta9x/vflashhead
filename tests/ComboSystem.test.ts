import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import EventBus first to avoid Phaser dependency issues
import { EventBus, GameEvents } from '../src/utils/EventBus';
import { ComboSystem } from '../src/systems/ComboSystem';

describe('ComboSystem', () => {
  let comboSystem: ComboSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    EventBus.resetInstance();
    eventBus = EventBus.getInstance();
    comboSystem = new ComboSystem();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('increment', () => {
    it('콤보가 증가해야 함', () => {
      comboSystem.increment();
      expect(comboSystem.getCombo()).toBe(1);
      comboSystem.increment();
      expect(comboSystem.getCombo()).toBe(2);
    });

    it('최대 콤보가 업데이트되어야 함', () => {
      comboSystem.increment();
      comboSystem.increment();
      comboSystem.increment();
      expect(comboSystem.getMaxCombo()).toBe(3);
    });

    it('COMBO_INCREASED 이벤트가 발생해야 함', () => {
      const callback = vi.fn();
      eventBus.on(GameEvents.COMBO_INCREASED, callback);
      comboSystem.increment();
      expect(callback).toHaveBeenCalledWith(1);
    });

    it('마일스톤에서 COMBO_MILESTONE 이벤트가 발생해야 함', () => {
      const callback = vi.fn();
      eventBus.on(GameEvents.COMBO_MILESTONE, callback);

      // 5 콤보까지 증가
      for (let i = 0; i < 5; i++) {
        comboSystem.increment();
      }

      expect(callback).toHaveBeenCalledWith(5);
    });
  });

  describe('reset', () => {
    it('콤보가 0으로 리셋되어야 함', () => {
      comboSystem.increment();
      comboSystem.increment();
      comboSystem.reset();
      expect(comboSystem.getCombo()).toBe(0);
    });

    it('최대 콤보는 유지되어야 함', () => {
      comboSystem.increment();
      comboSystem.increment();
      comboSystem.increment();
      comboSystem.reset();
      expect(comboSystem.getMaxCombo()).toBe(3);
    });

    it('COMBO_RESET 이벤트가 발생해야 함', () => {
      const callback = vi.fn();
      eventBus.on(GameEvents.COMBO_RESET, callback);
      comboSystem.increment();
      comboSystem.reset();
      expect(callback).toHaveBeenCalledWith(1);
    });

    it('콤보가 0이면 COMBO_RESET 이벤트가 발생하지 않아야 함', () => {
      const callback = vi.fn();
      eventBus.on(GameEvents.COMBO_RESET, callback);
      comboSystem.reset();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('2초 후에 콤보가 리셋되어야 함', () => {
      comboSystem.increment();
      comboSystem.update(2000);
      expect(comboSystem.getCombo()).toBe(0);
    });

    it('2초 미만에서는 콤보가 유지되어야 함', () => {
      comboSystem.increment();
      comboSystem.update(1999);
      expect(comboSystem.getCombo()).toBe(1);
    });

    it('증가 후 타이머가 리셋되어야 함', () => {
      comboSystem.increment();
      comboSystem.update(1500);
      comboSystem.increment();
      comboSystem.update(1500);
      expect(comboSystem.getCombo()).toBe(2);
    });
  });

  describe('getMultiplier', () => {
    it('콤보에 따른 배율이 계산되어야 함', () => {
      expect(comboSystem.getMultiplier()).toBe(1);
      comboSystem.increment();
      expect(comboSystem.getMultiplier()).toBe(1.1);
      comboSystem.increment();
      comboSystem.increment();
      comboSystem.increment();
      comboSystem.increment();
      expect(comboSystem.getMultiplier()).toBe(1.5);
    });
  });

  describe('getTimeRemaining / getTimeRatio', () => {
    it('남은 시간이 정확해야 함', () => {
      comboSystem.increment();
      comboSystem.update(500);
      expect(comboSystem.getTimeRemaining()).toBe(1500);
    });

    it('시간 비율이 정확해야 함', () => {
      comboSystem.increment();
      comboSystem.update(1000);
      expect(comboSystem.getTimeRatio()).toBe(0.5);
    });

    it('콤보가 0이면 0을 반환해야 함', () => {
      expect(comboSystem.getTimeRemaining()).toBe(0);
      expect(comboSystem.getTimeRatio()).toBe(0);
    });
  });
});
