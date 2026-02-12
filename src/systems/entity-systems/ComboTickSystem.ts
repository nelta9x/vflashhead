import type { ComboSystem } from '../ComboSystem';
import type { World } from '../../world';
import type { EntitySystem } from './EntitySystem';

export class ComboTickSystem implements EntitySystem {
  readonly id = 'core:combo';
  enabled = true;

  private readonly comboSystem: ComboSystem;
  private readonly world: World;

  constructor(comboSystem: ComboSystem, world: World) {
    this.comboSystem = comboSystem;
    this.world = world;
  }

  tick(delta: number): void {
    this.comboSystem.setWave(this.world.context.currentWave);
    this.comboSystem.update(delta);
  }
}
