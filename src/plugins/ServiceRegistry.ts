/** Non-class token for type-safe DI of callbacks, primitives, etc. */
export class ServiceToken<T> {
  readonly _phantom?: T;
  constructor(public readonly description: string) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClassKey<T> = abstract new (...args: any[]) => T;

export class ServiceRegistry {
  private services = new Map<unknown, unknown>();

  /** Register a value directly. */
  set<T>(key: ClassKey<T>, value: T): void;
  set<T>(key: ServiceToken<T>, value: T): void;
  set(key: unknown, value: unknown): void {
    this.services.set(key, value);
  }

  /** Type-safe lookup. Throws if not found. */
  get<T>(key: ClassKey<T>): T;
  get<T>(key: ServiceToken<T>): T;
  get(key: unknown): unknown {
    const svc = this.services.get(key);
    if (svc === undefined) {
      const name =
        typeof key === 'function'
          ? (key as { name: string }).name
          : (key as ServiceToken<unknown>).description;
      throw new Error(`Service not found: ${name}`);
    }
    return svc;
  }

  has(key: unknown): boolean {
    return this.services.has(key);
  }

  /**
   * Auto-instantiate a class and register it.
   * Reads `Class.inject` to resolve constructor dependencies from the registry.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerClass<T>(cls: new (...args: any[]) => T): T {
    const inject: unknown[] = (cls as InjectableClass).inject ?? [];
    const deps = inject.map((dep) => this.get(dep as ClassKey<unknown>));
    const instance = new cls(...deps);
    this.set(cls as ClassKey<T>, instance);
    return instance;
  }

  /**
   * Resolve an array of ServiceEntry declarations in order.
   */
  resolveEntries(entries: ServiceEntry[]): void {
    for (const entry of entries) {
      if (typeof entry === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.registerClass(entry as new (...args: any[]) => unknown);
      } else {
        this.set(entry.key as ClassKey<unknown>, entry.factory(this));
      }
    }
  }
}

interface InjectableClass {
  inject?: unknown[];
}

/** A class constructor (auto-inject via static inject) or a custom factory. */
export type ServiceEntry =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | (new (...args: any[]) => unknown)
  | { key: unknown; factory: (r: ServiceRegistry) => unknown };
