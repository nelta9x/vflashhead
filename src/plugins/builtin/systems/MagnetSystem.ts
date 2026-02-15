import Phaser from 'phaser';
import { Data } from '../../../data/DataManager';
import { MAGNET } from '../../../data/constants';
import { C_DishTag, C_DishProps, C_Transform } from '../../../world';
import type { EntitySystem } from '../../../systems/entity-systems/EntitySystem';
import type { World } from '../../../world';
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
  private readonly damageService: EntityDamageService;
  private readonly abilityProgression: AbilityProgressionService;
  private readonly abilityRuntimeQuery: AbilityRuntimeQueryService;
  private readonly particleManager: ParticleManager;
  private readonly gameEnv: GameEnvironment;

  constructor(deps: MagnetSystemDeps) {
    this.world = deps.world;
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
      for (const [entityId] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
        this.damageService.setBeingPulled(entityId, false);
      }
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

    for (const [entityId, , , t] of this.world.query(C_DishTag, C_DishProps, C_Transform)) {
      this.damageService.setBeingPulled(entityId, false);

      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, t.x, t.y);
      if (dist > magnetRadius || dist < MAGNET.MIN_PULL_DISTANCE) continue;

      this.damageService.setBeingPulled(entityId, true);
      const pullStrength = 1 - dist / magnetRadius;
      const pullAmount = magnetForce * pullStrength * deltaSeconds;
      const angle = Phaser.Math.Angle.Between(t.x, t.y, cursor.x, cursor.y);
      const newX = t.x + Math.cos(angle) * pullAmount;
      const newY = t.y + Math.sin(angle) * pullAmount;

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
    }
  }
}
