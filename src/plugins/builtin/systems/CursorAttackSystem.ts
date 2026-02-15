import Phaser from 'phaser';
import { CURSOR_HITBOX } from '../../../data/constants';
import { C_DishTag, C_DishProps, C_Transform, C_BombProps } from '../../../world';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { EntityDamageService } from '../services/EntityDamageService';
import type { UpgradeSystem } from '../services/UpgradeSystem';
import type { GameEnvironment } from '../../../scenes/game/GameEnvironment';

interface CursorAttackSystemDeps {
  world: World;
  damageService: EntityDamageService;
  upgradeSystem: UpgradeSystem;
  gameEnv: GameEnvironment;
}

export class CursorAttackSystem implements EntitySystem {
  readonly id = 'core:cursor_attack';
  enabled = true;

  private readonly world: World;
  private readonly damageService: EntityDamageService;
  private readonly upgradeSystem: UpgradeSystem;
  private readonly gameEnv: GameEnvironment;

  constructor(deps: CursorAttackSystemDeps) {
    this.world = deps.world;
    this.damageService = deps.damageService;
    this.upgradeSystem = deps.upgradeSystem;
    this.gameEnv = deps.gameEnv;
  }

  tick(_delta: number): void {
    const cursor = this.gameEnv.getCursorPosition();
    const cursorSizeBonus = this.upgradeSystem.getCursorSizeBonus();
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);

    for (const [entityId, , dp, t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      const size = dp.size;
      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, t.x, t.y);
      this.damageService.setInCursorRange(entityId, dist <= cursorRadius + size);
    }

    // 웨이브 폭탄도 커서 충돌 감지 (explode 인터랙션)
    for (const [bombId, bp, bt] of this.world.query(C_BombProps, C_Transform)) {
      // 낙하 폭탄은 FallingBombSystem이 자체 충돌 처리
      if (this.world.fallingBomb.has(bombId)) continue;
      const lt = this.world.lifetime.get(bombId);
      if (lt && lt.elapsedTime < lt.spawnDuration) continue;
      const size = bp.size;
      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, bt.x, bt.y);
      this.damageService.setInCursorRange(bombId, dist <= cursorRadius + size);
    }
  }
}
