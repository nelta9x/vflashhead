export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const COLORS = {
  CYAN: 0x00ffff,
  MAGENTA: 0xff00ff,
  YELLOW: 0xffff00,
  RED: 0xff0044,
  GREEN: 0x00ff88,
  WHITE: 0xffffff,
  DARK_BG: 0x0a0a0f,
  DARK_PURPLE: 0x1a0a2e,
} as const;

export const COLORS_HEX = {
  CYAN: '#00ffff',
  MAGENTA: '#ff00ff',
  YELLOW: '#ffff00',
  RED: '#ff0044',
  GREEN: '#00ff88',
  WHITE: '#ffffff',
  DARK_BG: '#0a0a0f',
  DARK_PURPLE: '#1a0a2e',
} as const;

// 업그레이드 간격 (가속 후 감속 시스템)
export const UPGRADE_TIMING = {
  BASE_INTERVAL: 15000, // 첫 업그레이드: 15초
  INCREMENT: 5000, // 업그레이드마다 5초씩 증가
  MAX_INTERVAL: 30000, // 최대 30초
} as const;

// 동적 희귀도 가중치 (업그레이드 횟수별)
export const RARITY_WEIGHTS_BY_COUNT: Record<string, { common: number; rare: number; epic: number; legendary: number }> = {
  early: { common: 60, rare: 30, epic: 10, legendary: 0 }, // 1~2회
  mid: { common: 45, rare: 35, epic: 17, legendary: 3 }, // 3~4회
  late: { common: 30, rare: 35, epic: 25, legendary: 10 }, // 5~6회
  endgame: { common: 20, rare: 30, epic: 30, legendary: 20 }, // 7+회
} as const;

// 레거시 호환용
export const UPGRADE_INTERVAL = 30000; // 30초마다 업그레이드
export const COMBO_TIMEOUT = 1500; // 1.5초 콤보 타임아웃

// HP 시스템
export const INITIAL_HP = 5;

// 접시 생존 시간 (밀리초)
export const DISH_LIFETIME = {
  basic: 2000,
  golden: 1500,
  crystal: 1800,
  bomb: 1200, // 지뢰: 짧게 (빨리 사라지지만 위험)
} as const;

// 스폰 영역 (화면 전체에서 랜덤 위치)
export const SPAWN_AREA = {
  minX: 80,
  maxX: GAME_WIDTH - 80,
  minY: 120,
  maxY: GAME_HEIGHT - 80,
} as const;

// 접시 간 최소 거리
export const MIN_DISH_DISTANCE = 100;

// 접시 데미지 시스템
export const DISH_DAMAGE = {
  PLAYER_DAMAGE: 10,
  DAMAGE_INTERVAL: 200, // 밀리초
} as const;

// 커서 히트박스 (플레이어 공격 범위)
export const CURSOR_HITBOX = {
  BASE_RADIUS: 30, // 기본 공격 범위
} as const;

// 인게임 업그레이드 UI
export const UPGRADE_UI = {
  BOX_WIDTH: 200,
  BOX_HEIGHT: 100,
  BOX_SPACING: 30,
  HOVER_DURATION: 500, // 0.5초 호버로 선택
  BOX_Y_OFFSET: 120, // 화면 하단에서의 거리
} as const;

// 웨이브 전환
export const WAVE_TRANSITION = {
  COUNTDOWN_DURATION: 5000, // 5초 카운트다운
} as const;

// 힐팩 시스템
export const HEAL_PACK = {
  HEAL_AMOUNT: 1,
  FALL_TIME: 3500, // 3.5초
  FALL_SPEED: 206, // px/sec (GAME_HEIGHT + 40) / 3.5
  VISUAL_SIZE: 28, // 시각 크기
  HITBOX_SIZE: 35, // 히트박스 (관대한 판정)
  COOLDOWN: 15000, // 15초 쿨다운
  MAX_ACTIVE: 1, // 동시 스폰 최대 1개
  // HP 기반 스폰 확률 (초당)
  SPAWN_CHANCE: {
    5: 0, // HP 5: 0%
    4: 0.02, // HP 4: 2%
    3: 0.04, // HP 3: 4%
    2: 0.06, // HP 2: 6%
    1: 0.10, // HP 1: 10%
  } as Record<number, number>,
} as const;
