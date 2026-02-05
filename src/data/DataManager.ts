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
} from './types';

// JSON 파일 직접 import
import gameConfigJson from './game-config.json';
import spawnJson from './spawn.json';
import comboJson from './combo.json';
import healthPackJson from './health-pack.json';
import feedbackJson from './feedback.json';
import colorsJson from './colors.json';
import wavesJson from './waves.json';
import dishesJson from './dishes.json';
import upgradesJson from './upgrades.json';
import weaponsJson from './weapons.json';

class DataManager {
  private static instance: DataManager;

  // 타입 캐스팅된 데이터
  public readonly gameConfig: GameConfig;
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

  private constructor() {
    this.gameConfig = gameConfigJson as GameConfig;
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
  }

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // 편의 메서드: 색상 숫자 값 가져오기
  public getColor(name: string): number {
    return this.colors.numeric[name] ?? 0xffffff;
  }

  // 편의 메서드: 색상 헥스 값 가져오기
  public getColorHex(name: string): string {
    return this.colors.hex[name] ?? '#ffffff';
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
    return this.healthPack.spawnChanceByHp[hp.toString()] ?? 0;
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
