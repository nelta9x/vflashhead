import { CURSOR_HITBOX } from '../../data/constants';
import type { World } from '../../world';
import type { EntityId } from '../../world/EntityId';
import type { CursorRenderer } from '../../plugins/builtin/entities/CursorRenderer';
import type { CursorTrail } from '../../plugins/builtin/entities/CursorTrail';
import type { UpgradeSystem } from '../UpgradeSystem';
import type { HealthSystem } from '../HealthSystem';
import type { EntitySystem } from './EntitySystem';
import { computeCursorSmoothing } from '../../utils/cursorSmoothing';

/**
 * PlayerTickSystem: Player entity의 위치 보간, 커서 트레일, 커서 렌더링을 처리.
 * EntitySystemPipeline에 등록되어 ECS 파이프라인 내에서 실행된다.
 * 상태효과(freeze/slow)는 EntityStatusSystem이 전역 처리하므로 여기서는 생략.
 */
export class PlayerTickSystem implements EntitySystem {
  readonly id = 'core:player';
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly cursorRenderer: CursorRenderer,
    private readonly cursorTrail: CursorTrail,
    private readonly upgradeSystem: UpgradeSystem,
    private readonly healthSystem: HealthSystem,
  ) {}

  tick(delta: number): void {
    const playerId = this.world.context.playerId;
    if (!this.world.isActive(playerId)) return;

    this.updatePosition(playerId, delta);

    const cursorRadius = this.computeCursorRadius();
    this.updateVisual(playerId, delta, cursorRadius);
    this.renderCursor(playerId, cursorRadius);
  }

  /** Pause/upgrade용: smoothing 없이 visual + render만 수행 */
  renderTick(delta: number): void {
    const playerId = this.world.context.playerId;
    if (!this.world.isActive(playerId)) return;

    const cursorRadius = this.computeCursorRadius();
    this.updateVisual(playerId, delta, cursorRadius);
    this.renderCursor(playerId, cursorRadius);
  }

  private updatePosition(id: EntityId, delta: number): void {
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

  private updateVisual(id: EntityId, delta: number, cursorRadius: number): void {
    const transform = this.world.transform.get(id);
    if (!transform) return;

    this.cursorTrail.update(delta, cursorRadius, transform.x, transform.y);
  }

  private renderCursor(id: EntityId, cursorRadius: number): void {
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
