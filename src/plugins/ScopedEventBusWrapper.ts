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
  private readonly onceOriginalToWrapped = new Map<string, Map<EventCallback, EventCallback>>();

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
      this.deleteOnceMapping(event, callback);
      callback(...args);
    };
    this.setOnceMapping(event, callback, wrapped);
    this.inner.on(event, wrapped);
    this.subscriptions.push({ event, callback: wrapped });
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      const wrapped = this.getOnceWrapped(event, callback) ?? callback;
      this.inner.off(event, wrapped);
      this.removeTracked(event, wrapped);
      this.deleteOnceMapping(event, callback);
    } else {
      for (let i = this.subscriptions.length - 1; i >= 0; i--) {
        if (this.subscriptions[i].event === event) {
          this.inner.off(event, this.subscriptions[i].callback);
          this.subscriptions.splice(i, 1);
        }
      }
      this.onceOriginalToWrapped.delete(event);
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
    this.onceOriginalToWrapped.clear();
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

  private setOnceMapping(event: string, original: EventCallback, wrapped: EventCallback): void {
    let map = this.onceOriginalToWrapped.get(event);
    if (!map) {
      map = new Map();
      this.onceOriginalToWrapped.set(event, map);
    }
    map.set(original, wrapped);
  }

  private getOnceWrapped(event: string, original: EventCallback): EventCallback | undefined {
    return this.onceOriginalToWrapped.get(event)?.get(original);
  }

  private deleteOnceMapping(event: string, original: EventCallback): void {
    this.onceOriginalToWrapped.get(event)?.delete(original);
  }
}
