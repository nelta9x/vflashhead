import type { EventBus } from '../utils/EventBus';
import type { ScopedEventBus } from './types/ModTypes';

type EventCallback = (...args: unknown[]) => void;

interface TrackedSubscription {
  readonly event: string;
  readonly callback: EventCallback;
}

/**
 * MOD별 EventBus 구독을 추적하는 래퍼.
 * removeAll()로 해당 MOD의 모든 구독을 일괄 해제한다.
 */
export class ScopedEventBusWrapper implements ScopedEventBus {
  private readonly inner: EventBus;
  private readonly subscriptions: TrackedSubscription[] = [];

  constructor(inner: EventBus) {
    this.inner = inner;
  }

  on(event: string, callback: EventCallback): void {
    this.inner.on(event, callback);
    this.subscriptions.push({ event, callback });
  }

  once(event: string, callback: EventCallback): void {
    const wrapped: EventCallback = (...args: unknown[]) => {
      this.inner.off(event, wrapped);
      this.removeTracked(event, wrapped);
      callback(...args);
    };
    this.inner.on(event, wrapped);
    this.subscriptions.push({ event, callback: wrapped });
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      this.inner.off(event, callback);
      this.removeTracked(event, callback);
    } else {
      // 해당 이벤트의 모든 구독 해제
      for (let i = this.subscriptions.length - 1; i >= 0; i--) {
        if (this.subscriptions[i].event === event) {
          this.inner.off(event, this.subscriptions[i].callback);
          this.subscriptions.splice(i, 1);
        }
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    this.inner.emit(event, ...args);
  }

  removeAll(): void {
    for (const sub of this.subscriptions) {
      this.inner.off(sub.event, sub.callback);
    }
    this.subscriptions.length = 0;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.length;
  }

  private removeTracked(event: string, callback: EventCallback): void {
    const idx = this.subscriptions.findIndex(
      (s) => s.event === event && s.callback === callback,
    );
    if (idx !== -1) {
      this.subscriptions.splice(idx, 1);
    }
  }
}
