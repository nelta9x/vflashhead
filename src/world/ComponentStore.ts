/**
 * ComponentStore<T>: Map<string, T> 기반 제네릭 컴포넌트 저장소.
 * 각 엔티티의 컴포넌트 데이터를 entityId 키로 관리한다.
 */
export class ComponentStore<T> {
  private readonly data = new Map<string, T>();

  set(entityId: string, component: T): void {
    this.data.set(entityId, component);
  }

  get(entityId: string): T | undefined {
    return this.data.get(entityId);
  }

  /** 컴포넌트가 없으면 에러를 던진다. 반드시 존재해야 하는 경우 사용. */
  getRequired(entityId: string): T {
    const component = this.data.get(entityId);
    if (component === undefined) {
      throw new Error(`ComponentStore: missing component for entity "${entityId}"`);
    }
    return component;
  }

  has(entityId: string): boolean {
    return this.data.has(entityId);
  }

  delete(entityId: string): void {
    this.data.delete(entityId);
  }

  forEach(callback: (entityId: string, component: T) => void): void {
    this.data.forEach((component, entityId) => {
      callback(entityId, component);
    });
  }

  entities(): string[] {
    return Array.from(this.data.keys());
  }

  size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }
}
