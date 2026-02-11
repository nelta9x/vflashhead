import type { Entity } from '../entities/Entity';
import type { EntitySystem } from './entity-systems/EntitySystem';

/**
 * EntitySystemPipeline: data-driven 엔티티 시스템 실행 파이프라인.
 * game-config.json의 entityPipeline 배열이 실행 순서의 SSOT.
 */
export class EntitySystemPipeline {
  private readonly configOrder: readonly string[];
  private readonly systems = new Map<string, EntitySystem>();
  private sorted: EntitySystem[] = [];
  private dirty = true;

  constructor(configOrder: readonly string[]) {
    this.configOrder = configOrder;
  }

  register(system: EntitySystem): void {
    this.systems.set(system.id, system);
    this.dirty = true;
  }

  unregister(id: string): void {
    this.systems.delete(id);
    this.dirty = true;
  }

  setEnabled(id: string, enabled: boolean): void {
    const system = this.systems.get(id);
    if (system) {
      system.enabled = enabled;
    }
  }

  run(entities: Entity[], delta: number): void {
    if (this.dirty) {
      this.rebuild();
    }
    for (const system of this.sorted) {
      if (system.enabled) {
        system.tick(entities, delta);
      }
    }
  }

  /** config 순서에 있지만 미등록인 시스템 ID 목록 */
  getMissingSystems(): string[] {
    return this.configOrder.filter((id) => !this.systems.has(id));
  }

  /** 등록되었지만 config 순서에 없는 시스템 ID 목록 */
  getUnmappedSystems(): string[] {
    const configSet = new Set(this.configOrder);
    return Array.from(this.systems.keys()).filter((id) => !configSet.has(id));
  }

  getRegisteredIds(): string[] {
    return Array.from(this.systems.keys());
  }

  clear(): void {
    this.systems.clear();
    this.sorted = [];
    this.dirty = false;
  }

  private rebuild(): void {
    const configSet = new Set(this.configOrder);
    const ordered: EntitySystem[] = [];

    // config 순서대로 배치
    for (const id of this.configOrder) {
      const system = this.systems.get(id);
      if (system) {
        ordered.push(system);
      }
    }

    // config에 없는 등록 시스템은 끝에 추가
    for (const [id, system] of this.systems) {
      if (!configSet.has(id)) {
        ordered.push(system);
      }
    }

    this.sorted = ordered;
    this.dirty = false;
  }
}
