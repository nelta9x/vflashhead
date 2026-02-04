import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/utils/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    EventBus.resetInstance();
    eventBus = EventBus.getInstance();
  });

  describe('싱글톤 패턴', () => {
    it('항상 같은 인스턴스를 반환해야 함', () => {
      const instance1 = EventBus.getInstance();
      const instance2 = EventBus.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('resetInstance 후 새 인스턴스 반환', () => {
      const instance1 = EventBus.getInstance();
      EventBus.resetInstance();
      const instance2 = EventBus.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('on / emit', () => {
    it('이벤트 구독 및 발행이 작동해야 함', () => {
      const callback = vi.fn();
      eventBus.on('test', callback);
      eventBus.emit('test');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('여러 인자를 전달할 수 있어야 함', () => {
      const callback = vi.fn();
      eventBus.on('test', callback);
      eventBus.emit('test', 'arg1', 42, { key: 'value' });
      expect(callback).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });

    it('여러 구독자에게 이벤트가 전달되어야 함', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      eventBus.emit('test');
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('한 번만 호출되어야 함', () => {
      const callback = vi.fn();
      eventBus.once('test', callback);
      eventBus.emit('test');
      eventBus.emit('test');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('특정 콜백 구독 해제', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      eventBus.off('test', callback1);
      eventBus.emit('test');
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('이벤트 전체 구독 해제', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      eventBus.off('test');
      eventBus.emit('test');
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('hasListeners / getListenerCount', () => {
    it('리스너 존재 여부 확인', () => {
      expect(eventBus.hasListeners('test')).toBe(false);
      eventBus.on('test', () => {});
      expect(eventBus.hasListeners('test')).toBe(true);
    });

    it('리스너 개수 반환', () => {
      expect(eventBus.getListenerCount('test')).toBe(0);
      eventBus.on('test', () => {});
      eventBus.on('test', () => {});
      expect(eventBus.getListenerCount('test')).toBe(2);
    });
  });

  describe('clear', () => {
    it('모든 이벤트 리스너 제거', () => {
      eventBus.on('test1', () => {});
      eventBus.on('test2', () => {});
      eventBus.clear();
      expect(eventBus.hasListeners('test1')).toBe(false);
      expect(eventBus.hasListeners('test2')).toBe(false);
    });
  });
});
