import { RARITY_WEIGHTS_BY_COUNT } from '../config/constants';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  maxStack: number;
  effect: (upgradeSystem: UpgradeSystem, stack: number) => void;
}

const UPGRADES: Upgrade[] = [
  // ========== Common - 기본 강화 ==========
  {
    id: 'damage_up',
    name: '화력 강화',
    description: '접시에 주는 데미지가 2 증가합니다.',
    rarity: 'common',
    maxStack: 5,
    effect: (us) => us.addDamageBonus(2),
  },
  {
    id: 'attack_speed',
    name: '공격 속도',
    description: '데미지 틱 간격이 15% 감소합니다.',
    rarity: 'common',
    maxStack: 5,
    effect: (us) => us.addAttackSpeedBonus(0.15),
  },
  {
    id: 'dish_slow',
    name: '시간 왜곡',
    description: '모든 접시의 타이머가 10% 느리게 흐릅니다.',
    rarity: 'common',
    maxStack: 5,
    effect: (us) => us.addGlobalSlowPercent(0.1),
  },
  {
    id: 'hp_up',
    name: '체력 증가',
    description: '최대 HP가 1 증가합니다.',
    rarity: 'common',
    maxStack: 3,
    effect: (us) => us.addMaxHpBonus(1),
  },
  {
    id: 'heal_on_wave',
    name: '웨이브 회복',
    description: '웨이브 완료 시 HP를 1 회복합니다.',
    rarity: 'common',
    maxStack: 2,
    effect: (us) => us.addWaveHealAmount(1),
  },

  // ========== Rare - 범위/연쇄 효과 ==========
  {
    id: 'aoe_destroy',
    name: '범위 파괴',
    description: '접시 파괴 시 주변 1개를 추가로 파괴합니다.',
    rarity: 'rare',
    maxStack: 3,
    effect: (us) => us.addAoeDestroyCount(1),
  },
  {
    id: 'bomb_shield',
    name: '폭탄 방어',
    description: '폭탄 피해를 1회 무효화합니다. (웨이브마다 충전)',
    rarity: 'rare',
    maxStack: 3,
    effect: (us) => us.addBombShieldCount(1),
  },
  {
    id: 'lifesteal',
    name: '생명력 흡수',
    description: '접시 파괴 시 5% 확률로 HP 1 회복',
    rarity: 'rare',
    maxStack: 4,
    effect: (us) => us.addLifestealChance(0.05),
  },
  {
    id: 'combo_heal',
    name: '콤보 회복',
    description: '10콤보마다 HP를 1 회복합니다.',
    rarity: 'rare',
    maxStack: 2,
    effect: (us) => us.addComboHealThreshold(1),
  },
  {
    id: 'cursor_size',
    name: '넓은 타격',
    description: '커서 판정 범위가 20% 증가합니다.',
    rarity: 'rare',
    maxStack: 3,
    effect: (us) => us.addCursorSizeBonus(0.2),
  },
  {
    id: 'critical_chance',
    name: '치명타',
    description: '15% 확률로 2배 데미지를 줍니다.',
    rarity: 'rare',
    maxStack: 3,
    effect: (us) => us.addCriticalChance(0.15),
  },

  // ========== Epic - 강력한 효과 ==========
  {
    id: 'aoe_destroy_enhanced',
    name: '범위 파괴 강화',
    description: '접시 파괴 시 주변 2개를 추가로 파괴합니다.',
    rarity: 'epic',
    maxStack: 2,
    effect: (us) => us.addAoeDestroyCount(2),
  },
  {
    id: 'freeze_aura',
    name: '냉동 오라',
    description: '파괴 시 주변 접시가 2초간 느려집니다.',
    rarity: 'epic',
    maxStack: 2,
    effect: (us) => us.addFreezeAuraDuration(2000),
  },
  {
    id: 'electric_shock',
    name: '전기 충격',
    description: '주변 접시에 번개 데미지를 줍니다.',
    rarity: 'epic',
    maxStack: 2,
    effect: (us) => us.addElectricShockLevel(1),
  },
  {
    id: 'bomb_convert',
    name: '폭탄 전환',
    description: '폭탄을 터뜨리면 HP를 1 회복합니다.',
    rarity: 'epic',
    maxStack: 1,
    effect: (us) => us.setBombConvertHeal(true),
  },
  {
    id: 'second_chance',
    name: '두 번째 기회',
    description: '놓친 접시가 50% 확률로 다시 나타납니다.',
    rarity: 'epic',
    maxStack: 2,
    effect: (us) => us.addSecondChancePercent(0.25),
  },
  {
    id: 'magnet_pull',
    name: '자석 효과',
    description: '파괴 시 주변 접시들이 중심으로 끌려옵니다.',
    rarity: 'epic',
    maxStack: 2,
    effect: (us) => us.addMagnetPullLevel(1),
  },

  // ========== Legendary - 궁극기 ==========
  {
    id: 'chain_reaction',
    name: '연쇄 폭발',
    description: '범위 파괴된 접시도 범위 파괴를 유발합니다.',
    rarity: 'legendary',
    maxStack: 1,
    effect: (us) => us.setChainReaction(true),
  },
  {
    id: 'black_hole',
    name: '블랙홀',
    description: '15% 확률로 주변 모든 접시를 흡수합니다.',
    rarity: 'legendary',
    maxStack: 1,
    effect: (us) => us.setBlackHoleChance(0.15),
  },
  {
    id: 'immortal',
    name: '불사',
    description: 'HP가 0이 되면 1회 부활합니다. (HP 3 회복)',
    rarity: 'legendary',
    maxStack: 1,
    effect: (us) => us.setReviveCount(1),
  },
  {
    id: 'time_stop',
    name: '시간 정지',
    description: '10초마다 모든 접시가 1초간 멈춥니다.',
    rarity: 'legendary',
    maxStack: 1,
    effect: (us) => us.setTimeStopEnabled(true),
  },
  {
    id: 'auto_destroy',
    name: '자동 파괴',
    description: '3초마다 랜덤 접시 1개가 자동으로 파괴됩니다.',
    rarity: 'legendary',
    maxStack: 1,
    effect: (us) => us.setAutoDestroyEnabled(true),
  },
];

export class UpgradeSystem {
  private upgradeStacks: Map<string, number> = new Map();

  // 기본 강화
  private damageBonus: number = 0;
  private attackSpeedBonus: number = 0;
  private globalSlowPercent: number = 0;
  private cursorSizeBonus: number = 0;
  private criticalChance: number = 0;

  // HP/생존 관련
  private maxHpBonus: number = 0;
  private waveHealAmount: number = 0;
  private bombShieldCount: number = 0;
  private bombShieldMax: number = 0;
  private lifestealChance: number = 0;
  private comboHealThreshold: number = 0; // 10콤보당 힐 횟수
  private bombConvertHeal: boolean = false;
  private secondChancePercent: number = 0;
  private reviveCount: number = 0;

  // 범위/연쇄 효과
  private aoeDestroyCount: number = 0;
  private aoeRadiusMultiplier: number = 1.0;
  private chainReaction: boolean = false;
  private freezeAuraDuration: number = 0;
  private electricShockLevel: number = 0;
  private magnetPullLevel: number = 0;
  private blackHoleChance: number = 0;

  // 특수 효과
  private timeStopEnabled: boolean = false;
  private autoDestroyEnabled: boolean = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.upgradeStacks.clear();

    // 기본 강화
    this.damageBonus = 0;
    this.attackSpeedBonus = 0;
    this.globalSlowPercent = 0;
    this.cursorSizeBonus = 0;
    this.criticalChance = 0;

    // HP/생존
    this.maxHpBonus = 0;
    this.waveHealAmount = 0;
    this.bombShieldCount = 0;
    this.bombShieldMax = 0;
    this.lifestealChance = 0;
    this.comboHealThreshold = 0;
    this.bombConvertHeal = false;
    this.secondChancePercent = 0;
    this.reviveCount = 0;

    // 범위/연쇄
    this.aoeDestroyCount = 0;
    this.aoeRadiusMultiplier = 1.0;
    this.chainReaction = false;
    this.freezeAuraDuration = 0;
    this.electricShockLevel = 0;
    this.magnetPullLevel = 0;
    this.blackHoleChance = 0;

    // 특수
    this.timeStopEnabled = false;
    this.autoDestroyEnabled = false;
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
      return UPGRADES.slice(0, count); // 폴백
    }

    // 가중치 기반 선택
    const selected: Upgrade[] = [];
    const pool = [...availableUpgrades];

    while (selected.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, u) => sum + rarityWeights[u.rarity], 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < pool.length; i++) {
        random -= rarityWeights[pool[i].rarity];
        if (random <= 0) {
          selected.push(pool[i]);
          pool.splice(i, 1);
          break;
        }
      }
    }

    return selected;
  }

  private getRarityWeights(): Record<string, number> {
    // 업그레이드 횟수에 따라 희귀도 가중치 변화
    // 1~2회: 초반 (Common 위주)
    // 3~4회: 중반 (Rare/Epic 증가)
    // 5~6회: 후반 (Epic 증가, Legendary 출현)
    // 7+회: 엔드게임 (Legendary 확률 대폭 증가)
    const totalUpgrades = this.getTotalUpgradeCount();

    if (totalUpgrades <= 2) {
      return RARITY_WEIGHTS_BY_COUNT.early;
    } else if (totalUpgrades <= 4) {
      return RARITY_WEIGHTS_BY_COUNT.mid;
    } else if (totalUpgrades <= 6) {
      return RARITY_WEIGHTS_BY_COUNT.late;
    } else {
      return RARITY_WEIGHTS_BY_COUNT.endgame;
    }
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

  // ========== 기본 강화 ==========
  addDamageBonus(amount: number): void {
    this.damageBonus += amount;
  }

  addAttackSpeedBonus(amount: number): void {
    this.attackSpeedBonus += amount;
  }

  addGlobalSlowPercent(percent: number): void {
    this.globalSlowPercent += percent;
  }

  addCursorSizeBonus(amount: number): void {
    this.cursorSizeBonus += amount;
  }

  addCriticalChance(chance: number): void {
    this.criticalChance += chance;
  }

  getDamageBonus(): number {
    return this.damageBonus;
  }

  getAttackSpeedMultiplier(): number {
    // 수확체감 공식: 스택이 쌓일수록 효율 감소
    // k=0.5: 스택 1개에 33% 감소, 스택 5개에 77% 감소
    // 최소 30%까지만 감소 (기존 20% → 30%로 너프)
    const k = 0.5;
    const reduction = this.attackSpeedBonus / (this.attackSpeedBonus + k);
    return Math.max(0.3, 1 - reduction * 0.7);
  }

  getGlobalSlowPercent(): number {
    return Math.min(0.5, this.globalSlowPercent); // 최대 50%까지만 감속
  }

  getCursorSizeBonus(): number {
    return this.cursorSizeBonus;
  }

  getCriticalChance(): number {
    return Math.min(0.75, this.criticalChance); // 최대 75%
  }

  // ========== HP/생존 관련 ==========
  addMaxHpBonus(amount: number): void {
    this.maxHpBonus += amount;
  }

  addWaveHealAmount(amount: number): void {
    this.waveHealAmount += amount;
  }

  addBombShieldCount(count: number): void {
    this.bombShieldMax += count;
    this.bombShieldCount = this.bombShieldMax; // 즉시 충전
  }

  addLifestealChance(chance: number): void {
    this.lifestealChance += chance;
  }

  addComboHealThreshold(count: number): void {
    this.comboHealThreshold += count;
  }

  setBombConvertHeal(enabled: boolean): void {
    this.bombConvertHeal = enabled;
  }

  addSecondChancePercent(percent: number): void {
    this.secondChancePercent += percent;
  }

  setReviveCount(count: number): void {
    this.reviveCount = count;
  }

  getMaxHpBonus(): number {
    return this.maxHpBonus;
  }

  getWaveHealAmount(): number {
    return this.waveHealAmount;
  }

  getBombShieldCount(): number {
    return this.bombShieldCount;
  }

  useBombShield(): boolean {
    if (this.bombShieldCount > 0) {
      this.bombShieldCount--;
      return true;
    }
    return false;
  }

  rechargeBombShield(): void {
    this.bombShieldCount = this.bombShieldMax;
  }

  getLifestealChance(): number {
    return this.lifestealChance;
  }

  getComboHealThreshold(): number {
    return this.comboHealThreshold;
  }

  isBombConvertHealEnabled(): boolean {
    return this.bombConvertHeal;
  }

  getSecondChancePercent(): number {
    return Math.min(1.0, this.secondChancePercent); // 최대 100%
  }

  getReviveCount(): number {
    return this.reviveCount;
  }

  useRevive(): boolean {
    if (this.reviveCount > 0) {
      this.reviveCount--;
      return true;
    }
    return false;
  }

  // ========== 범위/연쇄 효과 ==========
  addAoeDestroyCount(count: number): void {
    this.aoeDestroyCount += count;
  }

  addAoeRadiusMultiplier(amount: number): void {
    this.aoeRadiusMultiplier += amount;
  }

  setChainReaction(enabled: boolean): void {
    this.chainReaction = enabled;
  }

  addFreezeAuraDuration(ms: number): void {
    this.freezeAuraDuration += ms;
  }

  addElectricShockLevel(level: number): void {
    this.electricShockLevel += level;
  }

  addMagnetPullLevel(level: number): void {
    this.magnetPullLevel += level;
  }

  setBlackHoleChance(chance: number): void {
    this.blackHoleChance = chance;
  }

  getAoeDestroyCount(): number {
    return this.aoeDestroyCount;
  }

  getAoeRadiusMultiplier(): number {
    return this.aoeRadiusMultiplier;
  }

  isChainReactionEnabled(): boolean {
    return this.chainReaction;
  }

  getFreezeAuraDuration(): number {
    return this.freezeAuraDuration;
  }

  getElectricShockLevel(): number {
    return this.electricShockLevel;
  }

  getMagnetPullLevel(): number {
    return this.magnetPullLevel;
  }

  getBlackHoleChance(): number {
    return this.blackHoleChance;
  }

  // ========== 특수 효과 ==========
  setTimeStopEnabled(enabled: boolean): void {
    this.timeStopEnabled = enabled;
  }

  setAutoDestroyEnabled(enabled: boolean): void {
    this.autoDestroyEnabled = enabled;
  }

  isTimeStopEnabled(): boolean {
    return this.timeStopEnabled;
  }

  isAutoDestroyEnabled(): boolean {
    return this.autoDestroyEnabled;
  }


  // ========== 콤보 관련 ==========
  getComboDurationBonus(): number {
    return 0; // 현재 콤보 지속시간 업그레이드 없음
  }

  // ========== 유틸리티 ==========
  getUpgradeStack(upgradeId: string): number {
    return this.upgradeStacks.get(upgradeId) || 0;
  }

  getAllUpgradeStacks(): Map<string, number> {
    return new Map(this.upgradeStacks);
  }
}
