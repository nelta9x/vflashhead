import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSceneEventBinder } from '../src/scenes/game/GameSceneEventBinder';
import { GameEvents } from '../src/utils/EventBus';

type Listener = (...args: unknown[]) => void;

const listeners = new Map<string, Listener[]>();
const mockOn = vi.fn((event: string, handler: Listener) => {
  const current = listeners.get(event) ?? [];
  current.push(handler);
  listeners.set(event, current);
});
const mockOff = vi.fn((event: string, handler?: Listener) => {
  if (!handler) {
    listeners.delete(event);
    return;
  }
  const current = listeners.get(event) ?? [];
  listeners.set(
    event,
    current.filter((candidate) => candidate !== handler)
  );
});

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      on: mockOn,
      off: mockOff,
    }),
  },
  GameEvents: {
    DISH_DESTROYED: 'dish:destroyed',
    DISH_DAMAGED: 'dish:damaged',
    COMBO_MILESTONE: 'combo:milestone',
    WAVE_STARTED: 'wave:started',
    WAVE_COMPLETED: 'wave:completed',
    UPGRADE_SELECTED: 'upgrade:selected',
    WAVE_COUNTDOWN_TICK: 'wave:countdownTick',
    WAVE_READY: 'wave:ready',
    GAME_OVER: 'game:over',
    DISH_MISSED: 'dish:missed',
    HEALTH_PACK_UPGRADED: 'healthPack:upgraded',
    HP_CHANGED: 'hp:changed',
    HEALTH_PACK_PASSING: 'healthPack:passing',
    HEALTH_PACK_COLLECTED: 'healthPack:collected',
    MONSTER_HP_CHANGED: 'monster:hpChanged',
    GAUGE_UPDATED: 'gauge:updated',
    PLAYER_ATTACK: 'player:attack',
    MONSTER_DIED: 'monster:died',
    FALLING_BOMB_DESTROYED: 'fallingBomb:destroyed',
    BLACK_HOLE_CONSUMED: 'blackHole:consumed',
  },
}));

describe('GameSceneEventBinder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
  });

  it('binds events once and routes payloads to handlers', () => {
    const onDishDestroyed = vi.fn();
    const binder = new GameSceneEventBinder({
      onDishDestroyed,
      onDishDamaged: vi.fn(),
      onComboMilestone: vi.fn(),
      onWaveStarted: vi.fn(),
      onWaveCompleted: vi.fn(),
      onUpgradeSelected: vi.fn(),
      onWaveCountdownTick: vi.fn(),
      onWaveReady: vi.fn(),
      onGameOver: vi.fn(),
      onDishMissed: vi.fn(),
      onHealthPackUpgraded: vi.fn(),
      onHpChanged: vi.fn(),
      onHealthPackPassing: vi.fn(),
      onHealthPackCollected: vi.fn(),
      onMonsterHpChanged: vi.fn(),
      onGaugeUpdated: vi.fn(),
      onPlayerAttack: vi.fn(),
      onMonsterDied: vi.fn(),
      onFallingBombDestroyed: vi.fn(),
      onBlackHoleConsumed: vi.fn(),
    });

    binder.bind();
    const firstBindCalls = mockOn.mock.calls.length;
    binder.bind();

    expect(mockOn).toHaveBeenCalledTimes(firstBindCalls);

    const payload = { dish: { id: 'd1' }, x: 10, y: 20 };
    const dishDestroyedListeners = listeners.get(GameEvents.DISH_DESTROYED) ?? [];
    expect(dishDestroyedListeners.length).toBe(1);

    dishDestroyedListeners[0](payload);
    expect(onDishDestroyed).toHaveBeenCalledWith(payload);
  });

  it('unbinds every subscription with the same handler references', () => {
    const binder = new GameSceneEventBinder({
      onDishDestroyed: vi.fn(),
      onDishDamaged: vi.fn(),
      onComboMilestone: vi.fn(),
      onWaveStarted: vi.fn(),
      onWaveCompleted: vi.fn(),
      onUpgradeSelected: vi.fn(),
      onWaveCountdownTick: vi.fn(),
      onWaveReady: vi.fn(),
      onGameOver: vi.fn(),
      onDishMissed: vi.fn(),
      onHealthPackUpgraded: vi.fn(),
      onHpChanged: vi.fn(),
      onHealthPackPassing: vi.fn(),
      onHealthPackCollected: vi.fn(),
      onMonsterHpChanged: vi.fn(),
      onGaugeUpdated: vi.fn(),
      onPlayerAttack: vi.fn(),
      onMonsterDied: vi.fn(),
      onFallingBombDestroyed: vi.fn(),
      onBlackHoleConsumed: vi.fn(),
    });

    binder.bind();
    const bindCount = mockOn.mock.calls.length;
    binder.unbind();

    expect(mockOff).toHaveBeenCalledTimes(bindCount);
    listeners.forEach((registered) => {
      expect(registered.length).toBe(0);
    });
  });
});
