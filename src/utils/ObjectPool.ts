export interface Poolable {
  reset(): void;
  active: boolean;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private activeObjects: Set<T> = new Set();
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
    }
  }

  acquire(): T | null {
    let obj: T | undefined;

    // 비활성 오브젝트 찾기
    obj = this.pool.find((o) => !o.active);

    // 풀에 없으면 새로 생성 (최대 크기 미만일 때)
    if (!obj && this.pool.length < this.maxSize) {
      obj = this.factory();
      this.pool.push(obj);
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
    }
  }

  releaseAll(): void {
    for (const obj of this.activeObjects) {
      obj.active = false;
    }
    this.activeObjects.clear();
  }

  getActiveObjects(): T[] {
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
  }
}
