import { CURSOR_HITBOX } from '../../../data/constants';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { SpatialIndex } from '../../../systems/SpatialIndex';
import type { EntityDamageService } from '../services/EntityDamageService';
import type { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import type { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import {
  ABILITY_IDS,
  CURSOR_SIZE_EFFECT_KEYS,
} from '../services/upgrades/AbilityEffectCatalog';

interface CursorAttackSystemDeps {
  world: World;
  spatialIndex: SpatialIndex;
  damageService: EntityDamageService;
  abilityRuntimeQuery: AbilityRuntimeQueryService;
  gameEnv: GameEnvironment;
}

export class CursorAttackSystem implements EntitySystem {
  readonly id = 'core:cursor_attack';
  enabled = true;

  private readonly world: World;
  private readonly spatialIndex: SpatialIndex;
  private readonly damageService: EntityDamageService;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
  private readonly gameEnv: GameEnvironment;

  constructor(deps: CursorAttackSystemDeps) {
    this.world = deps.world;
    this.spatialIndex = deps.spatialIndex;
    this.damageService = deps.damageService;
    this.abilityRuntimeQuery = deps.abilityRuntimeQuery;
    this.gameEnv = deps.gameEnv;
  }

  tick(_delta: number): void {
    const cursor = this.gameEnv.getCursorPosition();
    const cursorSizeBonus = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.CURSOR_SIZE,
      CURSOR_SIZE_EFFECT_KEYS.SIZE_BONUS,
    );
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    // 검색 반경: 커서 + 최대 엔티티 크기 (entities.json types 중 최대 size=60)
    const searchRadius = cursorRadius + 60;

    // 접시 충돌
    this.spatialIndex.dishGrid.forEachInRadius(cursor.x, cursor.y, searchRadius, (entityId) => {
      if (!this.world.isActive(entityId)) return;
      const dp = this.world.dishProps.get(entityId);
      const t = this.world.transform.get(entityId);
      if (!dp || !t) return;

      const dx = cursor.x - t.x;
      const dy = cursor.y - t.y;
      const distSq = dx * dx + dy * dy;
      const range = cursorRadius + dp.size;
      this.damageService.setInCursorRange(entityId, distSq <= range * range);
    });

    // 웨이브 폭탄도 커서 충돌 감지 (explode 인터랙션)
    this.spatialIndex.bombGrid.forEachInRadius(cursor.x, cursor.y, searchRadius, (bombId) => {
      if (!this.world.isActive(bombId)) return;
      // 낙하 폭탄은 FallingBombSystem이 자체 충돌 처리
      if (this.world.fallingBomb.has(bombId)) return;
      const lt = this.world.lifetime.get(bombId);
      if (lt && lt.elapsedTime < lt.spawnDuration) return;
      const bp = this.world.bombProps.get(bombId);
      const bt = this.world.transform.get(bombId);
      if (!bp || !bt) return;

      const dx = cursor.x - bt.x;
      const dy = cursor.y - bt.y;
      const distSq = dx * dx + dy * dy;
      const range = cursorRadius + bp.size;
      this.damageService.setInCursorRange(bombId, distSq <= range * range);
    });
  }
}
