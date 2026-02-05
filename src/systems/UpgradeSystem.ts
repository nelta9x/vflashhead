import { Data } from '../data/DataManager';
import type { SystemUpgradeData } from '../data/types';
import { EventBus, GameEvents } from '../utils/EventBus';

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
        case 'staticDischargeLevel':
          us.addStaticDischargeLevel(data.value);
          break;
        case 'magnetLevel':
          us.addMagnetLevel(data.value);
          break;
        case 'missileLevel':
          us.addMissileLevel(data.value);
          break;
        case 'fullHeal':
          EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
            hp: 999, // 특별한 값으로 전달하거나 HealthSystem에서 처리
            maxHp: 999,
            delta: 999,
            isFullHeal: true,
          });
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

  // 정전기 방출
  private staticDischargeLevel: number = 0;

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

    // 정전기 방출
    this.staticDischargeLevel = 0;

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
      // id가 'health_pack'이면 항상 표시 가능 (일회성 소모품)
      if (upgrade.id === 'health_pack') return true;

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
    this.upgradeStacks.forEach((stack, id) => {
      // 헬스팩은 스택 카운트에서 제외 (영구 강화가 아니므로)
      if (id !== 'health_pack') {
        total += stack;
      }
    });
    return total;
  }

  applyUpgrade(upgrade: Upgrade): void {
    const currentStack = this.upgradeStacks.get(upgrade.id) || 0;

    // 영구 업그레이드인 경우만 스택 체크
    if (upgrade.id !== 'health_pack' && currentStack >= upgrade.maxStack) {
      return;
    }

    // 스택 증가 (헬스팩은 로직상 무시되지만 기록은 남음)
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

  getCursorDamageBonus(): number {
    const stack = this.getUpgradeStack('cursor_size');
    if (stack <= 0) return 0;
    const upgradeData = Data.upgrades.system.find((u) => u.id === 'cursor_size');
    if (!upgradeData || !upgradeData.meta) return 0;
    const meta = upgradeData.meta;
    return (meta.baseDamage || 0) + stack * (meta.damagePerLevel || 0);
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

  getElectricShockDamage(): number {
    if (this.electricShockLevel <= 0) return 0;
    const upgradeData = Data.upgrades.system.find((u) => u.id === 'electric_shock');
    if (!upgradeData || !upgradeData.meta) return this.electricShockLevel;

    const meta = upgradeData.meta;
    return (meta.baseDamage || 0) + this.electricShockLevel * (meta.damagePerLevel || 1);
  }

  // ========== 정전기 방출 ==========
  addStaticDischargeLevel(level: number): void {
    this.staticDischargeLevel += level;
  }

  getStaticDischargeLevel(): number {
    return this.staticDischargeLevel;
  }

  getStaticDischargeChance(): number {
    if (this.staticDischargeLevel <= 0) return 0;
    const upgradeData = Data.upgrades.system.find((u) => u.id === 'static_discharge');
    if (!upgradeData || !upgradeData.meta) return 0.25;

    const meta = upgradeData.meta;
    return (meta.baseChance || 0.25) + this.staticDischargeLevel * (meta.chancePerLevel || 0.05);
  }

  getStaticDischargeDamage(): number {
    if (this.staticDischargeLevel <= 0) return 0;
    const upgradeData = Data.upgrades.system.find((u) => u.id === 'static_discharge');
    if (!upgradeData || !upgradeData.meta) return 3;

    const meta = upgradeData.meta;
    return (meta.baseDamage || 3) + this.staticDischargeLevel * (meta.damagePerLevel || 2);
  }

  getStaticDischargeRange(): number {
    if (this.staticDischargeLevel <= 0) return 0;
    const upgradeData = Data.upgrades.system.find((u) => u.id === 'static_discharge');
    if (!upgradeData || !upgradeData.meta) return 250;

    const meta = upgradeData.meta;
    return (meta.baseRange || 250) + this.staticDischargeLevel * (meta.rangePerLevel || 50);
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
        const meta = upgradeData.meta!;
        const damage = (meta.baseDamage || 0) + stack * (meta.damagePerLevel || 0);
        return template
          .replace('{value}', percentage.toString())
          .replace('{damage}', damage.toString());
      }

      case 'electricShockLevel': {
        const meta = upgradeData.meta!;
        const radius = meta.baseRadius! + stack * meta.radiusPerLevel!;
        const damage = (meta.baseDamage || 0) + stack * (meta.damagePerLevel || 1);
        return template
          .replace('{radius}', radius.toString())
          .replace('{damage}', damage.toString());
      }

      case 'staticDischargeLevel': {
        const meta = upgradeData.meta!;
        const chance = Math.round(
          ((meta.baseChance || 0.25) + stack * (meta.chancePerLevel || 0.05)) * 100
        );
        const damage = (meta.baseDamage || 3) + stack * (meta.damagePerLevel || 2);
        const radius = (meta.baseRange || 250) + stack * (meta.rangePerLevel || 50);
        return template
          .replace('{chance}', chance.toString())
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
        const meta = upgradeData.meta!;
        const currentDamage = (meta.baseDamage || 0) + currentStack * (meta.damagePerLevel || 0);
        const nextDamage = (meta.baseDamage || 0) + nextStack * (meta.damagePerLevel || 0);

        if (currentStack === 0) {
          return `커서 범위 +${nextPct}%, 데미지 +${nextDamage}`;
        }
        return `범위 ${currentPct}%→${nextPct}%, 데미지 ${currentDamage}→${nextDamage}`;
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

      case 'staticDischargeLevel': {
        const meta = upgradeData.meta!;
        const curChance = Math.round(
          ((meta.baseChance || 0.25) + currentStack * (meta.chancePerLevel || 0.05)) * 100
        );
        const nextChance = Math.round(
          ((meta.baseChance || 0.25) + nextStack * (meta.chancePerLevel || 0.05)) * 100
        );
        const nextDamage = (meta.baseDamage || 3) + nextStack * (meta.damagePerLevel || 2);
        const curRadius = (meta.baseRange || 250) + currentStack * (meta.rangePerLevel || 50);
        const nextRadius = (meta.baseRange || 250) + nextStack * (meta.rangePerLevel || 50);

        if (currentStack === 0) {
          return `${nextChance}% 확률로 ${nextRadius}px 내 적 타격 (${nextDamage} 데미지)`;
        }
        return `확률 ${curChance}%→${nextChance}%, 사거리 ${curRadius}→${nextRadius}px`;
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
