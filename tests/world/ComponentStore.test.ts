import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentStore } from '../../src/world/ComponentStore';

interface TestComponent {
  value: number;
  name: string;
}

describe('ComponentStore', () => {
  let store: ComponentStore<TestComponent>;

  beforeEach(() => {
    store = new ComponentStore<TestComponent>();
  });

  it('set/get으로 컴포넌트를 저장하고 읽을 수 있어야 함', () => {
    store.set(1, { value: 10, name: 'test' });
    expect(store.get(1)).toEqual({ value: 10, name: 'test' });
  });

  it('존재하지 않는 엔티티에 대해 undefined를 반환해야 함', () => {
    expect(store.get(999)).toBeUndefined();
  });

  it('getRequired는 존재하는 컴포넌트를 반환해야 함', () => {
    store.set(1, { value: 42, name: 'req' });
    expect(store.getRequired(1)).toEqual({ value: 42, name: 'req' });
  });

  it('getRequired는 존재하지 않는 엔티티에 대해 에러를 던져야 함', () => {
    expect(() => store.getRequired(999)).toThrowError(
      'ComponentStore: missing component for entity "999"'
    );
  });

  it('has는 컴포넌트 존재 여부를 확인해야 함', () => {
    store.set(1, { value: 1, name: 'a' });
    expect(store.has(1)).toBe(true);
    expect(store.has(2)).toBe(false);
  });

  it('delete로 컴포넌트를 제거할 수 있어야 함', () => {
    store.set(1, { value: 1, name: 'a' });
    store.delete(1);
    expect(store.has(1)).toBe(false);
    expect(store.get(1)).toBeUndefined();
  });

  it('delete는 존재하지 않는 엔티티에 대해 안전해야 함', () => {
    expect(() => store.delete(999)).not.toThrow();
  });

  it('forEach는 모든 엔티티를 순회해야 함', () => {
    store.set(1, { value: 1, name: 'a' });
    store.set(2, { value: 2, name: 'b' });

    const collected: Array<{ id: number; component: TestComponent }> = [];
    store.forEach((id, component) => {
      collected.push({ id, component });
    });

    expect(collected).toHaveLength(2);
    expect(collected.map((c) => c.id).sort()).toEqual([1, 2]);
  });

  it('entities는 저장된 엔티티 ID 목록을 반환해야 함', () => {
    store.set(1, { value: 1, name: 'a' });
    store.set(2, { value: 2, name: 'b' });
    expect(store.entities().sort()).toEqual([1, 2]);
  });

  it('size는 저장된 컴포넌트 수를 반환해야 함', () => {
    expect(store.size()).toBe(0);
    store.set(1, { value: 1, name: 'a' });
    expect(store.size()).toBe(1);
    store.set(2, { value: 2, name: 'b' });
    expect(store.size()).toBe(2);
  });

  it('clear는 모든 데이터를 제거해야 함', () => {
    store.set(1, { value: 1, name: 'a' });
    store.set(2, { value: 2, name: 'b' });
    store.clear();
    expect(store.size()).toBe(0);
    expect(store.has(1)).toBe(false);
  });

  it('set은 기존 컴포넌트를 덮어써야 함', () => {
    store.set(1, { value: 1, name: 'old' });
    store.set(1, { value: 99, name: 'new' });
    expect(store.get(1)).toEqual({ value: 99, name: 'new' });
    expect(store.size()).toBe(1);
  });

  it('entries는 [entityId, component] 쌍을 순회해야 함', () => {
    store.set(1, { value: 1, name: 'a' });
    store.set(2, { value: 2, name: 'b' });

    const collected = [...store.entries()];
    expect(collected).toHaveLength(2);
    const ids = collected.map(([id]) => id).sort();
    expect(ids).toEqual([1, 2]);
  });

  it('get은 뮤터블 참조를 반환해야 함 (인플레이스 수정 가능)', () => {
    store.set(1, { value: 1, name: 'mutable' });
    const ref = store.get(1)!;
    ref.value = 999;
    expect(store.get(1)!.value).toBe(999);
  });
});
