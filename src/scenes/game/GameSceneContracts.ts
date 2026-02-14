export interface CursorSnapshot {
  x: number;
  y: number;
}

export interface DishSpawnDelegate {
  spawnDish(type: string, x: number, y: number, speedMultiplier: number): void;
}
