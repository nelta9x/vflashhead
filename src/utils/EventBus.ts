type EventCallback = (...args: unknown[]) => void;

interface EventSubscription {
  callback: EventCallback;
  once: boolean;
}

export class EventBus {
  private static instance: EventBus;
  private events: Map<string, EventSubscription[]> = new Map();

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  static resetInstance(): void {
    EventBus.instance = new EventBus();
  }

  on(event: string, callback: EventCallback): void {
    this.addListener(event, callback, false);
  }

  once(event: string, callback: EventCallback): void {
    this.addListener(event, callback, true);
  }

  private addListener(event: string, callback: EventCallback, once: boolean): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push({ callback, once });
  }

  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.events.delete(event);
      return;
    }

    const subscribers = this.events.get(event);
    if (subscribers) {
      const filtered = subscribers.filter((sub) => sub.callback !== callback);
      if (filtered.length > 0) {
        this.events.set(event, filtered);
      } else {
        this.events.delete(event);
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const subscribers = this.events.get(event);
    if (!subscribers) return;

    const toRemove: EventSubscription[] = [];

    for (const sub of subscribers) {
      sub.callback(...args);
      if (sub.once) {
        toRemove.push(sub);
      }
    }

    if (toRemove.length > 0) {
      const remaining = subscribers.filter((sub) => !toRemove.includes(sub));
      if (remaining.length > 0) {
        this.events.set(event, remaining);
      } else {
        this.events.delete(event);
      }
    }
  }

  hasListeners(event: string): boolean {
    return this.events.has(event) && this.events.get(event)!.length > 0;
  }

  getListenerCount(event: string): number {
    return this.events.get(event)?.length ?? 0;
  }

  clear(): void {
    this.events.clear();
  }
}

export const eventBus = EventBus.getInstance();

// 게임 이벤트 타입 정의
export const GameEvents = {
  // 접시 관련
  DISH_DESTROYED: 'dish:destroyed',
  DISH_ESCAPED: 'dish:escaped',
  DISH_SPAWNED: 'dish:spawned',
  DISH_DAMAGED: 'dish:damaged',

  // 콤보 관련
  COMBO_INCREASED: 'combo:increased',
  COMBO_RESET: 'combo:reset',
  COMBO_MILESTONE: 'combo:milestone',

  // 웨이브 관련
  WAVE_STARTED: 'wave:started',
  WAVE_COMPLETED: 'wave:completed',

  // 업그레이드 관련
  UPGRADE_AVAILABLE: 'upgrade:available',
  UPGRADE_SELECTED: 'upgrade:selected',

  // 점수 관련
  SCORE_CHANGED: 'score:changed',

  // 게임 상태
  GAME_OVER: 'game:over',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',

  // 피드백
  SCREEN_SHAKE: 'feedback:screenShake',
  SLOW_MOTION: 'feedback:slowMotion',

  // HP 관련
  DISH_MISSED: 'dish:missed',
  HP_CHANGED: 'hp:changed',

  // 힐팩 관련
  HEALTH_PACK_SPAWNED: 'healthPack:spawned',
  HEALTH_PACK_COLLECTED: 'healthPack:collected',
  HEALTH_PACK_MISSED: 'healthPack:missed',
} as const;
