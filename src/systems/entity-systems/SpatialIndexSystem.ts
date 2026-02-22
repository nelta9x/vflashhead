import type { EntitySystem } from './EntitySystem';
import type { World } from '../../world';
import type { SpatialIndex } from '../SpatialIndex';

/**
 * Purpose: 매 프레임 SpatialIndex(dish/bomb 공간 그리드)를 재구축.
 * Boundary: 그리드 구축만 담당. 쿼리는 다운스트림 시스템이 SpatialIndex를 직접 사용.
 */
export class SpatialIndexSystem implements EntitySystem {
  readonly id = 'core:spatial_index';
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly spatialIndex: SpatialIndex,
  ) {}

  tick(_delta: number): void {
    this.spatialIndex.rebuild(this.world);
  }
}
