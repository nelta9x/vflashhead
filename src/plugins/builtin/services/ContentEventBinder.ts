import { COLORS } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import { ComboSystem } from '../../../systems/ComboSystem';
import { FeedbackSystem } from '../../../systems/FeedbackSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { DamageText } from '../../../ui/DamageText';
import { World } from '../../../world';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import { BossCombatCoordinator } from './BossCombatCoordinator';
import { DishLifecycleController } from './DishLifecycleController';
import { PlayerAttackController } from './PlayerAttackController';
import type { ServiceRegistry } from '../../ServiceRegistry';
import type {
  DishDestroyedEventPayload,
  DishDamagedEventPayload,
  DishMissedEventPayload,
  BombDestroyedEventPayload,
  BombMissedEventPayload,
} from './ContentContracts';

interface EventSubscription {
  event: string;
  handler: (...args: unknown[]) => void;
}

export class ContentEventBinder {
  private readonly services: ServiceRegistry;
  private readonly subscriptions: EventSubscription[] = [];
  private isBound = false;

  constructor(services: ServiceRegistry) {
    this.services = services;
  }

  bind(): void {
    if (this.isBound) return;
    const s = this.services;

    // Boss events
    this.on(GameEvents.WAVE_STARTED, (_waveNumber: number) => {
      s.get(BossCombatCoordinator).syncBossesForCurrentWave();
    });
    this.on(GameEvents.WAVE_TRANSITION, () => {
      s.get(BossCombatCoordinator).clearForWaveTransition();
      s.get(DishLifecycleController).clearAll();
    });

    // Dish events
    this.on(GameEvents.DISH_DESTROYED, (payload: DishDestroyedEventPayload) => {
      s.get(DishLifecycleController).onDishDestroyed(payload);
    });
    this.on(GameEvents.DISH_DAMAGED, (payload: DishDamagedEventPayload) => {
      s.get(DishLifecycleController).onDishDamaged(payload);
    });
    this.on(GameEvents.DISH_MISSED, (payload: DishMissedEventPayload) => {
      s.get(DishLifecycleController).onDishMissed(payload);
    });

    // Bomb events
    this.on(GameEvents.BOMB_DESTROYED, (payload: BombDestroyedEventPayload) => {
      if (!payload.byAbility) {
        s.get(HealthSystem).takeDamage(payload.playerDamage);
        if (payload.resetCombo) {
          s.get(ComboSystem).reset();
        }
      } else {
        s.get(DamageText).showText(payload.x, payload.y - 40, Data.t('feedback.bomb_removed'), COLORS.CYAN);
      }
      s.get(FeedbackSystem).onBombExploded(payload.x, payload.y, !!payload.byAbility);
      // 웨이브 폭탄만 풀 해제 (낙하 폭탄은 FallingBombSystem이 자체 해제)
      if (!s.get(World).fallingBomb.has(payload.entityId)) {
        s.get(DishLifecycleController).removeEntityFromPool(payload.entityId);
      }
    });
    this.on(GameEvents.BOMB_MISSED, (payload: BombMissedEventPayload) => {
      // 웨이브 폭탄만 풀 해제 (낙하 폭탄은 자체 해제)
      if (!s.get(World).fallingBomb.has(payload.entityId)) {
        s.get(DishLifecycleController).removeEntityFromPool(payload.entityId);
      }
    });

    // Player attack
    this.on(GameEvents.PLAYER_ATTACK, () => {
      s.get(PlayerAttackController).performPlayerAttack();
    });

    this.isBound = true;
  }

  destroy(): void {
    if (!this.isBound) return;
    const eventBus = EventBus.getInstance();
    for (const sub of this.subscriptions) {
      eventBus.off(sub.event, sub.handler);
    }
    this.subscriptions.length = 0;
    this.isBound = false;
  }

  private on<T>(event: string, handler: (payload: T) => void): void {
    const wrapped = (...args: unknown[]) => handler(args[0] as T);
    EventBus.getInstance().on(event, wrapped);
    this.subscriptions.push({ event, handler: wrapped });
  }
}
