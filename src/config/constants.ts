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

export const GAME_DURATION = 180000; // 3분
export const UPGRADE_INTERVAL = 30000; // 30초마다 업그레이드
export const COMBO_TIMEOUT = 1500; // 1.5초 콤보 타임아웃

// HP 시스템
export const INITIAL_HP = 5;

// 접시 생존 시간 (밀리초)
export const DISH_LIFETIME = {
  basic: 2000,
  golden: 1500,
  crystal: 1800,
  bomb: 3000,
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
