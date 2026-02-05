// ============================================
// 게임 데이터 타입 정의
// 밸런스 디자이너가 JSON 파일만 수정하여 게임 밸런스를 조절할 수 있도록 함
// ============================================

// ========== 화면 및 기본 설정 ==========
export interface ScreenConfig {
  width: number;
  height: number;
}

export interface CursorHitboxConfig {
  baseRadius: number;
}

export interface PlayerConfig {
  initialHp: number;
  cursorHitbox: CursorHitboxConfig;
}

export interface UpgradeUIConfig {
  boxWidth: number;
  boxHeight: number;
  boxSpacing: number;
  hoverDuration: number;
  boxYOffset: number;
}

export interface WaveTransitionConfig {
  countdownDuration: number;
}

export interface GameConfig {
  screen: ScreenConfig;
  player: PlayerConfig;
  upgradeUI: UpgradeUIConfig;
  waveTransition: WaveTransitionConfig;
}

// ========== 스폰 시스템 ==========
export interface SpawnAreaConfig {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface DynamicSpawnConfig {
  minActiveDishes: number;
  emergencyInterval: number;
  lowActiveInterval: number;
}

export interface SpawnConfig {
  area: SpawnAreaConfig;
  minDishDistance: number;
  dynamicSpawn: DynamicSpawnConfig;
}

// ========== 콤보 시스템 ==========
export interface ComboTimeoutConfig {
  base: number;
  comboReduction: number;
  waveReduction: number;
  minimum: number;
}

export interface ComboMultiplierConfig {
  factor: number;
  softcapFactor: number;
}

export interface ComboConfig {
  timeout: ComboTimeoutConfig;
  milestones: number[];
  multiplier: ComboMultiplierConfig;
}

// ========== 힐팩 시스템 ==========
export interface HealthPackConfig {
  healAmount: number;
  fallTime: number;
  fallSpeed: number;
  visualSize: number;
  hitboxSize: number;
  cooldown: number;
  maxActive: number;
  spawnChanceByHp: Record<string, number>;
}

// ========== 피드백 효과 ==========
export interface ComboMilestoneEffect {
  shake: number;
  shakeDuration: number;
  slowMotion?: number;
  slowDuration?: number;
}

export interface ParticleConfig {
  count: number;
}

export interface FeedbackConfig {
  comboMilestones: Record<string, ComboMilestoneEffect>;
  particles: {
    basic: ParticleConfig;
    golden: ParticleConfig;
    crystal: ParticleConfig;
    bomb: ParticleConfig;
  };
}

// ========== 색상 설정 ==========
export interface ColorsConfig {
  hex: Record<string, string>;
  numeric: Record<string, number>;
}

// ========== 웨이브 시스템 ==========
export interface DishTypeWeight {
  type: string;
  weight: number;
}

export interface WaveData {
  number: number;
  name: string;
  dishCount: number;
  spawnInterval: number;
  dishTypes: DishTypeWeight[];
}

export interface InfiniteScalingConfig {
  spawnIntervalReduction: number;
  minSpawnInterval: number;
  bombWeightIncrease: number;
  maxBombWeight: number;
  goldenWeightDecrease: number;
  minGoldenWeight: number;
}

export interface FeverConfig {
  name: string;
  dishCount: number;
  spawnInterval: number;
  dishTypes: DishTypeWeight[];
}

export interface WavesConfig {
  duration: number;
  waves: WaveData[];
  fever: FeverConfig;
  infiniteScaling: InfiniteScalingConfig;
}

// ========== 접시 시스템 ==========
export interface SpawnAnimationConfig {
  duration: number;
  ease: string;
}

export interface DishData {
  name: string;
  hp: number;
  points: number;
  speed: number;
  color: string;
  size: number;
  chainReaction: boolean;
  dangerous: boolean;
  invulnerable: boolean;
  lifetime: number;
  spawnAnimation: SpawnAnimationConfig;
}

export interface DishDamageConfig {
  playerDamage: number;
  damageInterval: number;
}

export interface DishesConfig {
  dishes: Record<string, DishData>;
  damage: DishDamageConfig;
}

// ========== 업그레이드 시스템 ==========
export interface StatEffect {
  stat: string;
  add?: number;
  multiply?: number;
}

export interface WeaponUpgradeData {
  id: string;
  name: string;
  description: string;
  stat?: string;
  add?: number;
  multiply?: number;
  special?: string;
  combo?: StatEffect[];
  maxStack: number;
}

export interface SystemUpgradeData {
  id: string;
  name: string;
  description: string;
  descriptionTemplate?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  effectType: string;
  value: number;
  maxStack: number;
  meta?: {
    baseRadius?: number;
    radiusPerLevel?: number;
    baseDamage?: number;
    damagePerLevel?: number;
  };
}

export interface UpgradeTimingConfig {
  baseInterval: number;
  increment: number;
  maxInterval: number;
}

export interface RarityWeights {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface RarityThresholds {
  early: number;
  mid: number;
  late: number;
}

export interface UpgradesConfig {
  timing: UpgradeTimingConfig;
  rarityWeights: {
    early: RarityWeights;
    mid: RarityWeights;
    late: RarityWeights;
    endgame: RarityWeights;
  };
  rarityThresholds: RarityThresholds;
  weapon: {
    common: WeaponUpgradeData[];
    rare: WeaponUpgradeData[];
    epic: WeaponUpgradeData[];
    legendary: WeaponUpgradeData[];
  };
  system: SystemUpgradeData[];
}

// ========== 무기 시스템 ==========
export interface WeaponData {
  name: string;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileCount: number;
  spreadAngle: number;
  piercing: boolean;
  explosive: boolean;
  homing: boolean;
  criticalChance: number;
  criticalMultiplier: number;
}

export interface WeaponsConfig {
  [key: string]: WeaponData;
}

// ========== 자기장 시스템 ==========
export interface MagnetConfig {
  baseRadius: number;
  radiusPerLevel: number;
  baseForce: number;
  forcePerLevel: number;
  minPullDistance: number;
}

// ========== 전체 데이터 구조 ==========
export interface GameDataConfig {
  gameConfig: GameConfig;
  spawn: SpawnConfig;
  combo: ComboConfig;
  healthPack: HealthPackConfig;
  feedback: FeedbackConfig;
  colors: ColorsConfig;
  waves: WavesConfig;
  dishes: DishesConfig;
  upgrades: UpgradesConfig;
  weapons: WeaponsConfig;
  magnet: MagnetConfig;
}
