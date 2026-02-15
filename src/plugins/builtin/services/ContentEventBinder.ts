import { COLORS, INITIAL_HP, GAME_WIDTH, GAME_HEIGHT } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import { ComboSystem } from './ComboSystem';
import { FeedbackSystem } from './FeedbackSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { MonsterSystem } from './MonsterSystem';
import { UpgradeSystem } from './UpgradeSystem';
import { WaveSystem } from './WaveSystem';
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

    // ── Content feedback events ──
    this.on(GameEvents.COMBO_MILESTONE, (milestone: number) => {
      s.get(FeedbackSystem).onComboMilestone(milestone);
    });
    this.on(GameEvents.MONSTER_DIED, () => {
      if (s.get(MonsterSystem).areAllDead()) {
        s.get(WaveSystem).forceCompleteWave();
      }
    });
    this.on(GameEvents.HEALTH_PACK_UPGRADED, (payload: { hpBonus: number }) => {
      const hs = s.get(HealthSystem);
      hs.setMaxHp(INITIAL_HP + payload.hpBonus);
      hs.heal(payload.hpBonus);
    });
    this.on(GameEvents.CURSE_HP_PENALTY, (payload: { hpPenalty: number }) => {
      const hs = s.get(HealthSystem);
      const newMax = Math.max(1, hs.getMaxHp() - payload.hpPenalty);
      hs.setMaxHp(newMax);
      if (hs.getHp() > newMax) {
        hs.takeDamage(hs.getHp() - newMax);
      }
    });
    this.on(GameEvents.HP_CHANGED, (data: { delta: number; isFullHeal?: boolean }) => {
      if (data.isFullHeal) {
        s.get(FeedbackSystem).onHealthPackCollected(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        return;
      }
      if (data.delta < 0) {
        s.get(FeedbackSystem).onHpLost();
      }
    });
    this.on(GameEvents.HEALTH_PACK_PASSING, (payload: { x: number; y: number }) => {
      s.get(FeedbackSystem).onHealthPackPassing(payload.x, payload.y);
    });
    this.on(GameEvents.HEALTH_PACK_COLLECTED, (payload: { x: number; y: number }) => {
      if (!s.get(UpgradeSystem).isHealDisabled()) {
        s.get(HealthSystem).heal(1);
      }
      s.get(FeedbackSystem).onHealthPackCollected(payload.x, payload.y);
    });
    this.on(GameEvents.BLACK_HOLE_CONSUMED, (payload: { x: number; y: number }) => {
      s.get(DamageText).showText(payload.x, payload.y - 40, Data.t('feedback.black_hole_consumed'), COLORS.CYAN);
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
