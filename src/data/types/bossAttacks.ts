// ========== 보스 공격 패턴 타입 ==========

export interface BulletSpreadConfig {
  warningDuration: number;
  projectileCount: number;
  projectileSpeed: number;
  projectileSize: number;
  spreadAngleDeg: number;
  projectileLifetime: number;
  damage: number;
  hitboxRadius: number;
  invincibilityDuration: number;
  warningColor: string;
  projectileColor: string;
  projectileCoreColor: string;
}

export interface ShockwaveConfig {
  warningDuration: number;
  ringSpeed: number;
  ringThickness: number;
  maxRadius: number;
  damage: number;
  hitboxThickness: number;
  invincibilityDuration: number;
  warningColor: string;
  ringColor: string;
  ringCoreColor: string;
}

export interface DangerZoneConfig {
  warningDuration: number;
  zoneCount: { min: number; max: number };
  zoneRadius: { min: number; max: number };
  explosionDuration: number;
  damage: number;
  invincibilityDuration: number;
  spawnPadding: number;
  warningColor: string;
  explosionColor: string;
  explosionCoreColor: string;
}

export interface BossAttacksConfig {
  bulletSpread: BulletSpreadConfig;
  shockwave: ShockwaveConfig;
  dangerZone: DangerZoneConfig;
}

/** 웨이브별 보스 공격 활성화 설정 */
export interface WaveBossAttackEntry {
  enabled: boolean;
  minInterval: number;
  maxInterval: number;
}

export interface WaveBossAttacksConfig {
  bulletSpread?: WaveBossAttackEntry;
  shockwave?: WaveBossAttackEntry;
  dangerZone?: WaveBossAttackEntry;
}

export type BossAttackType = 'bulletSpread' | 'shockwave' | 'dangerZone';
