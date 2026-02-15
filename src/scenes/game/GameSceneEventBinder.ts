import { HealthSystem } from '../../systems/HealthSystem';
import { HUD } from '../../ui/HUD';
import { WaveCountdownUI } from '../../ui/WaveCountdownUI';
import { World } from '../../world';
import { EventBus, GameEvents } from '../../utils/EventBus';
import type { ServiceRegistry } from '../../plugins/ServiceRegistry';

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

    // ── Core UI delegations (no content knowledge) ──
    this.on(GameEvents.WAVE_COUNTDOWN_TICK, (seconds: number) => {
      s.get(WaveCountdownUI).updateCountdown(seconds);
    });
    this.on(GameEvents.WAVE_READY, () => {
      s.get(WaveCountdownUI).hide();
    });
    this.on(GameEvents.HP_CHANGED, (data: { hp: number; maxHp: number; delta: number; isFullHeal?: boolean }) => {
      if (data.isFullHeal) {
        s.get(HealthSystem).reset();
        return;
      }
      if (data.delta < 0) {
        s.get(HUD).showHpLoss();
      }
    });
    this.on(GameEvents.GAUGE_UPDATED, (payload: GaugeUpdatedPayload) => {
      const world = s.get(World);
      const pr = world.playerRender.get(world.context.playerId);
      if (pr) pr.gaugeRatio = payload.ratio;
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
