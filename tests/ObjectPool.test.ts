import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectPool, Poolable } from '../src/utils/ObjectPool';

class TestObject implements Poolable {
  active: boolean = false;
  value: number = 0;

  reset(): void {
    this.value = 0;
  }
}

describe('ObjectPool', () => {
  let pool: ObjectPool<TestObject>;

  beforeEach(() => {
    pool = new ObjectPool(() => new TestObject(), 5, 10);
  });

  describe('초기화', () => {
    it('초기 크기만큼 오브젝트가 생성되어야 함', () => {
      expect(pool.getTotalCount()).toBe(5);
    });

    it('초기에는 활성 오브젝트가 없어야 함', () => {
      expect(pool.getActiveCount()).toBe(0);
    });

    it('사용 가능한 오브젝트 수가 초기 크기와 같아야 함', () => {
      expect(pool.getAvailableCount()).toBe(5);
    });
  });

  describe('acquire', () => {
    it('오브젝트를 획득할 수 있어야 함', () => {
      const obj = pool.acquire();
      expect(obj).not.toBeNull();
      expect(obj?.active).toBe(true);
    });

    it('획득 시 reset이 호출되어야 함', () => {
      const obj = pool.acquire();
      if (obj) {
        obj.value = 100;
      }
      pool.release(obj!);
      const obj2 = pool.acquire();
      expect(obj2?.value).toBe(0);
    });

    it('활성 오브젝트 수가 증가해야 함', () => {
      pool.acquire();
      pool.acquire();
      expect(pool.getActiveCount()).toBe(2);
    });

    it('최대 크기까지 새 오브젝트가 생성되어야 함', () => {
      for (let i = 0; i < 10; i++) {
        pool.acquire();
      }
      expect(pool.getTotalCount()).toBe(10);
    });

    it('최대 크기 초과 시 null 반환', () => {
      for (let i = 0; i < 10; i++) {
        pool.acquire();
      }
      const obj = pool.acquire();
      expect(obj).toBeNull();
    });
  });

  describe('release', () => {
    it('오브젝트를 반환할 수 있어야 함', () => {
      const obj = pool.acquire();
      expect(pool.getActiveCount()).toBe(1);
      pool.release(obj!);
      expect(pool.getActiveCount()).toBe(0);
    });

    it('반환된 오브젝트는 비활성화되어야 함', () => {
      const obj = pool.acquire();
      pool.release(obj!);
      expect(obj?.active).toBe(false);
    });

    it('반환된 오브젝트는 다시 획득 가능해야 함', () => {
      const obj1 = pool.acquire();
      pool.release(obj1!);
      const obj2 = pool.acquire();
      expect(obj2).toBe(obj1);
    });
  });

  describe('releaseAll', () => {
    it('모든 활성 오브젝트를 반환해야 함', () => {
      for (let i = 0; i < 5; i++) {
        pool.acquire();
      }
      expect(pool.getActiveCount()).toBe(5);
      pool.releaseAll();
      expect(pool.getActiveCount()).toBe(0);
    });
  });

  describe('getActiveObjects', () => {
    it('활성 오브젝트 배열을 반환해야 함', () => {
      const obj1 = pool.acquire();
      const obj2 = pool.acquire();
      const activeObjects = pool.getActiveObjects();
      expect(activeObjects).toContain(obj1);
      expect(activeObjects).toContain(obj2);
      expect(activeObjects.length).toBe(2);
    });
  });

  describe('forEach', () => {
    it('모든 활성 오브젝트에 대해 콜백 실행', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();

      let count = 0;
      pool.forEach((obj) => {
        obj.value = 10;
        count++;
      });

      expect(count).toBe(3);
      pool.forEach((obj) => {
        expect(obj.value).toBe(10);
      });
    });
  });

  describe('clear', () => {
    it('풀을 초기화해야 함', () => {
      pool.acquire();
      pool.acquire();
      pool.clear();
      expect(pool.getTotalCount()).toBe(0);
      expect(pool.getActiveCount()).toBe(0);
    });
  });
});
