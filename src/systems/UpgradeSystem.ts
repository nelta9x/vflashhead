import { Data } from '../data/DataManager';
import type { SystemUpgradeData } from '../data/types';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  maxStack: number;
  effect: (upgradeSystem: UpgradeSystem, stack: number) => void;
}

// 시스템 업그레이드를 Upgrade 인터페이스로 변환
function createSystemUpgrades(): Upgrade[] {
  return Data.upgrades.system.map((data: SystemUpgradeData) => ({
    id: data.id,
    name: data.name,
    description: data.description,
    rarity: data.rarity,
    maxStack: data.maxStack,
    effect: (us: UpgradeSystem) => {
      switch (data.effectType) {
        case 'cursorSizeBonus':
          us.addCursorSizeBonus(data.value);
          break;
        case 'electricShockLevel':
          us.addElectricShockLevel(data.value);
          break;
        case 'magnetLevel':
          us.addMagnetLevel(data.value);
          break;
        case 'missileLevel':
          us.addMissileLevel(data.value);
          break;
      }
    },
  }));
}

export const UPGRADES: Upgrade[] = createSystemUpgrades();

export class UpgradeSystem {
  private upgradeStacks: Map<string, number> = new Map();

  // 커서 크기
  private cursorSizeBonus: number = 0;

  // 전기 충격
  private electricShockLevel: number = 0;

  // 자기장
  private magnetLevel: number = 0;

  // 미사일
  private missileLevel: number = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.upgradeStacks.clear();

    // 커서 크기
    this.cursorSizeBonus = 0;

    // 전기 충격
    this.electricShockLevel = 0;

    // 자기장
    this.magnetLevel = 0;

    // 미사일
    this.missileLevel = 0;
  }

  update(_delta: number, _gameTime: number): void {
    // 웨이브 기반 업그레이드 시스템으로 변경됨
    // 시간 기반 업그레이드 트리거 제거
  }

  getRandomUpgrades(count: number): Upgrade[] {
    // 동적 희귀도 가중치 (업그레이드 횟수에 따라 변화)
    const rarityWeights = this.getRarityWeights();

    // 사용 가능한 업그레이드 필터링 (최대 스택 미달성)
    const availableUpgrades = UPGRADES.filter((upgrade) => {
      const currentStack = this.upgradeStacks.get(upgrade.id) || 0;
      return currentStack < upgrade.maxStack;
    });

    if (availableUpgrades.length === 0) {
      return UPGRADES.slice(0, count);
    }

    // 요청 개수가 가용 개수 이상이면 전체 반환 (셔플)
    if (count >= availableUpgrades.length) {
      return this.shuffleArray([...availableUpgrades]);
    }

    // 가중치 기반 선택
    const selected: Upgrade[] = [];
    const pool = [...availableUpgrades];

    while (selected.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, u) => sum + rarityWeights[u.rarity], 0);
      let random = Math.random() * totalWeight;

      let selectedIndex = pool.length - 1;

      for (let i = 0; i < pool.length; i++) {
        random -= rarityWeights[pool[i].rarity];
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }

      selected.push(pool[selectedIndex]);
      pool.splice(selectedIndex, 1);
    }

    return selected;
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private getRarityWeights(): Record<string, number> {
    const totalUpgrades = this.getTotalUpgradeCount();
    const weights = Data.getRarityWeights(totalUpgrades);
    return weights as unknown as Record<string, number>;
  }

  private getTotalUpgradeCount(): number {
    let total = 0;
    this.upgradeStacks.forEach((stack) => {
      total += stack;
    });
    return total;
  }

  applyUpgrade(upgrade: Upgrade): void {
    const currentStack = this.upgradeStacks.get(upgrade.id) || 0;

    if (currentStack >= upgrade.maxStack) {
      return;
    }

    // 스택 증가
    this.upgradeStacks.set(upgrade.id, currentStack + 1);

    // 효과 적용
    upgrade.effect(this, currentStack + 1);
  }

  // ========== 커서 크기 ==========
  addCursorSizeBonus(amount: number): void {
    this.cursorSizeBonus += amount;
  }

  getCursorSizeBonus(): number {
    return this.cursorSizeBonus;
  }

  // ========== 전기 충격 ==========
  addElectricShockLevel(level: number): void {
    this.electricShockLevel += level;
  }

  getElectricShockLevel(): number {
    return this.electricShockLevel;
  }

  getElectricShockRadius(): number {
    if (this.electricShockLevel <= 0) return 0;
    const upgradeData = Data.upgrades.system.find((u) => u.id === 'electric_shock');
    if (!upgradeData || !upgradeData.meta) return 100 + this.electricShockLevel * 15;
    
    const meta = upgradeData.meta;
    return (meta.baseRadius || 100) + this.electricShockLevel * (meta.radiusPerLevel || 15);
  }

  // ========== 자기장 ==========
  addMagnetLevel(level: number): void {
    this.magnetLevel += level;
  }

  getMagnetLevel(): number {
    return this.magnetLevel;
  }

  getMagnetRadius(): number {
    if (this.magnetLevel <= 0) return 0;
    return Data.magnet.baseRadius + this.magnetLevel * Data.magnet.radiusPerLevel;
  }

  // ========== 미사일 ==========
  addMissileLevel(level: number): void {
    this.missileLevel += level;
  }

  getMissileLevel(): number {
    return this.missileLevel;
  }

  // ========== 유틸리티 ==========
  getUpgradeStack(upgradeId: string): number {
    return this.upgradeStacks.get(upgradeId) || 0;
  }

  getAllUpgradeStacks(): Map<string, number> {
    return new Map(this.upgradeStacks);
  }

  // ========== 동적 설명 생성 ==========

  // 현재 레벨의 실제 효과를 설명하는 문자열 반환 (AbilityPanel용)
  getFormattedDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    if (!upgradeData || !upgradeData.descriptionTemplate) {
      return upgradeData?.description || '';
    }

    const stack = this.getUpgradeStack(upgradeId);
    if (stack <= 0) return upgradeData.description;

    const template = upgradeData.descriptionTemplate;

    switch (upgradeData.effectType) {
      case 'cursorSizeBonus': {
        const percentage = Math.round(upgradeData.value * stack * 100);
        return template.replace('{value}', percentage.toString());
      }

      case 'electricShockLevel': {
        const meta = upgradeData.meta!;
        const radius = meta.baseRadius! + stack * meta.radiusPerLevel!;
        const damage = (meta.baseDamage || 0) + stack * (meta.damagePerLevel || 1);
        return template
          .replace('{radius}', radius.toString())
          .replace('{damage}', damage.toString());
      }

      case 'magnetLevel': {
        const meta = upgradeData.meta!;
        const radius = meta.baseRadius! + stack * meta.radiusPerLevel!;
        return template.replace('{radius}', radius.toString());
      }

      case 'missileLevel': {
        const stack = this.getUpgradeStack(upgradeId);
        const count = 1 + stack;
        return template.replace('{count}', count.toString());
      }

      default:
        return upgradeData.description;
    }
  }

  // 선택 화면용 미리보기 설명 (현재 → 다음 레벨)
  getPreviewDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    if (!upgradeData) return '';

    const currentStack = this.getUpgradeStack(upgradeId);
    const nextStack = currentStack + 1;

    switch (upgradeData.effectType) {
      case 'cursorSizeBonus': {
        const currentPct = Math.round(upgradeData.value * currentStack * 100);
        const nextPct = Math.round(upgradeData.value * nextStack * 100);
        if (currentStack === 0) {
          return `커서 범위 +${nextPct}%`;
        }
        return `커서 범위 ${currentPct}% → ${nextPct}%`;
      }

      case 'electricShockLevel': {
        const meta = upgradeData.meta!;
        const curRadius = meta.baseRadius! + currentStack * meta.radiusPerLevel!;
        const nextRadius = meta.baseRadius! + nextStack * meta.radiusPerLevel!;
        const curDamage = (meta.baseDamage || 0) + currentStack * (meta.damagePerLevel || 1);
        const nextDamage = (meta.baseDamage || 0) + nextStack * (meta.damagePerLevel || 1);
        if (currentStack === 0) {
          return `반경 ${nextRadius}px, ${nextDamage} 데미지`;
        }
        return `반경 ${curRadius}→${nextRadius}px, 데미지 ${curDamage}→${nextDamage}`;
      }

      case 'magnetLevel': {
        const meta = upgradeData.meta!;
        const curRadius = meta.baseRadius! + currentStack * meta.radiusPerLevel!;
        const nextRadius = meta.baseRadius! + nextStack * meta.radiusPerLevel!;
        if (currentStack === 0) {
          return `끌어당김 반경 ${nextRadius}px`;
        }
        return `끌어당김 반경 ${curRadius}→${nextRadius}px`;
      }

      case 'missileLevel': {
        const curCount = 1 + currentStack;
        const nextCount = 1 + nextStack;
        if (currentStack === 0) {
          return `발사되는 미사일 수: ${nextCount}개`;
        }
        return `미사일 수 ${curCount} → ${nextCount}개`;
      }

      default:
        return upgradeData.description;
    }
  }
}
