import { Data } from '../../../data/DataManager';
import type {
  RarityWeights,
  UpgradePreviewCardModel,
  SystemUpgradeData,
  SystemUpgradeLevelData,
} from '../../../data/types/upgrades';
import type { UpgradeSystemCore } from '../../types';
import { EventBus, GameEvents } from '../../../utils/EventBus';
import { UpgradeDescriptionFormatter } from './upgrades/UpgradeDescriptionFormatter';
import { UpgradePreviewModelBuilder } from './upgrades/UpgradePreviewModelBuilder';
import { UpgradeRarityRoller } from '../../../systems/upgrades/UpgradeRarityRoller';
import { UpgradeStateStore } from '../../../systems/upgrades/UpgradeStateStore';
import {
  ABILITY_IDS,
  GLASS_CANNON_EFFECT_KEYS,
  HEALTH_PACK_EFFECT_KEYS,
} from './upgrades/AbilityEffectCatalog';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  maxStack: number;
  isCurse: boolean;
  effect: (upgradeSystem: UpgradeSystem, stack: number) => void;
}

// 시스템 업그레이드를 Upgrade 인터페이스로 변환
function createSystemUpgrades(): Upgrade[] {
  const seenUpgradeIds = new Set<string>();
  const validatedUpgrades = Data.getActiveAbilityDefinitions().map((abilityDefinition) => {
    const upgradeId = abilityDefinition.upgradeId;
    if (seenUpgradeIds.has(upgradeId)) {
      throw new Error(
        `Duplicate upgradeId mapping in abilities.json: "${upgradeId}"`
      );
    }
    seenUpgradeIds.add(upgradeId);

    const data = Data.upgrades.system.find((upgrade) => upgrade.id === upgradeId);
    if (!data) {
      throw new Error(
        `Missing upgrade "${upgradeId}" mapped from ability "${abilityDefinition.id}"`
      );
    }

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
    isCurse: data.isCurse ?? false,
    effect: (us: UpgradeSystem) => {
      // levels 기반 어빌리티: 스택은 applyUpgrade에서 자동 증가하므로 no-op
      // healthPackLevel 업그레이드 시 HP 보너스 적용을 위한 이벤트 발생
      if (data.effectType === 'healthPackLevel') {
        EventBus.getInstance().emit(GameEvents.HEALTH_PACK_UPGRADED, {
          hpBonus: us.getEffectValue(ABILITY_IDS.HEALTH_PACK, HEALTH_PACK_EFFECT_KEYS.HP_BONUS),
        });
      }
      // 글래스 캐논: 선택 시 최대 체력 감소
      if (data.effectType === 'glassCannonLevel') {
        EventBus.getInstance().emit(GameEvents.CURSE_HP_PENALTY, {
          hpPenalty: us.getEffectValue(ABILITY_IDS.GLASS_CANNON, GLASS_CANNON_EFFECT_KEYS.HP_PENALTY),
        });
      }
    },
  }));
}

export const UPGRADES: Upgrade[] = createSystemUpgrades();

export class UpgradeSystem implements UpgradeSystemCore {
  private readonly stateStore = new UpgradeStateStore();
  private readonly rarityRoller = new UpgradeRarityRoller();
  private readonly descriptionFormatter: UpgradeDescriptionFormatter;
  private readonly previewModelBuilder: UpgradePreviewModelBuilder;

  constructor() {
    this.descriptionFormatter = new UpgradeDescriptionFormatter(
      (abilityId) => this.getAbilityLevel(abilityId),
      (abilityId) => this.getSystemUpgrade(abilityId)
    );
    this.previewModelBuilder = new UpgradePreviewModelBuilder({
      getAbilityLevel: (abilityId) => this.getAbilityLevel(abilityId),
      getSystemUpgrade: (abilityId) => this.getSystemUpgrade(abilityId),
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

  // ========== 공통 조회 API ==========

  public getAbilityLevel(inputAbilityId: string): number {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    const upgradeId = Data.getUpgradeIdForAbility(abilityId);
    return this.getUpgradeStack(upgradeId);
  }

  public getEffectValue(inputAbilityId: string, key: string): number {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    const upgradeData = this.getUpgradeDataOrThrow(abilityId);
    const levelData = this.getLevelData<Record<string, unknown>>(abilityId);

    if (levelData) {
      const value = levelData[key];
      if (typeof value === 'number') return value;
    }

    const staticValue = (upgradeData as unknown as Record<string, unknown>)[key];
    if (typeof staticValue === 'number') {
      return staticValue;
    }

    // level 0에서는 level 기반 수치를 0으로 취급
    const firstLevel = upgradeData.levels?.[0] as unknown as Record<string, unknown> | undefined;
    if (!levelData && firstLevel && typeof firstLevel[key] === 'number') {
      return 0;
    }

    throw new Error(`Unknown effect key "${key}" for ability "${abilityId}"`);
  }

  // ========== 레벨 데이터 헬퍼 ==========
  public getLevelData<T>(inputAbilityId: string): T | null {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    const upgradeData = this.getSystemUpgrade(abilityId);
    if (!upgradeData) {
      return null;
    }

    const level = this.getAbilityLevel(abilityId);
    if (level <= 0) return null;
    if (!upgradeData.levels || upgradeData.levels.length === 0) return null;

    const index = Math.min(level, upgradeData.levels.length) - 1;
    return upgradeData.levels[index] as T;
  }

  // ========== 유틸리티 ==========
  getUpgradeStack(upgradeId: string): number {
    return this.stateStore.getStack(upgradeId);
  }

  getAllUpgradeStacks(): Map<string, number> {
    return this.stateStore.getAllStacks();
  }

  getSystemUpgrade(inputAbilityId: string): SystemUpgradeData | undefined {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    return Data.getSystemUpgradeByAbilityId(abilityId);
  }

  // ========== 동적 설명 생성 ==========

  // 현재 레벨의 실제 효과를 설명하는 문자열 반환
  getFormattedDescription(inputAbilityId: string): string {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    return this.descriptionFormatter.getFormattedDescription(abilityId);
  }

  // 선택 화면용 구조화 프리뷰 모델 (현재 -> 다음 레벨)
  getPreviewCardModel(inputAbilityId: string): UpgradePreviewCardModel | null {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    return this.previewModelBuilder.build(abilityId);
  }

  private getUpgradeDataOrThrow(abilityId: string): SystemUpgradeData {
    const upgrade = this.getSystemUpgrade(abilityId);
    if (!upgrade) {
      throw new Error(`Unknown ability id: "${abilityId}"`);
    }
    return upgrade;
  }

  private resolveAbilityIdOrThrow(inputId: string): string {
    if (Data.getAbilityDefinition(inputId)) {
      return inputId;
    }

    const byUpgrade = Data.getAbilityDefinitionByUpgradeId(inputId);
    if (byUpgrade) {
      return byUpgrade.id;
    }

    throw new Error(`Unknown ability id: "${inputId}"`);
  }

  // 정적 타입 보조: 필요 시 호출부에서 안전하게 level data를 다루기 위한 유틸
  public hasLevelDataKey(inputAbilityId: string, key: string): boolean {
    const abilityId = this.resolveAbilityIdOrThrow(inputAbilityId);
    const upgrade = this.getSystemUpgrade(abilityId);
    const firstLevel = upgrade?.levels?.[0] as SystemUpgradeLevelData | undefined;
    if (!firstLevel) return false;
    return Object.prototype.hasOwnProperty.call(firstLevel, key);
  }
}
