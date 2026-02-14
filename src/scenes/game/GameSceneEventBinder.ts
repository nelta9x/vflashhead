import { COLORS, GAME_HEIGHT, GAME_WIDTH, INITIAL_HP } from '../../data/constants';
import { Data } from '../../data/DataManager';
import { FeedbackSystem } from '../../systems/FeedbackSystem';
import { HealthSystem } from '../../systems/HealthSystem';
import { MonsterSystem } from '../../systems/MonsterSystem';
import { UpgradeSystem } from '../../systems/UpgradeSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { DamageText } from '../../ui/DamageText';
import { HUD } from '../../ui/HUD';
import { WaveCountdownUI } from '../../ui/WaveCountdownUI';
import { World } from '../../world';
import { EventBus, GameEvents } from '../../utils/EventBus';
import type { ServiceRegistry } from '../../plugins/ServiceRegistry';

interface BlackHoleConsumedPayload {
  x: number;
  y: number;
}

interface GaugeUpdatedPayload {
  current: number;
  max: number;
  ratio: number;
}

/** Scene-state callbacks that only GameScene can provide. */
export interface SceneLifecycleCallbacks {
  onWaveCompleted: (waveNumber: number) => void;
  onUpgradeSelected: () => void;
  onGameOver: () => void;
}

interface EventSubscription {
  event: string;
  handler: (...args: unknown[]) => void;
}

export class GameSceneEventBinder {
  private readonly services: ServiceRegistry;
  private readonly scene: SceneLifecycleCallbacks;
  private readonly subscriptions: EventSubscription[] = [];
  private isBound = false;

  constructor(services: ServiceRegistry, scene: SceneLifecycleCallbacks) {
    this.services = services;
    this.scene = scene;
  }

  public bind(): void {
    if (this.isBound) return;
    const s = this.services;

    // ── Core system delegations (no content knowledge) ──
    this.on(GameEvents.COMBO_MILESTONE, (milestone: number) => {
      s.get(FeedbackSystem).onComboMilestone(milestone);
    });
    this.on(GameEvents.WAVE_COUNTDOWN_TICK, (seconds: number) => {
      s.get(WaveCountdownUI).updateCountdown(seconds);
    });
    this.on(GameEvents.WAVE_READY, () => {
      s.get(WaveCountdownUI).hide();
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
    this.on(GameEvents.HP_CHANGED, (data: { hp: number; maxHp: number; delta: number; isFullHeal?: boolean }) => {
      if (data.isFullHeal) {
        s.get(HealthSystem).reset();
        s.get(FeedbackSystem).onHealthPackCollected(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        return;
      }
      if (data.delta < 0) {
        s.get(HUD).showHpLoss();
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
    this.on(GameEvents.GAUGE_UPDATED, (payload: GaugeUpdatedPayload) => {
      const world = s.get(World);
      const pr = world.playerRender.get(world.context.playerId);
      if (pr) pr.gaugeRatio = payload.ratio;
    });
    this.on(GameEvents.BLACK_HOLE_CONSUMED, (payload: BlackHoleConsumedPayload) => {
      s.get(DamageText).showText(payload.x, payload.y - 40, Data.t('feedback.black_hole_consumed'), COLORS.CYAN);
    });
    // ── Scene lifecycle (only GameScene can handle) ──
    this.on(GameEvents.WAVE_COMPLETED, (waveNumber: number) => {
      this.scene.onWaveCompleted(waveNumber);
    });
    this.on(GameEvents.UPGRADE_SELECTED, () => {
      this.scene.onUpgradeSelected();
    });
    this.on(GameEvents.GAME_OVER, () => {
      this.scene.onGameOver();
    });

    this.isBound = true;
  }

  public unbind(): void {
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
