export interface Poolable {
  reset(): void;
  active: boolean;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private activeObjects: Set<T> = new Set();
  /** Stack of free object indices for O(1) acquire/release (LIFO) */
  private freeStack: number[] = [];
  /** Reverse lookup: object -> pool index, for O(1) release */
  private objectToIndex: Map<T, number> = new Map();
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number = 10, maxSize: number = 100) {
    this.factory = factory;
    this.maxSize = maxSize;

    // 초기 오브젝트 생성
    for (let i = 0; i < initialSize; i++) {
      const obj = this.factory();
      obj.active = false;
      this.pool.push(obj);
      this.objectToIndex.set(obj, i);
      this.freeStack.push(i);
    }
  }

  acquire(): T | null {
    let obj: T | undefined;

    // O(1) free object lookup via free stack (LIFO — recently released first)
    if (this.freeStack.length > 0) {
      const idx = this.freeStack.pop()!;
      obj = this.pool[idx];
    }

    // 풀에 없으면 새로 생성 (최대 크기 미만일 때)
    if (!obj && this.pool.length < this.maxSize) {
      obj = this.factory();
      const newIndex = this.pool.length;
      this.pool.push(obj);
      this.objectToIndex.set(obj, newIndex);
      // No need to add to freeStack — we're using it immediately
    }

    if (obj) {
      obj.active = true;
      obj.reset();
      this.activeObjects.add(obj);
      return obj;
    }

    return null;
  }

  release(obj: T): void {
    if (this.activeObjects.has(obj)) {
      obj.active = false;
      this.activeObjects.delete(obj);
      const idx = this.objectToIndex.get(obj);
      if (idx !== undefined) {
        this.freeStack.push(idx);
      }
    }
  }

  releaseAll(): void {
    for (const obj of this.activeObjects) {
      obj.active = false;
      const idx = this.objectToIndex.get(obj);
      if (idx !== undefined) {
        this.freeStack.push(idx);
      }
    }
    this.activeObjects.clear();
  }

  getActiveObjects(): readonly T[] {
    return Array.from(this.activeObjects);
  }

  getActiveCount(): number {
    return this.activeObjects.size;
  }

  getTotalCount(): number {
    return this.pool.length;
  }

  getAvailableCount(): number {
    return this.pool.length - this.activeObjects.size;
  }

  forEach(callback: (obj: T) => void): void {
    for (const obj of this.activeObjects) {
      callback(obj);
    }
  }

  clear(): void {
    this.releaseAll();
    this.pool = [];
    this.freeStack.length = 0;
    this.objectToIndex.clear();
  }
}
