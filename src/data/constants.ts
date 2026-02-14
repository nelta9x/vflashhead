// ============================================
// 게임 상수 - DataManager에서 로드
// 자주 참조되는 값만 re-export
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
  BRIGHT_RED: Data.colors.numeric.brightRed,
  GREEN: Data.colors.numeric.green,
  BRIGHT_GREEN: Data.colors.numeric.brightGreen,
  WHITE: Data.colors.numeric.white,
  ORB_CORE: Data.colors.numeric.orbCore,
  ORB_GLOW: Data.colors.numeric.orbGlow,
  DARK_BG: Data.colors.numeric.darkBg,
  DARK_PURPLE: Data.colors.numeric.darkPurple,
  DARK_CYAN: Data.colors.numeric.darkCyan,
  DANGER_DISH_BG: Data.colors.numeric.dangerDishBg,
  FROZEN: Data.colors.numeric.frozen,
  UPGRADE_CARD_BG: Data.colors.numeric.upgradeCardBg,
  UPGRADE_CARD_BG_HOVER: Data.colors.numeric.upgradeCardBgHover,
  PROGRESS_BAR_BG: Data.colors.numeric.progressBarBg,
  BOOT_PROGRESS_BG: Data.colors.numeric.bootProgressBg,
  MENU_BOSS_ARMOR: Data.colors.numeric.menuBossArmor,
  CURSE_CARD_BORDER: Data.colors.numeric.curseCardBorder,
  CURSE_CARD_BG: Data.colors.numeric.curseCardBg,
  CURSE_CARD_BG_HOVER: Data.colors.numeric.curseCardBgHover,
} as const;

// 무지개 색상 배열
export const RAINBOW_COLORS = Data.colors.rainbow;

// 색상 (헥스)
export const COLORS_HEX = {
  CYAN: Data.colors.hex.cyan,
  MAGENTA: Data.colors.hex.magenta,
  YELLOW: Data.colors.hex.yellow,
  RED: Data.colors.hex.red,
  BRIGHT_RED: Data.colors.hex.brightRed,
  GREEN: Data.colors.hex.green,
  BRIGHT_GREEN: Data.colors.hex.brightGreen,
  WHITE: Data.colors.hex.white,
  ORB_CORE: Data.colors.hex.orbCore,
  ORB_GLOW: Data.colors.hex.orbGlow,
  DARK_BG: Data.colors.hex.darkBg,
  DARK_PURPLE: Data.colors.hex.darkPurple,
  DARK_CYAN: Data.colors.hex.darkCyan,
  DANGER_DISH_BG: Data.colors.hex.dangerDishBg,
  FROZEN: Data.colors.hex.frozen,
  UPGRADE_CARD_BG: Data.colors.hex.upgradeCardBg,
  UPGRADE_CARD_BG_HOVER: Data.colors.hex.upgradeCardBgHover,
  PROGRESS_BAR_BG: Data.colors.hex.progressBarBg,
} as const;

// HP 시스템
export const INITIAL_HP = Data.gameConfig.player.initialHp;

// 폰트 설정
export const FONTS = {
  get MAIN() {
    return Data.getFont();
  },
  get KOREAN() {
    return Data.getFont();
  },
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
  COUNT_FROM: Data.gameConfig.waveTransition.countFrom,
} as const;

// 자기장 시스템
export const MAGNET = {
  MIN_PULL_DISTANCE: Data.magnet.minPullDistance,
} as const;

// 힐팩 시스템
export const HEAL_PACK = {
  HEAL_AMOUNT: Data.healthPack.healAmount,
  MOVE_SPEED: Data.healthPack.moveSpeed,
  VISUAL_SIZE: Data.healthPack.visualSize,
  HITBOX_SIZE: Data.healthPack.hitboxSize,
  COOLDOWN: Data.healthPack.cooldown,
  MAX_ACTIVE: Data.healthPack.maxActive,
  BASE_SPAWN_CHANCE: Data.healthPack.baseSpawnChance,
  CHECK_INTERVAL: Data.healthPack.checkInterval,
} as const;

// 낙하 폭탄 시스템
export const FALLING_BOMB = {
  MOVE_SPEED: Data.fallingBomb.moveSpeed,
  VISUAL_SIZE: Data.fallingBomb.visualSize,
  HITBOX_SIZE: Data.fallingBomb.hitboxSize,
  COOLDOWN: Data.fallingBomb.cooldown,
  MAX_ACTIVE: Data.fallingBomb.maxActive,
  BASE_SPAWN_CHANCE: Data.fallingBomb.baseSpawnChance,
  CHECK_INTERVAL: Data.fallingBomb.checkInterval,
  PLAYER_DAMAGE: Data.fallingBomb.playerDamage,
  RESET_COMBO: Data.fallingBomb.resetCombo,
  MIN_WAVE: Data.fallingBomb.minWave,
} as const;

// 깊이(depth) 설정
export const DEPTHS = Data.gameConfig.depths;
