import { Data } from '../data/DataManager';
import type {
  SystemUpgradeData,
  CursorSizeLevelData,
  ElectricShockLevelData,
  StaticDischargeLevelData,
  MagnetLevelData,
  MissileLevelData,
  HealthPackLevelData,
  OrbitingOrbLevelData,
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
    effect: (us: UpgradeSystem) => {
      // levels 기반 어빌리티: 스택은 applyUpgrade에서 자동 증가하므로 no-op
      // healthPackLevel 업그레이드 시 HP 보너스 적용을 위한 이벤트 발생
      if (data.effectType === 'healthPackLevel') {
        const levelData = us.getLevelData<HealthPackLevelData>(data.id);
        if (levelData) {
          EventBus.getInstance().emit(GameEvents.HEALTH_PACK_UPGRADED, {
            hpBonus: levelData.hpBonus,
          });
        }
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

  // ========== 헬스팩 ==========
  getHealthPackLevel(): number {
    return this.getUpgradeStack('health_pack');
  }

  getHealthPackDropBonus(): number {
    return this.getLevelData<HealthPackLevelData>('health_pack')?.dropChanceBonus ?? 0;
  }

  // ========== 수호의 구체 ==========
  getOrbitingOrbLevel(): number {
    return this.getUpgradeStack('orbiting_orb');
  }

  getOrbitingOrbData(): OrbitingOrbLevelData | null {
    return this.getLevelData<OrbitingOrbLevelData>('orbiting_orb');
  }

  // ========== 유틸리티 ==========
  getUpgradeStack(upgradeId: string): number {
    return this.upgradeStacks.get(upgradeId) || 0;
  }

  getAllUpgradeStacks(): Map<string, number> {
    return new Map(this.upgradeStacks);
  }

  getSystemUpgrade(upgradeId: string): SystemUpgradeData | undefined {
    return Data.upgrades.system.find((u) => u.id === upgradeId);
  }

  // ========== 동적 설명 생성 ==========

  // 현재 레벨의 실제 효과를 설명하는 문자열 반환
  getFormattedDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);
    // 시스템 업그레이드가 아니면 일반 설명 반환 (번역 적용)
    if (!upgradeData) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    const stack = this.getUpgradeStack(upgradeId);
    if (stack <= 0) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    // 템플릿이 없는 경우
    if (!upgradeData.descriptionTemplate) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    if (!upgradeData.levels) return Data.t(`upgrade.${upgradeId}.desc`);

    const index = Math.min(stack, upgradeData.levels.length) - 1;
    const levelData = upgradeData.levels[index] as Record<string, number | string>;

    // 값 포맷팅 (chance, sizeBonus 등은 %로 변환)
    const params: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(levelData)) {
      if (typeof value === 'number') {
        params[key] =
          key === 'chance' || key === 'sizeBonus' || key === 'dropChanceBonus'
            ? Math.round(value * 100)
            : value;
      } else {
        params[key] = value;
      }
    }

    // 로케일 파일의 템플릿 사용
    return Data.formatTemplate(`upgrade.${upgradeId}.desc_template`, params);
  }

  // 선택 화면용 미리보기 설명 (현재 → 다음 레벨)
  getPreviewDescription(upgradeId: string): string {
    const upgradeData = Data.upgrades.system.find((u) => u.id === upgradeId);

    // 시스템 업그레이드가 아니면 (무기 등) 일반 설명의 번역본 반환
    if (!upgradeData) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    // fullHeal 등 levels가 없는 업그레이드
    if (!upgradeData.levels) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

    const currentStack = this.getUpgradeStack(upgradeId);
    const nextStack = currentStack + 1;

    if (nextStack > upgradeData.levels.length) {
      return Data.t(`upgrade.${upgradeId}.desc`);
    }

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
    const params: Record<string, number | string> = {};

    // Helper to process params
    const process = (prefix: string, data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number') {
          // 특수 필드는 % 변환
          const val =
            key === 'chance' || key === 'sizeBonus' || key === 'dropChanceBonus'
              ? Math.round(value * 100)
              : value;
          params[`${prefix}${key}`] = val;

          // 매핑을 위한 별칭 (템플릿 키와 일치시키기 위해)
          if (key === 'sizeBonus') params[`${prefix}Size`] = val;
          if (key === 'damage') params[`${prefix}Dmg`] = val;
          if (key === 'radius') params[`${prefix}Radius`] = val;
          if (key === 'chance') params[`${prefix}Chance`] = val;
          if (key === 'range') params[`${prefix}Range`] = val;
          if (key === 'force') params[`${prefix}Force`] = val;
          if (key === 'count') params[`${prefix}Count`] = val;
          if (key === 'hpBonus') params[`${prefix}Hp`] = val;
          if (key === 'dropChanceBonus') params[`${prefix}Drop`] = val;
        } else {
          params[`${prefix}${key}`] = String(value);
        }
      }
    };

    if (current) process('cur', current);
    process(current ? 'next' : '', next); // new일때는 prefix 없이 사용하거나 next?
    // Wait, for 'new', I used keys like {sizeBonus} without prefix in locales.json.
    // For 'upgrade', I used {curSize}, {nextSize}.

    // 재조정: new일 때는 prefix 없음. upgrade일 때는 cur/next prefix.
    if (!current) {
      // Reset params to remove 'next' prefix for simple keys if needed,
      // but my helper added 'nextSize'.
      // I need to add raw keys for 'new' case.
      for (const [key, value] of Object.entries(next)) {
        if (typeof value === 'number') {
          const val =
            key === 'chance' || key === 'sizeBonus' || key === 'dropChanceBonus'
              ? Math.round(value * 100)
              : value;
          params[key] = val;
        }
      }
    }

    switch (effectType) {
      case 'cursorSizeBonus':
        return current
          ? Data.formatTemplate('upgrade.preview.cursor_size.upgrade', params)
          : Data.formatTemplate('upgrade.preview.cursor_size.new', params);

      case 'electricShockLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.electric_shock.upgrade', params)
          : Data.formatTemplate('upgrade.preview.electric_shock.new', params);

      case 'staticDischargeLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.static_discharge.upgrade', params)
          : Data.formatTemplate('upgrade.preview.static_discharge.new', params);

      case 'magnetLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.magnet.upgrade', params)
          : Data.formatTemplate('upgrade.preview.magnet.new', params);

      case 'missileLevel':
        if (!current) return Data.formatTemplate('upgrade.preview.missile.new', params);
        if (current.damage !== next.damage) {
          return Data.formatTemplate('upgrade.preview.missile.upgrade', params);
        }
        return Data.formatTemplate('upgrade.preview.missile.upgrade_count', params);

      case 'healthPackLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.health_pack.upgrade', params)
          : Data.formatTemplate('upgrade.preview.health_pack.new', params);

      case 'orbitingOrbLevel':
        return current
          ? Data.formatTemplate('upgrade.preview.orbiting_orb.upgrade', params)
          : Data.formatTemplate('upgrade.preview.orbiting_orb.new', params);

      default:
        return '';
    }
  }
}
