import Phaser from 'phaser';
import type { ServicePlugin } from '../../types/SystemPlugin';
import type { ServiceEntry } from '../../ServiceRegistry';
import { DEPTHS, SPAWN_AREA } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import { Entity } from '../../../entities/Entity';
import { ModSystemRegistry } from '../../ModSystemRegistry';
import { LaserRenderer } from '../entities/LaserRenderer';
import { PlayerAttackRenderer } from '../abilities/PlayerAttackRenderer';
import { StarBackground } from '../../../effects/StarBackground';
import { PlayerCursorInputController } from '../../../systems/PlayerCursorInputController';
import { InGameUpgradeUI } from '../../../ui/InGameUpgradeUI';
import { HUD } from '../../../ui/HUD';
import { WaveCountdownUI } from '../../../ui/WaveCountdownUI';
import { WaveSystem } from '../../../systems/WaveSystem';
import { BossCombatCoordinator } from '../../../scenes/game/BossCombatCoordinator';
import { DishLifecycleController } from '../../../scenes/game/DishLifecycleController';
import { PlayerAttackController } from '../../../scenes/game/PlayerAttackController';
import { GameEnvironment } from '../../../scenes/game/GameEnvironment';
import { EntityPoolManager } from '../../../systems/EntityPoolManager';
import { MonsterSystem } from '../../../systems/MonsterSystem';
import { FeedbackSystem } from '../../../systems/FeedbackSystem';
import { SoundSystem } from '../../../systems/SoundSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { ComboSystem } from '../../../systems/ComboSystem';
import { DamageText } from '../../../ui/DamageText';
import { ParticleManager } from '../../../effects/ParticleManager';
import { EntityDamageService } from '../../../systems/EntityDamageService';
import { EntityQueryService } from '../../../systems/EntityQueryService';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import { World, C_DishTag, C_Identity } from '../../../world';

function calculateMaxSpawnedDishRadius(): number {
  const waveDishTypes = Data.waves.waves.flatMap((wave) => wave.dishTypes.map((dish) => dish.type));
  const feverDishTypes = Data.waves.fever.dishTypes.map((dish) => dish.type);
  const uniqueDishTypes = new Set<string>([...waveDishTypes, ...feverDishTypes]);

  let maxRadius = 0;
  uniqueDishTypes.forEach((type) => {
    const dishData = Data.getDishData(type);
    if (dishData) {
      maxRadius = Math.max(maxRadius, dishData.size);
    }
  });

  return maxRadius;
}

export class GameModulesPlugin implements ServicePlugin {
  readonly id = 'core:game_modules';
  readonly services: ServiceEntry[] = [
    // 1. ModSystemRegistry (no deps)
    ModSystemRegistry,

    // 2. LaserRenderer
    {
      key: LaserRenderer,
      factory: (r) => new LaserRenderer(r.get(Phaser.Scene)),
    },

    // 3. PlayerCursorInputController
    {
      key: PlayerCursorInputController,
      factory: () => {
        const inputConfig = Data.gameConfig.player.input;
        return new PlayerCursorInputController({
          pointerPriorityMs: inputConfig.pointerPriorityMs,
          keyboardAxisRampUpMs: inputConfig.keyboardAxisRampUpMs,
          keyboardEaseInPower: inputConfig.keyboardEaseInPower,
          keyboardMinAxisSpeed: inputConfig.keyboardMinAxisSpeed,
        });
      },
    },

    // 4. InGameUpgradeUI
    {
      key: InGameUpgradeUI,
      factory: (r) =>
        new InGameUpgradeUI(
          r.get(Phaser.Scene),
          r.get(UpgradeSystem),
          r.get(ParticleManager),
        ),
    },

    // 5. StarBackground
    {
      key: StarBackground,
      factory: (r) => {
        const bg = new StarBackground(r.get(Phaser.Scene), Data.gameConfig.stars);
        bg.setDepth(DEPTHS.starBackground);
        return bg;
      },
    },

    // 6. PlayerAttackRenderer
    {
      key: PlayerAttackRenderer,
      factory: (r) => new PlayerAttackRenderer(r.get(Phaser.Scene)),
    },

    // 7. GameEnvironment (before BCC — BCC depends on it)
    {
      key: GameEnvironment,
      factory: (r) => new GameEnvironment(r.get(World)),
    },

    // 8. WaveSystem (lazy deps: InGameUpgradeUI, HUD, BossCombatCoordinator, DishLifecycleController)
    {
      key: WaveSystem,
      factory: (r) => {
        const maxSpawnedDishRadius = calculateMaxSpawnedDishRadius();
        return new WaveSystem(
          r.get(Phaser.Scene),
          () => r.get(EntityPoolManager).getPool('dish')!,
          () => {
            const inGameUpgradeUI = r.get(InGameUpgradeUI);
            const baseMaxY = inGameUpgradeUI.isVisible()
              ? inGameUpgradeUI.getBlockedYArea()
              : SPAWN_AREA.maxY;
            const hud = r.get(HUD);
            const dockHoverArea = hud.getDockHoverArea();
            if (!dockHoverArea) return baseMaxY;
            const dockSafeMaxY = Math.floor(dockHoverArea.y - maxSpawnedDishRadius);
            return Math.max(SPAWN_AREA.minY, Math.min(baseMaxY, dockSafeMaxY));
          },
          () => {
            if (!r.has(BossCombatCoordinator)) return [];
            return r.get(BossCombatCoordinator).getVisibleBossSnapshots();
          },
          {
            spawnDish: (type, x, y, mult) =>
              r.get(DishLifecycleController).spawnDish(type, x, y, mult),
          },
          (type: string) => {
            const world = r.get(World);
            let count = 0;
            for (const [, , identity] of world.query(C_DishTag, C_Identity)) {
              if (identity.entityType === type) count++;
            }
            return count;
          },
        );
      },
    },

    // 9. HUD
    {
      key: HUD,
      factory: (r) =>
        new HUD(
          r.get(Phaser.Scene),
          r.get(WaveSystem),
          r.get(HealthSystem),
          r.get(UpgradeSystem),
        ),
    },

    // 10. WaveCountdownUI
    {
      key: WaveCountdownUI,
      factory: (r) => new WaveCountdownUI(r.get(Phaser.Scene)),
    },

    // 11. BossCombatCoordinator + EntityQueryService.setBossProvider()
    {
      key: BossCombatCoordinator,
      factory: (r) => {
        const bcc = new BossCombatCoordinator({
          scene: r.get(Phaser.Scene),
          waveSystem: r.get(WaveSystem),
          monsterSystem: r.get(MonsterSystem),
          feedbackSystem: r.get(FeedbackSystem),
          soundSystem: r.get(SoundSystem),
          damageText: r.get(DamageText),
          laserRenderer: r.get(LaserRenderer),
          healthSystem: r.get(HealthSystem),
          upgradeSystem: r.get(UpgradeSystem),
          damageService: r.get(EntityDamageService),
          world: r.get(World),
          statusEffectManager: r.get(StatusEffectManager),
          gameEnv: r.get(GameEnvironment),
        });
        r.get(EntityQueryService).setBossProvider(() => {
          const bosses: Entity[] = [];
          bcc.forEachBoss((boss) => bosses.push(boss));
          return bosses;
        });
        return bcc;
      },
    },

    // 12. DishLifecycleController
    {
      key: DishLifecycleController,
      factory: (r) => {
        const dishes = r.get(Phaser.Scene).add.group();
        return new DishLifecycleController({
          world: r.get(World),
          dishPool: r.get(EntityPoolManager).getPool('dish')!,
          dishes,
          healthSystem: r.get(HealthSystem),
          comboSystem: r.get(ComboSystem),
          upgradeSystem: r.get(UpgradeSystem),
          feedbackSystem: r.get(FeedbackSystem),
          soundSystem: r.get(SoundSystem),
          damageText: r.get(DamageText),
          damageService: r.get(EntityDamageService),
          statusEffectManager: r.get(StatusEffectManager),
          getPlayerAttackRenderer: () => r.get(PlayerAttackRenderer),
          gameEnv: r.get(GameEnvironment),
          bcc: r.get(BossCombatCoordinator),
        });
      },
    },

    // 13. PlayerAttackController
    {
      key: PlayerAttackController,
      factory: (r) =>
        new PlayerAttackController({
          scene: r.get(Phaser.Scene),
          world: r.get(World),
          damageService: r.get(EntityDamageService),
          upgradeSystem: r.get(UpgradeSystem),
          healthSystem: r.get(HealthSystem),
          waveSystem: r.get(WaveSystem),
          monsterSystem: r.get(MonsterSystem),
          feedbackSystem: r.get(FeedbackSystem),
          soundSystem: r.get(SoundSystem),
          particleManager: r.get(ParticleManager),
          gameEnv: r.get(GameEnvironment),
          getPlayerAttackRenderer: () => r.get(PlayerAttackRenderer),
          bossGateway: r.get(BossCombatCoordinator),
        }),
    },
  ];
}
