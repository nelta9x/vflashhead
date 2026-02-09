export class UpgradeStateStore {
  private readonly upgradeStacks: Map<string, number> = new Map();

  public reset(): void {
    this.upgradeStacks.clear();
  }

  public getStack(upgradeId: string): number {
    return this.upgradeStacks.get(upgradeId) || 0;
  }

  public setStack(upgradeId: string, stack: number): void {
    this.upgradeStacks.set(upgradeId, stack);
  }

  public incrementStack(upgradeId: string): number {
    const nextStack = this.getStack(upgradeId) + 1;
    this.upgradeStacks.set(upgradeId, nextStack);
    return nextStack;
  }

  public getAllStacks(): Map<string, number> {
    return new Map(this.upgradeStacks);
  }

  public getTotalStackCount(excludedIds: string[] = []): number {
    const excluded = new Set(excludedIds);
    let total = 0;

    this.upgradeStacks.forEach((stack, id) => {
      if (!excluded.has(id)) {
        total += stack;
      }
    });

    return total;
  }
}
