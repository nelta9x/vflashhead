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
  cursorColor: string;
  cursorColorNumeric: number;
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

export interface LaserAttackConfig {
  width: number;
  warningDuration: number;
  fireDuration: number;
  minInterval: number;
  maxInterval: number;
  damage: number;
  color: string;
  warningAlpha: number;
  fireAlpha: number;
  trajectory: {
    minDistanceRatio: number;
    spawnPadding: number;
  };
  bonus: {
    comboAmount: number;
    invincibilityDuration: number;
  };
  visual: {
    sparkSegments: number;
    sparkCount: number;
  };
}

export interface MonsterAttackConfig {
  laser: LaserAttackConfig;
}

export interface GridConfig {
  size: number;
  speed: number;
  alpha: number;
  color: string;
  depth: number;
  lineWidth: number;
  horizonRatio?: number;
  verticalLines?: number;
  horizontalLines?: number;
}

export interface StarsConfig {
  count: number;
  minSize: number;
  maxSize: number;
  parallaxRatio: number; // 그리드 대비 이동 속도 비율 (예: 0.1)
  sizeSpeedFactor: number; // 크기에 따른 속도 변화율 (예: 0.4)
  twinkleSpeedMin: number;
  twinkleSpeedMax: number;
  verticalLimitRatio: number;
}

export interface LanguageUIConfig {
  x: number;
  y: number;
  fontSize: string;
  spacing: number;
  activeScale: number;
  inactiveAlpha: number;
}

export interface MenuConfig {
  boss: {
    posYRatio: number;
    baseRadius: number;
    coreRadius: number;
    innerLightRadius: number;
    armor: {
      innerRadius: number;
      outerRadius: number;
      pieceCount: number;
      gap: number;
      rotationSpeed: number;
    };
    aura: {
      count: number;
      pulseSpeed: number;
      spacing: number;
    };
    core: {
      pulseSpeed: number;
    };
  };
  grid: GridConfig & {
    horizonRatio: number;
    verticalLines: number;
    horizontalLines: number;
  };
  stars: StarsConfig;
  cursor: {
    yOffset: number;
    radius: number;
    crossSize: number;
    floatRangeX: number;
    floatRangeY: number;
    floatSpeed: number;
    lerpTracking: number;
    lerpIdle: number;
    trackingYThreshold: number;
  };
  dishSpawn: {
    interval: number;
    radius: number;
    color: string;
    spawnYOffset: number;
    spawnRangeX: number;
    speedMultiplier: number;
  };
  bestWave: {
    yOffset: number;
    fontSize: string;
    alpha: number;
    localStorageKey: string;
  };
  title: {
    yOffset: number;
    fontSize: string;
    shadowBlur: number;
    moveDuration: number;
    moveY: number;
    padding: number;
  };
  languageUI: LanguageUIConfig;
}

export interface AudioBGMConfig {
  key: string;
  path: string;
  volume: number;
}

export interface AudioConfig {
  bgm: AudioBGMConfig;
}

export interface PlayerAttackConfig {
  baseMissileCount: number;
  baseMissileDamage: number;
}

export interface GameConfig {
  screen: ScreenConfig;
  defaultLanguage: string;
  player: PlayerConfig;
  upgradeUI: UpgradeUIConfig;
  waveTransition: WaveTransitionConfig;
  monsterAttack: MonsterAttackConfig;
  playerAttack: PlayerAttackConfig;
  fonts: {
    main: string;
    korean: string;
  };
  magnet: MagnetConfig;
  gameGrid: GridConfig;
  stars: StarsConfig;
  audio: AudioConfig;
}

// ========== 스폰 시스템 ==========
export interface SpawnAreaConfig {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface FillSpawnConfig {
  maxPerFrame: number;
  cooldownMs: number;
}

export interface SpawnConfig {
  area: SpawnAreaConfig;
  minDishDistance: number;
  minBossDistance: number;
  fillSpawn: FillSpawnConfig;
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
  gaugeBonusPerCombo: number;
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
  bonusSpawnChancePerCollection: number;
  baseSpawnChance: number;
  checkInterval: number;
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

export interface DamageTextTypeConfig {
  color: string;
  fontSize: number;
  initialScale: number;
}

export interface DamageTextComboConfig {
  minComboToShow: number;
  fontSize: number;
  offsetX: number;
  offsetY: number;
  colors: {
    low: string;
    mid: string;
    high: string;
    ultra: string;
  };
  thresholds: {
    mid: number;
    high: number;
    ultra: number;
  };
}

export interface DamageTextAnimationConfig {
  scalePop: {
    duration: number;
    ease: string;
  };
  shake: {
    distance: number;
    duration: number;
    ease: string;
    repeat: number;
  };
  hold: {
    duration: number;
  };
  shrinkFade: {
    duration: number;
    targetScale: number;
    ease: string;
  };
}

export interface DamageTextStyleConfig {
  strokeThickness: number;
  fontStyle: string;
}

export interface DamageTextRandomScaleConfig {
  enabled: boolean;
  min: number;
  max: number;
}

export interface DamageTextRandomRotationConfig {
  enabled: boolean;
  min: number;
  max: number;
}

export interface DamageTextConfig {
  normal: DamageTextTypeConfig;
  critical: DamageTextTypeConfig;
  combo: DamageTextComboConfig;
  style: DamageTextStyleConfig;
  randomScale: DamageTextRandomScaleConfig;
  randomRotation: DamageTextRandomRotationConfig;
  animation: DamageTextAnimationConfig;
}

export interface EnergyEffectConfig {
  baseSize: number;
  maxSizeBonus: number;
  comboDivision: number;
  duration: number;
  glowScale: number;
  alpha: number;
  glowAlpha: number;
  targetYOffset: number;
  knockbackDistance: number; // 튕겨나가는 거리
  trailLifespan: number; // 꼬리 지속 시간
}

export interface CursorTrailConfig {
  enabled: boolean;
  color: string;
  alpha: number;
  lifespan: number;
  maxWidth: number;
  minWidth: number;
  maxLength: number;
  minDistance: number;
}

export interface BossAttackConfig {
  mainColor: string;
  accentColor: string;
  innerTrailColor: string;
  charge: {
    duration: number;
    initialRadius: number;
    maxScale: number;
    particleFrequency: number;
    glowInitialAlpha: number;
    glowMaxAlpha: number;
    glowInitialRadius: number;
    glowMaxRadius: number;
    lightningChanceBase: number;
    lightningChanceP: number;
    lightningSegments: number;
  };
  fire: {
    duration: number;
    missileInterval: number;
    trailAlpha: number;
    trailLifespan: number;
    trailWidthMultiplier: number;
    innerTrailWidthMultiplier: number;
    innerTrailAlphaMultiplier: number;
    hitStopTimescale: number;
    hitStopDuration: number;
    trackingOffset?: {
      x: number;
      y: number;
    };
  };
  impact: {
    shakeIntensity: number;
    shakeDuration: number;
    zoomIntensity: number;
    zoomDurationIn: number;
    zoomDurationOut: number;
    zoomHold: number;
    hitStopTimescale: number;
    hitStopDuration: number;
    particleMultiplier: number;
    rainbowParticleMultiplier: number;
  };
}

export interface FeedbackConfig {
  damageText: DamageTextConfig;
  comboMilestones: Record<string, ComboMilestoneEffect>;
  particles: {
    basic: ParticleConfig;
    golden: ParticleConfig;
    crystal: ParticleConfig;
    bomb: ParticleConfig;
  };
  energyEffect: EnergyEffectConfig;
  cursorTrail: CursorTrailConfig;
  bossAttack: BossAttackConfig;
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

export interface WaveLaserConfig {
  maxCount: number;
  minInterval: number;
  maxInterval: number;
}

export interface WaveData {
  number: number;
  name: string;
  dishCount: number;
  spawnInterval: number;
  dishTypes: DishTypeWeight[];
  bossHp: number;
  laser?: WaveLaserConfig;
}

export interface InfiniteScalingConfig {
  spawnIntervalReduction: number;
  minSpawnInterval: number;
  bombWeightIncrease: number;
  maxBombWeight: number;
  goldenWeightDecrease: number;
  minGoldenWeight: number;
  bossHpIncrease: number;
  minDishCountIncrease: number;
  maxMinDishCount: number;
}

export interface FeverConfig {
  name: string;
  dishCount: number;
  spawnInterval: number;
  dishTypes: DishTypeWeight[];
}

export interface WavesConfig {
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

// 레벨별 데이터 인터페이스
export interface CursorSizeLevelData {
  sizeBonus: number;
  damage: number;
}
export interface ElectricShockLevelData {
  radius: number;
  damage: number;
}
export interface StaticDischargeLevelData {
  chance: number;
  damage: number;
  range: number;
}
export interface MagnetLevelData {
  radius: number;
  force: number;
}
export interface MissileLevelData {
  damage: number;
  count: number;
}
export interface HealthPackLevelData {
  hpBonus: number;
  dropChanceBonus: number;
}

export interface OrbitingOrbLevelData {
  count: number;
  damage: number;
  speed: number;
  radius: number;
  size: number;
}

export type SystemUpgradeLevelData =
  | CursorSizeLevelData
  | ElectricShockLevelData
  | StaticDischargeLevelData
  | MagnetLevelData
  | MissileLevelData
  | HealthPackLevelData
  | OrbitingOrbLevelData;

export interface SystemUpgradeData {
  id: string;
  name: string;
  description: string;
  descriptionTemplate?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  effectType: string;
  levels?: SystemUpgradeLevelData[];
  maxStack?: number; // health_pack 등 소모품 전용
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
  minPullDistance: number;
}

export interface ShatterEffectConfig {
  shardCount: number;
  minSize: number;
  maxSize: number;
  energyShardRatio: number;
  gravity: number;
  minVelocity: number;
  maxVelocity: number;
  upwardForce: number;
  minDuration: number;
  maxDuration: number;
  rotationSpeedRange: number;
  sparkCount: number;
  sparkTravelDistance: number;
  sparkDuration: number;
}

// ========== 보스 설정 ==========
export interface BossConfig {
  depth: number;
  visual: {
    core: {
      radius: number;
      color: string;
      initialAlpha: number;
      pulseSpeed: number;
      pulseIntensity: number;
      glowLevels?: Array<{ radius: number; alpha: number }>;
    };
    armor: {
      maxPieces: number;
      radius: number;
      innerRadius: number;
      rotationSpeed: number;
      gap: number;
      bodyColor: string;
      bodyAlpha: number;
      borderColor: string;
      glowAlpha?: number;
      glowWidth?: number;
    };
    shockwave: {
      initialRadius: number;
      maxRadius: number;
      initialAlpha: number;
      duration: number;
    };
    shatter: ShatterEffectConfig;
    breakParticles: {
      count: number;
      radius: number;
      spawnDistance: number;
      travelDistance: number;
      duration: number;
    };
  };
  feedback: {
    damageShake: {
      intensity: number;
      duration: number;
    };
    armorBreakShake: {
      intensity: number;
      duration: number;
    };
    vibrationThreshold: number;
    vibrationIntensity: number;
    hitReaction?: {
      pushDistance: number;
      pushDuration: number;
      pushEase: string;
      shakeDuration: number;
      shakeIntensity: number;
      shakeFrequency: number;
      hitRotation: number;
      returnDuration: number;
      returnEase: string;
      flashDuration: number;
    };
  };
  spawn: {
    y: number;
    duration: number;
    initialScale: number;
  };
  movement: {
    drift: {
      xAmplitude: number;
      xFrequency: number;
      yAmplitude: number;
      yFrequency: number;
    };
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
  };
}

// ========== 다국어 지원 ==========
export interface LocaleData {
  [key: string]: string;
}

export interface LocalesConfig {
  en: LocaleData;
  ko: LocaleData;
}

// ========== 전체 데이터 구조 ==========
export interface GameDataConfig {
  gameConfig: GameConfig;
  mainMenu: MenuConfig;
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
  boss: BossConfig;
  locales: LocalesConfig;
}
