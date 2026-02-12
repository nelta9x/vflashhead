import type { Entity } from '../entities/Entity';
import { ObjectPool } from '../utils/ObjectPool';

/**
 * EntityPoolManager: archetype 별 Entity ObjectPool 관리.
 * GameScene에서 dishPool 직접 관리를 대체한다.
 */
export class EntityPoolManager {
  private readonly pools = new Map<string, ObjectPool<Entity>>();

  registerPool(archetype: string, factory: () => Entity, initial: number, max: number): void {
    this.pools.set(archetype, new ObjectPool<Entity>(factory, initial, max));
  }

  acquire(archetype: string): Entity | null {
    const pool = this.pools.get(archetype);
    if (!pool) return null;
    return pool.acquire();
  }

  release(archetype: string, entity: Entity): void {
    const pool = this.pools.get(archetype);
    pool?.release(entity);
  }

  getPool(archetype: string): ObjectPool<Entity> | undefined {
    return this.pools.get(archetype);
  }

  clearAll(): void {
    this.pools.forEach((pool) => pool.clear());
  }

  clear(archetype: string): void {
    this.pools.get(archetype)?.clear();
  }
}
