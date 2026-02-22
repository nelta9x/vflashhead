/**
 * Purpose: 2D 균등 그리드 기반 공간 인덱스. 엔티티 근접 쿼리를 O(n) → O(k)로 최적화.
 * Boundary: 정확한 거리 판정은 하지 않음 — 셀 기반 후보만 반환. 정밀 거리 체크는 호출자 책임.
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: number[][];

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    const totalCells = this.cols * this.rows;
    this.cells = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this.cells[i] = [];
    }
  }

  /** 모든 셀을 비움 (배열 객체는 재사용). */
  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
  }

  /** 엔티티를 좌표 기준 셀에 삽입. */
  insert(entityId: number, x: number, y: number): void {
    const col = Math.max(0, Math.min(this.cols - 1, (x / this.cellSize) | 0));
    const row = Math.max(0, Math.min(this.rows - 1, (y / this.cellSize) | 0));
    this.cells[row * this.cols + col].push(entityId);
  }

  /**
   * (cx, cy) 중심으로 radius 이내 셀에 포함된 모든 엔티티 ID를 콜백으로 전달.
   * 호출자가 정밀 거리 체크를 추가로 수행해야 함.
   */
  forEachInRadius(
    cx: number,
    cy: number,
    radius: number,
    callback: (entityId: number) => void,
  ): void {
    const minCol = Math.max(0, ((cx - radius) / this.cellSize) | 0);
    const maxCol = Math.min(this.cols - 1, ((cx + radius) / this.cellSize) | 0);
    const minRow = Math.max(0, ((cy - radius) / this.cellSize) | 0);
    const maxRow = Math.min(this.rows - 1, ((cy + radius) / this.cellSize) | 0);

    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * this.cols;
      for (let c = minCol; c <= maxCol; c++) {
        const cell = this.cells[rowOffset + c];
        for (let i = 0; i < cell.length; i++) {
          callback(cell[i]);
        }
      }
    }
  }

  /** 그리드에 삽입된 전체 엔티티를 순회. */
  forEachEntity(callback: (entityId: number) => void): void {
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      for (let j = 0; j < cell.length; j++) {
        callback(cell[j]);
      }
    }
  }
}
