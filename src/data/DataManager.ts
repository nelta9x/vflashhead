// ============================================
// DataManager - 게임 데이터 싱글톤 관리자
// 모든 JSON 데이터를 로드하고 타입 안전하게 제공
// 사용법: Data.gameConfig.player.initialHp
// ============================================

import type {
  GameConfig,
  SpawnConfig,
  ComboConfig,
  HealthPackConfig,
  FeedbackConfig,
  ColorsConfig,
  WavesConfig,
  DishesConfig,
  UpgradesConfig,
  WeaponsConfig,
  MagnetConfig,
  BossConfig,
  MenuConfig,
  LocalesConfig,
} from './types';

// JSON 파일 직접 import
import gameConfigJson from '../../data/game-config.json';
import mainMenuJson from '../../data/main-menu.json';
import spawnJson from '../../data/spawn.json';
import comboJson from '../../data/combo.json';
import healthPackJson from '../../data/health-pack.json';
import feedbackJson from '../../data/feedback.json';
import colorsJson from '../../data/colors.json';
import wavesJson from '../../data/waves.json';
import dishesJson from '../../data/dishes.json';
import upgradesJson from '../../data/upgrades.json';
import weaponsJson from '../../data/weapons.json';
import bossJson from '../../data/boss.json';
import localesJson from '../../data/locales.json';

class DataManager {
  private static instance: DataManager;

  // 타입 캐스팅된 데이터
  public readonly gameConfig: GameConfig;
  public readonly mainMenu: MenuConfig;
  public readonly spawn: SpawnConfig;
  public readonly combo: ComboConfig;
  public readonly healthPack: HealthPackConfig;
  public readonly feedback: FeedbackConfig;
  public readonly colors: ColorsConfig;
  public readonly waves: WavesConfig;
  public readonly dishes: DishesConfig;
  public readonly upgrades: UpgradesConfig;
  public readonly weapons: WeaponsConfig;
  public readonly magnet: MagnetConfig;
  public readonly boss: BossConfig;
  public readonly locales: LocalesConfig;

  private currentLang: 'en' | 'ko' = 'en';

  private getStorage():
    | Pick<Storage, 'getItem' | 'setItem'>
    | null {
    // Node 테스트 환경에서는 window/localStorage가 완전하지 않을 수 있으므로 접근하지 않는다.
    if (typeof window === 'undefined') return null;

    const storage = window.localStorage as Partial<Storage> | undefined;
    if (!storage) return null;
    if (typeof storage.getItem !== 'function') return null;
    if (typeof storage.setItem !== 'function') return null;

    return storage as Pick<Storage, 'getItem' | 'setItem'>;
  }

  private constructor() {
    this.gameConfig = gameConfigJson as GameConfig;
    this.mainMenu = mainMenuJson as MenuConfig;
    this.spawn = spawnJson as SpawnConfig;
    this.combo = comboJson as ComboConfig;
    this.healthPack = healthPackJson as HealthPackConfig;
    this.feedback = feedbackJson as FeedbackConfig;
    this.colors = colorsJson as ColorsConfig;
    this.waves = wavesJson as WavesConfig;
    this.dishes = dishesJson as DishesConfig;
    this.upgrades = upgradesJson as UpgradesConfig;
    this.weapons = weaponsJson as WeaponsConfig;
    this.magnet = gameConfigJson.magnet as MagnetConfig;
    this.boss = bossJson as BossConfig;
    this.locales = localesJson as LocalesConfig;

    // 지원하는 언어 목록 확인
    const supportedLanguages = Object.keys(this.locales);
    const defaultLang = this.gameConfig.defaultLanguage || 'en';

    // 1. 저장된 언어 설정 확인
    let savedLang: string | null = null;
    const storage = this.getStorage();
    try {
      if (storage) {
        savedLang = storage.getItem('game_language');
      }
    } catch {
      // localStorage might be unavailable or disabled
    }

    if (savedLang && supportedLanguages.includes(savedLang)) {
      this.currentLang = savedLang as 'en' | 'ko';
    } else {
      // 2. 브라우저 언어 감지 및 매칭
      let detectedLang = defaultLang;
      try {
        if (typeof navigator !== 'undefined') {
          const browserLang = navigator.language.split('-')[0];
          if (supportedLanguages.includes(browserLang)) {
            detectedLang = browserLang;
          }
        }
      } catch (e) {
        // navigator might be unavailable
      }

      this.currentLang = detectedLang as 'en' | 'ko';
    }
  }

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // ========== 다국어 지원 메서드 ==========

  public setLanguage(lang: 'en' | 'ko'): void {
    this.currentLang = lang;
    const storage = this.getStorage();
    try {
      if (storage) {
        storage.setItem('game_language', lang);
      }
    } catch {
      // 저장 실패는 치명적이지 않으므로 무시
    }
  }

  public getLanguage(): 'en' | 'ko' {
    return this.currentLang;
  }

  public getFont(): string {
    const locale = this.locales[this.currentLang];
    return locale.fontFamily || this.gameConfig.fonts.main;
  }

  public t(key: string, ...args: (string | number)[]): string {
    const locale = this.locales[this.currentLang];
    let str = locale[key] || this.locales['en'][key] || key;

    // {0}, {1} 등 플레이스홀더 치환
    args.forEach((arg, index) => {
      str = str.replace(`{${index}}`, String(arg));
    });

    return str;
  }

  public formatTemplate(templateKey: string, params: Record<string, number | string>): string {
    const locale = this.locales[this.currentLang];
    let str = locale[templateKey] || this.locales['en'][templateKey] || templateKey;

    Object.keys(params).forEach((key) => {
      // 템플릿의 {key}를 값으로 치환
      // 정규식 대신 split/join 사용하여 모든 발생 치환
      str = str.split(`{${key}}`).join(String(params[key]));
    });

    return str;
  }

  // ===================================

  /**
   * 색상 키(예: "cyan") 또는 헥스 문자열(예: "#00ffff")을 받아 숫자 색상 값을 반환합니다.
   */
  public getColor(nameOrHex: string): number {
    // 1. COLORS 키인지 확인 (대소문자 무시)
    const lowerKey = nameOrHex.toLowerCase();
    const numericValue = this.colors.numeric[nameOrHex] ?? this.colors.numeric[lowerKey];
    if (numericValue !== undefined) return numericValue;

    // 2. 헥스 문자열인 경우 숫자로 변환
    if (nameOrHex.startsWith('#')) {
      return parseInt(nameOrHex.replace('#', ''), 16);
    }

    // 3. 폴백
    return 0xffffff;
  }

  /**
   * 색상 키(예: "cyan") 또는 헥스 문자열을 받아 헥스 문자열(예: "#00ffff")을 반환합니다.
   */
  public getColorHex(nameOrHex: string): string {
    // 1. 이미 헥스 문자열인 경우 그대로 반환
    if (nameOrHex.startsWith('#')) return nameOrHex;

    // 2. COLORS 키인지 확인 (대소문자 무시)
    const lowerKey = nameOrHex.toLowerCase();
    const hexValue = this.colors.hex[nameOrHex] ?? this.colors.hex[lowerKey];
    if (hexValue !== undefined) return hexValue;

    // 3. 폴백
    return '#ffffff';
  }

  // 편의 메서드: 특정 웨이브 데이터 가져오기
  public getWaveData(waveNumber: number) {
    const index = Math.min(waveNumber - 1, this.waves.waves.length - 1);
    return this.waves.waves[index];
  }

  // 편의 메서드: 접시 데이터 가져오기
  public getDishData(dishType: string) {
    return this.dishes.dishes[dishType];
  }

  // 편의 메서드: 무기 데이터 가져오기
  public getWeaponData(weaponType: string) {
    return this.weapons[weaponType];
  }

  // 편의 메서드: HP 기반 힐팩 스폰 확률
  public getHealthPackSpawnChance(hp: number): number {
    const legacyByHp = this.healthPack.spawnChanceByHp;
    if (legacyByHp) {
      return legacyByHp[hp.toString()] ?? this.healthPack.baseSpawnChance;
    }
    return this.healthPack.baseSpawnChance;
  }

  // 편의 메서드: 콤보 마일스톤 효과 가져오기
  public getComboMilestoneEffect(milestone: number) {
    return this.feedback.comboMilestones[milestone.toString()];
  }

  // 편의 메서드: 업그레이드 횟수에 따른 희귀도 가중치
  public getRarityWeights(totalUpgrades: number) {
    const thresholds = this.upgrades.rarityThresholds;
    if (totalUpgrades <= thresholds.early) {
      return this.upgrades.rarityWeights.early;
    } else if (totalUpgrades <= thresholds.mid) {
      return this.upgrades.rarityWeights.mid;
    } else if (totalUpgrades <= thresholds.late) {
      return this.upgrades.rarityWeights.late;
    } else {
      return this.upgrades.rarityWeights.endgame;
    }
  }
}

// 싱글톤 인스턴스 export
export const Data = DataManager.getInstance();
