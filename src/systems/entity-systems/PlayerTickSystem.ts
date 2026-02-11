import { CURSOR_HITBOX } from '../../data/constants';
import type { Entity } from '../../entities/Entity';
import type { World } from '../../world';
import type { StatusEffectManager } from '../StatusEffectManager';
import type { CursorRenderer } from '../../effects/CursorRenderer';
import type { CursorTrail } from '../../effects/CursorTrail';
import type { UpgradeSystem } from '../UpgradeSystem';
import type { HealthSystem } from '../HealthSystem';
import type { EntitySystem } from './EntitySystem';
import { computeCursorSmoothing } from '../../utils/cursorSmoothing';

/**
 * PlayerTickSystem: Player entity의 위치 보간, 커서 트레일, 커서 렌더링을 처리.
 * EntitySystemPipeline에 등록되어 ECS 파이프라인 내에서 실행된다.
 */
export class PlayerTickSystem implements EntitySystem {
  readonly id = 'core:player';
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly sem: StatusEffectManager,
    private readonly cursorRenderer: CursorRenderer,
    private readonly cursorTrail: CursorTrail,
    private readonly upgradeSystem: UpgradeSystem,
    private readonly healthSystem: HealthSystem,
  ) {}

  tick(_entities: Entity[], delta: number): void {
    const playerId = 'player';
    if (!this.world.isActive(playerId)) return;

    this.syncStatusEffects(playerId);
    this.updatePosition(playerId, delta);

    const cursorRadius = this.computeCursorRadius();
    this.updateVisual(playerId, delta, cursorRadius);
    this.renderCursor(playerId, cursorRadius);
  }

  /** Pause/upgrade용: smoothing 없이 visual + render만 수행 */
  renderOnly(delta: number): void {
    if (!this.world.isActive('player')) return;

    const cursorRadius = this.computeCursorRadius();
    this.updateVisual('player', delta, cursorRadius);
    this.renderCursor('player', cursorRadius);
  }

  private syncStatusEffects(id: string): void {
    const statusCache = this.world.statusCache.get(id);
    if (!statusCache) return;

    statusCache.isFrozen = this.sem.hasEffect(id, 'freeze') || this.sem.hasEffect(id, 'slow');
    const slowEffects = this.sem.getEffectsByType(id, 'slow');
    statusCache.slowFactor = slowEffects.length > 0
      ? Math.min(...slowEffects.map(e => (e.data['factor'] as number) ?? 1.0))
      : 1.0;
  }

  private updatePosition(id: string, delta: number): void {
    const transform = this.world.transform.get(id);
    const input = this.world.playerInput.get(id);
    if (!transform || !input) return;

    const result = computeCursorSmoothing(
      transform.x, transform.y,
      input.targetX, input.targetY,
      delta,
      input.smoothingConfig
    );
    transform.x = result.x;
    transform.y = result.y;
  }

  private computeCursorRadius(): number {
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    return CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
  }

  private updateVisual(id: string, delta: number, cursorRadius: number): void {
    const transform = this.world.transform.get(id);
    if (!transform) return;

    this.cursorTrail.update(delta, cursorRadius, transform.x, transform.y);
  }

  private renderCursor(id: string, cursorRadius: number): void {
    const transform = this.world.transform.get(id);
    const playerRender = this.world.playerRender.get(id);
    if (!transform || !playerRender) return;

    const magnetLevel = this.upgradeSystem.getMagnetLevel();
    const magnetRadius = this.upgradeSystem.getMagnetRadius();
    const electricLevel = this.upgradeSystem.getElectricShockLevel();
    const currentHp = this.healthSystem.getHp();
    const maxHp = this.healthSystem.getMaxHp();

    this.cursorRenderer.renderAttackIndicator(
      transform.x,
      transform.y,
      cursorRadius,
      playerRender.gaugeRatio,
      magnetRadius,
      magnetLevel,
      electricLevel,
      playerRender.gameTime,
      currentHp,
      maxHp
    );
  }
}
