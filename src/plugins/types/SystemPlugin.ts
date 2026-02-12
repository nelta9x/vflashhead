import type Phaser from 'phaser';
import type { UpgradeSystemCore } from './AbilityPlugin';
import type { EntityDamageService } from '../../systems/EntityDamageService';
import type { EntityPoolManager } from '../../systems/EntityPoolManager';
import type { StatusEffectManager } from '../../systems/StatusEffectManager';
import type { EntitySystem } from '../../systems/entity-systems/EntitySystem';
import type { World } from '../../world';

/** SystemPlugin에 제공되는 컨텍스트 */
export interface SystemPluginContext {
  scene: Phaser.Scene;
  world: World;
  entityPoolManager: EntityPoolManager;
  upgradeSystem: UpgradeSystemCore;
  entityDamageService: EntityDamageService;
  statusEffectManager: StatusEffectManager;
}

/**
 * SystemPlugin: EntitySystem 생성을 플러그인화하는 인터페이스.
 * createSystems()는 EntitySystem 배열을 반환하여 pipeline에 등록한다.
 */
export interface SystemPlugin {
  readonly id: string;
  createSystems(ctx: SystemPluginContext): EntitySystem[];
  destroy?(): void;
}
