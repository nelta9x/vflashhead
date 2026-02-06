import { Data } from '../data/DataManager';
import type {
  SystemUpgradeData,
  CursorSizeLevelData,
  ElectricShockLevelData,
  StaticDischargeLevelData,
  MagnetLevelData,
  MissileLevelData,
} from '../data/types';
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
    maxStack: data.levels ? data.levels.length : (data.maxStack ?? 999),
    effect: (_us: UpgradeSystem) => {
      // levels 기반 어빌리티: 스택은 applyUpgrade에서 자동 증가하므로 no-op
      // fullHeal만 이벤트 발생
      if (data.effectType === 'fullHeal') {
        EventBus.getInstance().emit(GameEvents.HP_CHANGED, {
          hp: 999,
          maxHp: 999,
          delta: 999,
          isFullHeal: true,
        });
      }
    },
  }));
}

export const UPGRADES: Upgrade[] = createSystemUpgrades();

export class UpgradeSystem {
  private upgradeStacks: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.upgradeStacks.clear();
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

  // ========== 레벨 데이터 헬퍼 ==========
  private getLevelData<T>(upgradeId: string): T | null {
    const level = this.getUpgradeStack(upgradeId);
    if (level <= 0) return null;
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    if (!upgradeData?.levels) return null;
    const index = Math.min(level, upgradeData.levels.length) - 1;
    return upgradeData.levels[index] as T;
  }

  // ========== 커서 크기 ==========
  getCursorSizeBonus(): number {
    return this.getLevelData<CursorSizeLevelData>('cursor_size')?.sizeBonus ?? 0;
  }

  getCursorDamageBonus(): number {
    return this.getLevelData<CursorSizeLevelData>('cursor_size')?.damage ?? 0;
  }

  // ========== 전기 충격 ==========
  getElectricShockLevel(): number {
    return this.getUpgradeStack('electric_shock');
  }

  getElectricShockRadius(): number {
    return this.getLevelData<ElectricShockLevelData>('electric_shock')?.radius ?? 0;
  }

  getElectricShockDamage(): number {
    return this.getLevelData<ElectricShockLevelData>('electric_shock')?.damage ?? 0;
  }

  // ========== 정전기 방출 ==========
  getStaticDischargeLevel(): number {
    return this.getUpgradeStack('static_discharge');
  }

  getStaticDischargeChance(): number {
    return this.getLevelData<StaticDischargeLevelData>('static_discharge')?.chance ?? 0;
  }

  getStaticDischargeDamage(): number {
    return this.getLevelData<StaticDischargeLevelData>('static_discharge')?.damage ?? 0;
  }

  getStaticDischargeRange(): number {
    return this.getLevelData<StaticDischargeLevelData>('static_discharge')?.range ?? 0;
  }

  // ========== 자기장 ==========
  getMagnetLevel(): number {
    return this.getUpgradeStack('magnet');
  }

  getMagnetRadius(): number {
    return this.getLevelData<MagnetLevelData>('magnet')?.radius ?? 0;
  }

  getMagnetForce(): number {
    return this.getLevelData<MagnetLevelData>('magnet')?.force ?? 0;
  }

  // ========== 미사일 ==========
  getMissileLevel(): number {
    return this.getUpgradeStack('missile');
  }

  getMissileDamage(): number {
    return this.getLevelData<MissileLevelData>('missile')?.damage ?? 0;
  }

  getMissileCount(): number {
    return this.getLevelData<MissileLevelData>('missile')?.count ?? 0;
  }

  // ========== 유틸리티 ==========
  getUpgradeStack(upgradeId: string): number {
    return this.upgradeStacks.get(upgradeId) || 0;
  }

  getAllUpgradeStacks(): Map<string, number> {
    return new Map(this.upgradeStacks);
  }

  // ========== 동적 설명 생성 ==========

  // 현재 레벨의 실제 효과를 설명하는 문자열 반환
  getFormattedDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    if (!upgradeData || !upgradeData.descriptionTemplate) {
      return upgradeData?.description || '';
    }

    const stack = this.getUpgradeStack(upgradeId);
    if (stack <= 0) return upgradeData.description;

    if (!upgradeData.levels) return upgradeData.description;
    const index = Math.min(stack, upgradeData.levels.length) - 1;
    const levelData = upgradeData.levels[index];

    let result = upgradeData.descriptionTemplate;
    for (const [key, value] of Object.entries(levelData)) {
      const displayValue = key === 'chance' || key === 'sizeBonus'
        ? Math.round((value as number) * 100)
        : value;
      result = result.replace(`{${key}}`, String(displayValue));
    }
    return result;
  }

  // 선택 화면용 미리보기 설명 (현재 → 다음 레벨)
  getPreviewDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    if (!upgradeData) return '';

    // fullHeal 등 levels가 없는 업그레이드
    if (!upgradeData.levels) return upgradeData.description;

    const currentStack = this.getUpgradeStack(upgradeId);
    const nextStack = currentStack + 1;

    if (nextStack > upgradeData.levels.length) return upgradeData.description;

    const nextData = upgradeData.levels[nextStack - 1];

    if (currentStack === 0) {
      // 처음 획득: 다음 레벨 수치만 표시
      return this.formatLevelPreview(upgradeData.effectType, null, nextData);
    }

    const currentData = upgradeData.levels[currentStack - 1];
    return this.formatLevelPreview(upgradeData.effectType, currentData, nextData);
  }

  private formatLevelPreview(
    effectType: string,
    current: Record<string, unknown> | null,
    next: Record<string, unknown>
  ): string {
    switch (effectType) {
      case 'cursorSizeBonus': {
        const nextPct = Math.round((next.sizeBonus as number) * 100);
        const nextDmg = next.damage as number;
        if (!current) {
          return `커서 범위 +${nextPct}%, 데미지 +${nextDmg}`;
        }
        const curPct = Math.round((current.sizeBonus as number) * 100);
        const curDmg = current.damage as number;
        return `범위 ${curPct}%→${nextPct}%, 데미지 ${curDmg}→${nextDmg}`;
      }

      case 'electricShockLevel': {
        const nextRadius = next.radius as number;
        const nextDmg = next.damage as number;
        if (!current) {
          return `반경 ${nextRadius}px, ${nextDmg} 데미지`;
        }
        const curRadius = current.radius as number;
        const curDmg = current.damage as number;
        return `반경 ${curRadius}→${nextRadius}px, 데미지 ${curDmg}→${nextDmg}`;
      }

      case 'staticDischargeLevel': {
        const nextChance = Math.round((next.chance as number) * 100);
        const nextDmg = next.damage as number;
        const nextRange = next.range as number;
        if (!current) {
          return `${nextChance}% 확률로 ${nextRange}px 내 적 타격 (${nextDmg} 데미지)`;
        }
        const curChance = Math.round((current.chance as number) * 100);
        const curRange = current.range as number;
        return `확률 ${curChance}%→${nextChance}%, 사거리 ${curRange}→${nextRange}px`;
      }

      case 'magnetLevel': {
        const nextRadius = next.radius as number;
        const nextForce = next.force as number;
        if (!current) {
          return `끌어당김 반경 ${nextRadius}px, 힘 ${nextForce}`;
        }
        const curRadius = current.radius as number;
        const curForce = current.force as number;
        return `반경 ${curRadius}→${nextRadius}px, 힘 ${curForce}→${nextForce}`;
      }

      case 'missileLevel': {
        const nextCount = next.count as number;
        const nextDmg = next.damage as number;
        if (!current) {
          return `미사일 ${nextCount}발 (${nextDmg} 데미지)`;
        }
        const curCount = current.count as number;
        const curDmg = current.damage as number;
        if (curDmg !== nextDmg) {
          return `미사일 ${curCount}→${nextCount}발, 데미지 ${curDmg}→${nextDmg}`;
        }
        return `미사일 수 ${curCount} → ${nextCount}발`;
      }

      default:
        return '';
    }
  }
}
