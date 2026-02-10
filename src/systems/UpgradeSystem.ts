import { Data } from '../data/DataManager';
import type {
  BlackHoleLevelData,
  CriticalChanceLevelData,
  CursorSizeLevelData,
  ElectricShockLevelData,
  HealthPackLevelData,
  MagnetLevelData,
  MissileLevelData,
  OrbitingOrbLevelData,
  RarityWeights,
  UpgradePreviewCardModel,
  SystemUpgradeData,
} from '../data/types/upgrades';
import { EventBus, GameEvents } from '../utils/EventBus';
import { UpgradeDescriptionFormatter } from './upgrades/UpgradeDescriptionFormatter';
import { UpgradePreviewModelBuilder } from './upgrades/UpgradePreviewModelBuilder';
import { UpgradeRarityRoller } from './upgrades/UpgradeRarityRoller';
import { UpgradeStateStore } from './upgrades/UpgradeStateStore';

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
  const validatedUpgrades = Data.upgrades.system.map((data) => {
    if (!data.previewDisplay || data.previewDisplay.stats.length === 0) {
      throw new Error(`Missing required previewDisplay for upgrade "${data.id}"`);
    }
    return data;
  });

  return validatedUpgrades.map((data: SystemUpgradeData) => ({
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
  private readonly stateStore = new UpgradeStateStore();
  private readonly rarityRoller = new UpgradeRarityRoller();
  private readonly descriptionFormatter: UpgradeDescriptionFormatter;
  private readonly previewModelBuilder: UpgradePreviewModelBuilder;

  constructor() {
    this.descriptionFormatter = new UpgradeDescriptionFormatter((upgradeId) =>
      this.getUpgradeStack(upgradeId)
    );
    this.previewModelBuilder = new UpgradePreviewModelBuilder({
      getUpgradeStack: (upgradeId) => this.getUpgradeStack(upgradeId),
    });
    this.reset();
  }

  reset(): void {
    this.stateStore.reset();
  }

  update(_delta: number, _gameTime: number): void {
    // 웨이브 기반 업그레이드 시스템으로 변경됨
    // 시간 기반 업그레이드 트리거 제거
  }

  getRandomUpgrades(count: number): Upgrade[] {
    const rarityWeights = this.getRarityWeights();

    return this.rarityRoller.selectRandomUpgrades(
      UPGRADES,
      (upgradeId) => this.getUpgradeStack(upgradeId),
      count,
      rarityWeights
    );
  }

  private getRarityWeights(): RarityWeights {
    const totalUpgrades = this.getTotalUpgradeCount();
    const weights = Data.getRarityWeights(totalUpgrades);
    return weights;
  }

  private getTotalUpgradeCount(): number {
    // 헬스팩은 스택 카운트에서 제외 (영구 강화가 아니므로)
    return this.stateStore.getTotalStackCount(['health_pack']);
  }

  applyUpgrade(upgrade: Upgrade): void {
    const currentStack = this.getUpgradeStack(upgrade.id);

    // 영구 업그레이드인 경우만 스택 체크
    if (upgrade.id !== 'health_pack' && currentStack >= upgrade.maxStack) {
      return;
    }

    // 스택 증가 (헬스팩은 로직상 무시되지만 기록은 남음)
    const nextStack = this.stateStore.incrementStack(upgrade.id);

    // 효과 적용
    upgrade.effect(this, nextStack);
  }

  // ========== 레벨 데이터 헬퍼 ==========
  public getLevelData<T>(upgradeId: string): T | null {
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

  getCursorMissileThicknessBonus(): number {
    return this.getLevelData<CursorSizeLevelData>('cursor_size')?.missileThicknessBonus ?? 0;
  }

  // ========== 치명타 확률 ==========
  getCriticalChanceLevel(): number {
    return this.getUpgradeStack('critical_chance');
  }

  getCriticalChanceBonus(): number {
    return this.getLevelData<CriticalChanceLevelData>('critical_chance')?.criticalChance ?? 0;
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

  // ========== 금구슬 ==========
  getOrbitingOrbLevel(): number {
    return this.getUpgradeStack('orbiting_orb');
  }

  getOrbitingOrbData(): OrbitingOrbLevelData | null {
    return this.getLevelData<OrbitingOrbLevelData>('orbiting_orb');
  }

  // ========== 블랙홀 ==========
  getBlackHoleLevel(): number {
    return this.getUpgradeStack('black_hole');
  }

  getBlackHoleData(): BlackHoleLevelData | null {
    return this.getLevelData<BlackHoleLevelData>('black_hole');
  }

  // ========== 유틸리티 ==========
  getUpgradeStack(upgradeId: string): number {
    return this.stateStore.getStack(upgradeId);
  }

  getAllUpgradeStacks(): Map<string, number> {
    return this.stateStore.getAllStacks();
  }

  getSystemUpgrade(upgradeId: string): SystemUpgradeData | undefined {
    return Data.upgrades.system.find((u) => u.id === upgradeId);
  }

  // ========== 동적 설명 생성 ==========

  // 현재 레벨의 실제 효과를 설명하는 문자열 반환
  getFormattedDescription(upgradeId: string): string {
    return this.descriptionFormatter.getFormattedDescription(upgradeId);
  }

  // 선택 화면용 구조화 프리뷰 모델 (현재 -> 다음 레벨)
  getPreviewCardModel(upgradeId: string): UpgradePreviewCardModel | null {
    return this.previewModelBuilder.build(upgradeId);
  }
}
