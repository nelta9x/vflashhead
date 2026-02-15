import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/data/constants', () => ({}));
vi.mock('../src/utils/EventBus', async () => {
  const { EventBus: RealEventBus } = await import('../src/utils/EventBus');
  return { EventBus: RealEventBus, GameEvents: {} };
});

import { EventBus } from '../src/utils/EventBus';
import { ScopedEventBusWrapper } from '../src/plugins/ScopedEventBusWrapper';

describe('ScopedEventBusWrapper', () => {
  let inner: EventBus;
  let wrapper: ScopedEventBusWrapper;

  beforeEach(() => {
    EventBus.resetInstance();
    inner = EventBus.getInstance();
    wrapper = new ScopedEventBusWrapper(inner);
  });

  describe('on / emit', () => {
    it('on으로 등록한 콜백이 emit 시 호출되어야 함', () => {
      const cb = vi.fn();
      wrapper.on('test', cb);
      wrapper.emit('test', 'arg1', 42);
      expect(cb).toHaveBeenCalledWith('arg1', 42);
    });

    it('on 등록 후 getSubscriptionCount가 증가해야 함', () => {
      wrapper.on('a', vi.fn());
      wrapper.on('b', vi.fn());
      expect(wrapper.getSubscriptionCount()).toBe(2);
    });
  });

  describe('off', () => {
    it('off(event, cb)로 특정 구독을 해제하면 더 이상 호출되지 않아야 함', () => {
      const cb = vi.fn();
      wrapper.on('test', cb);
      wrapper.off('test', cb);
      wrapper.emit('test');
      expect(cb).not.toHaveBeenCalled();
      expect(wrapper.getSubscriptionCount()).toBe(0);
    });

    it('off(event)로 이벤트의 모든 구독을 해제해야 함', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      wrapper.on('test', cb1);
      wrapper.on('test', cb2);
      wrapper.off('test');
      wrapper.emit('test');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(wrapper.getSubscriptionCount()).toBe(0);
    });
  });

  describe('once', () => {
    it('once로 등록한 콜백이 1회 호출 후 자동 해제되어야 함', () => {
      const cb = vi.fn();
      wrapper.once('test', cb);
      wrapper.emit('test', 'data');
      wrapper.emit('test', 'data2');
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith('data');
    });

    it('once 등록 후 호출 전에는 subscriptionCount에 포함되어야 함', () => {
      wrapper.once('test', vi.fn());
      expect(wrapper.getSubscriptionCount()).toBe(1);
    });

    it('once 콜백 호출 후 subscriptionCount가 감소해야 함', () => {
      wrapper.once('test', vi.fn());
      wrapper.emit('test');
      expect(wrapper.getSubscriptionCount()).toBe(0);
    });
  });

  describe('removeAll', () => {
    it('모든 구독을 일괄 해제해야 함', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();
      wrapper.on('a', cb1);
      wrapper.on('b', cb2);
      wrapper.once('c', cb3);
      wrapper.removeAll();

      wrapper.emit('a');
      wrapper.emit('b');
      wrapper.emit('c');

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(cb3).not.toHaveBeenCalled();
      expect(wrapper.getSubscriptionCount()).toBe(0);
    });

    it('빈 상태에서 removeAll을 호출해도 안전해야 함', () => {
      expect(() => wrapper.removeAll()).not.toThrow();
    });
  });

  describe('once + off with original callback', () => {
    it('once 등록 후 원본 콜백으로 off할 수 있어야 함', () => {
      const cb = vi.fn();
      wrapper.once('test', cb);
      expect(wrapper.getSubscriptionCount()).toBe(1);

      wrapper.off('test', cb);
      expect(wrapper.getSubscriptionCount()).toBe(0);

      wrapper.emit('test');
      expect(cb).not.toHaveBeenCalled();
    });

    it('once 콜백이 실행된 후 off를 호출해도 안전해야 함', () => {
      const cb = vi.fn();
      wrapper.once('test', cb);
      wrapper.emit('test');
      expect(cb).toHaveBeenCalledTimes(1);

      expect(() => wrapper.off('test', cb)).not.toThrow();
    });
  });

  describe('getSubscriptionCount', () => {
    it('초기 상태에서 0이어야 함', () => {
      expect(wrapper.getSubscriptionCount()).toBe(0);
    });

    it('on/off 조합에서 정확한 카운트를 반환해야 함', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      wrapper.on('a', cb1);
      wrapper.on('a', cb2);
      expect(wrapper.getSubscriptionCount()).toBe(2);
      wrapper.off('a', cb1);
      expect(wrapper.getSubscriptionCount()).toBe(1);
    });
  });
});
