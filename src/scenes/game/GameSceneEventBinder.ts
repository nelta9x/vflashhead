import Phaser from 'phaser';
import { EventBus, GameEvents } from '../../utils/EventBus';
import type {
  DishDamagedEventPayload,
  DishDestroyedEventPayload,
  DishMissedEventPayload,
} from './GameSceneContracts';

interface HealthPackUpgradedPayload {
  hpBonus: number;
}

interface HpChangedPayload {
  hp: number;
  maxHp: number;
  delta: number;
  isFullHeal?: boolean;
}

interface HealthPackCollectedPayload {
  pack: Phaser.GameObjects.Container;
  x: number;
  y: number;
}

interface HealthPackPassingPayload {
  x: number;
  y: number;
}

interface GaugeUpdatedPayload {
  current: number;
  max: number;
  ratio: number;
}

interface FallingBombDestroyedPayload {
  bomb: Phaser.GameObjects.Container;
  x: number;
  y: number;
  byAbility: boolean;
}

export interface GameSceneEventBinderHandlers {
  onDishDestroyed: (payload: DishDestroyedEventPayload) => void;
  onDishDamaged: (payload: DishDamagedEventPayload) => void;
  onComboMilestone: (milestone: number) => void;
  onWaveStarted: (waveNumber: number) => void;
  onWaveCompleted: (waveNumber: number) => void;
  onUpgradeSelected: () => void;
  onWaveCountdownTick: (seconds: number) => void;
  onWaveReady: () => void;
  onGameOver: () => void;
  onDishMissed: (payload: DishMissedEventPayload) => void;
  onHealthPackUpgraded: (payload: HealthPackUpgradedPayload) => void;
  onHpChanged: (payload: HpChangedPayload) => void;
  onHealthPackPassing: (payload: HealthPackPassingPayload) => void;
  onHealthPackCollected: (payload: HealthPackCollectedPayload) => void;
  onMonsterHpChanged: () => void;
  onGaugeUpdated: (payload: GaugeUpdatedPayload) => void;
  onPlayerAttack: () => void;
  onMonsterDied: () => void;
  onFallingBombDestroyed: (payload: FallingBombDestroyedPayload) => void;
}

interface EventSubscription {
  event: string;
  handler: (...args: unknown[]) => void;
}

export class GameSceneEventBinder {
  private readonly handlers: GameSceneEventBinderHandlers;
  private readonly subscriptions: EventSubscription[] = [];
  private isBound = false;

  constructor(handlers: GameSceneEventBinderHandlers) {
    this.handlers = handlers;
  }

  public bind(): void {
    if (this.isBound) {
      return;
    }

    this.addSubscription(GameEvents.DISH_DESTROYED, (...args: unknown[]) => {
      const payload = args[0] as DishDestroyedEventPayload;
      this.handlers.onDishDestroyed(payload);
    });
    this.addSubscription(GameEvents.DISH_DAMAGED, (...args: unknown[]) => {
      const payload = args[0] as DishDamagedEventPayload;
      this.handlers.onDishDamaged(payload);
    });
    this.addSubscription(GameEvents.COMBO_MILESTONE, (...args: unknown[]) => {
      const milestone = args[0] as number;
      this.handlers.onComboMilestone(milestone);
    });
    this.addSubscription(GameEvents.WAVE_STARTED, (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.handlers.onWaveStarted(waveNumber);
    });
    this.addSubscription(GameEvents.WAVE_COMPLETED, (...args: unknown[]) => {
      const waveNumber = args[0] as number;
      this.handlers.onWaveCompleted(waveNumber);
    });
    this.addSubscription(GameEvents.UPGRADE_SELECTED, () => {
      this.handlers.onUpgradeSelected();
    });
    this.addSubscription(GameEvents.WAVE_COUNTDOWN_TICK, (...args: unknown[]) => {
      const seconds = args[0] as number;
      this.handlers.onWaveCountdownTick(seconds);
    });
    this.addSubscription(GameEvents.WAVE_READY, () => {
      this.handlers.onWaveReady();
    });
    this.addSubscription(GameEvents.GAME_OVER, () => {
      this.handlers.onGameOver();
    });
    this.addSubscription(GameEvents.DISH_MISSED, (...args: unknown[]) => {
      const payload = args[0] as DishMissedEventPayload;
      this.handlers.onDishMissed(payload);
    });
    this.addSubscription(GameEvents.HEALTH_PACK_UPGRADED, (...args: unknown[]) => {
      const payload = args[0] as HealthPackUpgradedPayload;
      this.handlers.onHealthPackUpgraded(payload);
    });
    this.addSubscription(GameEvents.HP_CHANGED, (...args: unknown[]) => {
      const payload = args[0] as HpChangedPayload;
      this.handlers.onHpChanged(payload);
    });
    this.addSubscription(GameEvents.HEALTH_PACK_PASSING, (...args: unknown[]) => {
      const payload = args[0] as HealthPackPassingPayload;
      this.handlers.onHealthPackPassing(payload);
    });
    this.addSubscription(GameEvents.HEALTH_PACK_COLLECTED, (...args: unknown[]) => {
      const payload = args[0] as HealthPackCollectedPayload;
      this.handlers.onHealthPackCollected(payload);
    });
    this.addSubscription(GameEvents.MONSTER_HP_CHANGED, () => {
      this.handlers.onMonsterHpChanged();
    });
    this.addSubscription(GameEvents.GAUGE_UPDATED, (...args: unknown[]) => {
      const payload = args[0] as GaugeUpdatedPayload;
      this.handlers.onGaugeUpdated(payload);
    });
    this.addSubscription(GameEvents.PLAYER_ATTACK, () => {
      this.handlers.onPlayerAttack();
    });
    this.addSubscription(GameEvents.MONSTER_DIED, () => {
      this.handlers.onMonsterDied();
    });
    this.addSubscription(GameEvents.FALLING_BOMB_DESTROYED, (...args: unknown[]) => {
      const payload = args[0] as FallingBombDestroyedPayload;
      this.handlers.onFallingBombDestroyed(payload);
    });

    this.isBound = true;
  }

  public unbind(): void {
    if (!this.isBound) {
      return;
    }

    const eventBus = EventBus.getInstance();
    this.subscriptions.forEach((subscription) => {
      eventBus.off(subscription.event, subscription.handler);
    });
    this.subscriptions.length = 0;
    this.isBound = false;
  }

  private addSubscription(event: string, handler: (...args: unknown[]) => void): void {
    EventBus.getInstance().on(event, handler);
    this.subscriptions.push({ event, handler });
  }
}
