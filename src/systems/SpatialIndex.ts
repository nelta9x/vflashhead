import { SpatialGrid } from '../utils/SpatialGrid';
import type { World } from '../world';

const DEFAULT_CELL_SIZE = 128;

/**
 * Purpose: Dish/Bomb 엔티티를 공간 그리드에 인덱싱하여 근접 쿼리를 최적화하는 공유 서비스.
 * Boundary: 매 프레임 SpatialIndexSystem이 rebuild()를 호출해야 유효. 프레임 중간 위치 변경은 반영하지 않음.
 */
export class SpatialIndex {
  readonly dishGrid: SpatialGrid;
  readonly bombGrid: SpatialGrid;

  constructor(width: number, height: number, cellSize: number = DEFAULT_CELL_SIZE) {
    this.dishGrid = new SpatialGrid(width, height, cellSize);
    this.bombGrid = new SpatialGrid(width, height, cellSize);
  }

  /**
   * World 스토어에서 활성 엔티티를 읽어 두 그리드를 재구축.
   * 매 프레임 entity_movement 이후에 호출되어야 한다.
   */
  rebuild(world: World): void {
    this.dishGrid.clear();
    this.bombGrid.clear();

    world.dishTag.forEach((entityId) => {
      if (!world.isActive(entityId)) return;
      const t = world.transform.get(entityId);
      if (t) this.dishGrid.insert(entityId, t.x, t.y);
    });

    world.bombProps.forEach((entityId) => {
      if (!world.isActive(entityId)) return;
      const t = world.transform.get(entityId);
      if (t) this.bombGrid.insert(entityId, t.x, t.y);
    });
  }

  clear(): void {
    this.dishGrid.clear();
    this.bombGrid.clear();
  }
}
