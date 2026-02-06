// ============================================
// 게임 상수 - DataManager에서 로드
// 기존 코드 호환성을 위해 export 유지
// ============================================

import { Data } from './DataManager';

// 화면 크기
export const GAME_WIDTH = Data.gameConfig.screen.width;
export const GAME_HEIGHT = Data.gameConfig.screen.height;

// 색상 (숫자)
export const COLORS = {
  CYAN: Data.colors.numeric.cyan,
  MAGENTA: Data.colors.numeric.magenta,
  YELLOW: Data.colors.numeric.yellow,
  RED: Data.colors.numeric.red,
  GREEN: Data.colors.numeric.green,
  WHITE: Data.colors.numeric.white,
  DARK_BG: Data.colors.numeric.darkBg,
  DARK_PURPLE: Data.colors.numeric.darkPurple,
} as const;

// 색상 (헥스)
export const COLORS_HEX = {
  CYAN: Data.colors.hex.cyan,
  MAGENTA: Data.colors.hex.magenta,
  YELLOW: Data.colors.hex.yellow,
  RED: Data.colors.hex.red,
  GREEN: Data.colors.hex.green,
  WHITE: Data.colors.hex.white,
  DARK_BG: Data.colors.hex.darkBg,
  DARK_PURPLE: Data.colors.hex.darkPurple,
} as const;

// 업그레이드 간격 (가속 후 감속 시스템)
export const UPGRADE_TIMING = {
  BASE_INTERVAL: Data.upgrades.timing.baseInterval,
  INCREMENT: Data.upgrades.timing.increment,
  MAX_INTERVAL: Data.upgrades.timing.maxInterval,
} as const;

// 동적 희귀도 가중치 (업그레이드 횟수별)
export const RARITY_WEIGHTS_BY_COUNT: Record<
  string,
  { common: number; rare: number; epic: number; legendary: number }
> = {
  early: Data.upgrades.rarityWeights.early,
  mid: Data.upgrades.rarityWeights.mid,
  late: Data.upgrades.rarityWeights.late,
  endgame: Data.upgrades.rarityWeights.endgame,
} as const;

// HP 시스템
export const INITIAL_HP = Data.gameConfig.player.initialHp;

// 폰트 설정
export const FONTS = {
  MAIN: Data.gameConfig.fonts.main,
  KOREAN: Data.gameConfig.fonts.korean,
} as const;

// 접시 생존 시간 (밀리초)
export const DISH_LIFETIME = {
  basic: Data.dishes.dishes.basic.lifetime,
  golden: Data.dishes.dishes.golden.lifetime,
  crystal: Data.dishes.dishes.crystal.lifetime,
  bomb: Data.dishes.dishes.bomb.lifetime,
} as const;

// 스폰 영역
export const SPAWN_AREA = {
  minX: Data.spawn.area.minX,
  maxX: Data.spawn.area.maxX,
  minY: Data.spawn.area.minY,
  maxY: Data.spawn.area.maxY,
} as const;

// 접시 간 최소 거리
export const MIN_DISH_DISTANCE = Data.spawn.minDishDistance;
export const MIN_BOSS_DISTANCE = Data.spawn.minBossDistance;

// 접시 데미지 시스템
export const DISH_DAMAGE = {
  PLAYER_DAMAGE: Data.dishes.damage.playerDamage,
  DAMAGE_INTERVAL: Data.dishes.damage.damageInterval,
} as const;

// 커서 히트박스 (플레이어 공격 범위)
export const CURSOR_HITBOX = {
  BASE_RADIUS: Data.gameConfig.player.cursorHitbox.baseRadius,
} as const;

// 인게임 업그레이드 UI
export const UPGRADE_UI = {
  BOX_WIDTH: Data.gameConfig.upgradeUI.boxWidth,
  BOX_HEIGHT: Data.gameConfig.upgradeUI.boxHeight,
  BOX_SPACING: Data.gameConfig.upgradeUI.boxSpacing,
  HOVER_DURATION: Data.gameConfig.upgradeUI.hoverDuration,
  BOX_Y_OFFSET: Data.gameConfig.upgradeUI.boxYOffset,
} as const;

// 웨이브 전환
export const WAVE_TRANSITION = {
  COUNTDOWN_DURATION: Data.gameConfig.waveTransition.countdownDuration,
} as const;

// 자기장 시스템
export const MAGNET = {
  MIN_PULL_DISTANCE: Data.magnet.minPullDistance,
} as const;

// 힐팩 시스템
export const HEAL_PACK = {
  HEAL_AMOUNT: Data.healthPack.healAmount,
  FALL_TIME: Data.healthPack.fallTime,
  FALL_SPEED: Data.healthPack.fallSpeed,
  VISUAL_SIZE: Data.healthPack.visualSize,
  HITBOX_SIZE: Data.healthPack.hitboxSize,
  COOLDOWN: Data.healthPack.cooldown,
  MAX_ACTIVE: Data.healthPack.maxActive,
  SPAWN_CHANCE: Object.fromEntries(
    Object.entries(Data.healthPack.spawnChanceByHp).map(([k, v]) => [Number(k), v])
  ) as Record<number, number>,
} as const;
