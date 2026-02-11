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
    store.set('e1', { value: 10, name: 'test' });
    expect(store.get('e1')).toEqual({ value: 10, name: 'test' });
  });

  it('존재하지 않는 엔티티에 대해 undefined를 반환해야 함', () => {
    expect(store.get('missing')).toBeUndefined();
  });

  it('getRequired는 존재하는 컴포넌트를 반환해야 함', () => {
    store.set('e1', { value: 42, name: 'req' });
    expect(store.getRequired('e1')).toEqual({ value: 42, name: 'req' });
  });

  it('getRequired는 존재하지 않는 엔티티에 대해 에러를 던져야 함', () => {
    expect(() => store.getRequired('missing')).toThrowError(
      'ComponentStore: missing component for entity "missing"'
    );
  });

  it('has는 컴포넌트 존재 여부를 확인해야 함', () => {
    store.set('e1', { value: 1, name: 'a' });
    expect(store.has('e1')).toBe(true);
    expect(store.has('e2')).toBe(false);
  });

  it('delete로 컴포넌트를 제거할 수 있어야 함', () => {
    store.set('e1', { value: 1, name: 'a' });
    store.delete('e1');
    expect(store.has('e1')).toBe(false);
    expect(store.get('e1')).toBeUndefined();
  });

  it('delete는 존재하지 않는 엔티티에 대해 안전해야 함', () => {
    expect(() => store.delete('missing')).not.toThrow();
  });

  it('forEach는 모든 엔티티를 순회해야 함', () => {
    store.set('e1', { value: 1, name: 'a' });
    store.set('e2', { value: 2, name: 'b' });

    const collected: Array<{ id: string; component: TestComponent }> = [];
    store.forEach((id, component) => {
      collected.push({ id, component });
    });

    expect(collected).toHaveLength(2);
    expect(collected.map((c) => c.id).sort()).toEqual(['e1', 'e2']);
  });

  it('entities는 저장된 엔티티 ID 목록을 반환해야 함', () => {
    store.set('a', { value: 1, name: 'a' });
    store.set('b', { value: 2, name: 'b' });
    expect(store.entities().sort()).toEqual(['a', 'b']);
  });

  it('size는 저장된 컴포넌트 수를 반환해야 함', () => {
    expect(store.size()).toBe(0);
    store.set('e1', { value: 1, name: 'a' });
    expect(store.size()).toBe(1);
    store.set('e2', { value: 2, name: 'b' });
    expect(store.size()).toBe(2);
  });

  it('clear는 모든 데이터를 제거해야 함', () => {
    store.set('e1', { value: 1, name: 'a' });
    store.set('e2', { value: 2, name: 'b' });
    store.clear();
    expect(store.size()).toBe(0);
    expect(store.has('e1')).toBe(false);
  });

  it('set은 기존 컴포넌트를 덮어써야 함', () => {
    store.set('e1', { value: 1, name: 'old' });
    store.set('e1', { value: 99, name: 'new' });
    expect(store.get('e1')).toEqual({ value: 99, name: 'new' });
    expect(store.size()).toBe(1);
  });

  it('get은 뮤터블 참조를 반환해야 함 (인플레이스 수정 가능)', () => {
    store.set('e1', { value: 1, name: 'mutable' });
    const ref = store.get('e1')!;
    ref.value = 999;
    expect(store.get('e1')!.value).toBe(999);
  });
});
