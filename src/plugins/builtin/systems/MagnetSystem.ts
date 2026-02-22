import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { GAME_WIDTH, GAME_HEIGHT, MAGNET } from '../../../data/constants';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
import type { SpatialIndex } from '../../../systems/SpatialIndex';
import type { EntityDamageService } from '../services/EntityDamageService';
import type { ParticleManager } from '../../../effects/ParticleManager';
import type { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import type { AbilityProgressionService } from '../services/abilities/AbilityProgressionService';
import type { AbilityRuntimeQueryService } from '../services/abilities/AbilityRuntimeQueryService';
import {
  ABILITY_IDS,
  MAGNET_EFFECT_KEYS,
} from '../services/upgrades/AbilityEffectCatalog';

interface MagnetSystemDeps {
  world: World;
  spatialIndex: SpatialIndex;
  damageService: EntityDamageService;
  abilityProgression: AbilityProgressionService;
  abilityRuntimeQuery: AbilityRuntimeQueryService;
  particleManager: ParticleManager;
  gameEnv: GameEnvironment;
}

export class MagnetSystem implements EntitySystem {
  readonly id = 'core:magnet';
  enabled = true;

  private readonly world: World;
  private readonly spatialIndex: SpatialIndex;
  private readonly damageService: EntityDamageService;
  private readonly abilityProgression: AbilityProgressionService;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
  private readonly particleManager: ParticleManager;
  private readonly gameEnv: GameEnvironment;

  constructor(deps: MagnetSystemDeps) {
    this.world = deps.world;
    this.spatialIndex = deps.spatialIndex;
    this.damageService = deps.damageService;
    this.abilityProgression = deps.abilityProgression;
    this.abilityRuntimeQuery = deps.abilityRuntimeQuery;
    this.particleManager = deps.particleManager;
    this.gameEnv = deps.gameEnv;
  }

  tick(delta: number): void {
    const magnetLevel = this.abilityProgression.getAbilityLevel(ABILITY_IDS.MAGNET);
    const cursor = this.gameEnv.getCursorPosition();

    if (magnetLevel <= 0) {
      this.spatialIndex.dishGrid.forEachEntity((entityId) => {
        this.damageService.setBeingPulled(entityId, false);
      });
      return;
    }

    const magnetRadius = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.MAGNET,
      MAGNET_EFFECT_KEYS.RADIUS,
    );
    const magnetForce = this.abilityRuntimeQuery.getEffectValueOrThrow(
      ABILITY_IDS.MAGNET,
      MAGNET_EFFECT_KEYS.FORCE,
    );
    const deltaSeconds = delta / 1000;

    // 범위 밖 접시도 isBeingPulled=false로 리셋해야 하므로 전체 순회 1회
    this.spatialIndex.dishGrid.forEachEntity((entityId) => {
      this.damageService.setBeingPulled(entityId, false);
    });

    // 범위 내 접시만 pull 적용
    this.spatialIndex.dishGrid.forEachInRadius(cursor.x, cursor.y, magnetRadius, (entityId) => {
      if (!this.world.isActive(entityId)) return;
      const t = this.world.transform.get(entityId);
      if (!t) return;

      const dx = cursor.x - t.x;
      const dy = cursor.y - t.y;
      const distSq = dx * dx + dy * dy;
      const magnetRadiusSq = magnetRadius * magnetRadius;
      if (distSq > magnetRadiusSq) return;

      const dist = Math.sqrt(distSq);
      if (dist < MAGNET.MIN_PULL_DISTANCE) return;

      this.damageService.setBeingPulled(entityId, true);
      const pullStrength = 1 - dist / magnetRadius;
      const pullAmount = magnetForce * pullStrength * deltaSeconds;
      const angle = Phaser.Math.Angle.Between(t.x, t.y, cursor.x, cursor.y);
      const newX = Phaser.Math.Clamp(t.x + Math.cos(angle) * pullAmount, 0, GAME_WIDTH);
      const newY = Phaser.Math.Clamp(t.y + Math.sin(angle) * pullAmount, 0, GAME_HEIGHT);

      t.x = newX;
      t.y = newY;
      const node = this.world.phaserNode.get(entityId);
      if (node) {
        node.container.x = newX;
        node.container.y = newY;
      }

      if (Math.random() < Data.gameConfig.magnet.particleSpawnChance) {
        this.particleManager.createMagnetPullEffect(newX, newY, cursor.x, cursor.y);
      }
    });
  }
}
