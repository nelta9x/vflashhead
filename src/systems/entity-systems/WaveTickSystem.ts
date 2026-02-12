import type { WaveSystem } from '../WaveSystem';
import type { World } from '../../world';
import type { EntitySystem } from './EntitySystem';

export class WaveTickSystem implements EntitySystem {
  readonly id = 'core:wave';
  enabled = true;

  private readonly waveSystem: WaveSystem;
  private readonly world: World;

  constructor(waveSystem: WaveSystem, world: World) {
    this.waveSystem = waveSystem;
    this.world = world;
  }

  tick(delta: number): void {
    this.waveSystem.update(delta);
    this.world.context.currentWave = this.waveSystem.getCurrentWave();
  }
}
