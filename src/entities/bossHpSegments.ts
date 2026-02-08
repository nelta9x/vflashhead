export interface BossHpSegmentScaleConfig {
  minPieces: number;
  maxPieces: number;
  targetHpPerPiece: number;
}

export interface BossHpSegmentConfig {
  defaultPieces: number;
  hpScale?: BossHpSegmentScaleConfig;
}

export interface BossHpSegmentState {
  pieceCount: number;
  hpPerPiece: number;
  filledPieces: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toWhole(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.floor(value);
}

export function resolveBossHpSegmentState(
  currentHp: number,
  maxHp: number,
  config: BossHpSegmentConfig
): BossHpSegmentState {
  const defaultPieces = Math.max(1, toWhole(config.defaultPieces, 1));
  const normalizedMaxHp = Math.max(0, toWhole(maxHp, 0));

  if (normalizedMaxHp <= 0) {
    return {
      pieceCount: defaultPieces,
      hpPerPiece: 1,
      filledPieces: 0,
    };
  }

  let pieceCount = defaultPieces;
  let hpPerPiece = Math.max(1, Math.ceil(normalizedMaxHp / defaultPieces));
  if (config.hpScale) {
    const minPieces = Math.max(1, toWhole(config.hpScale.minPieces, defaultPieces));
    const maxPieces = Math.max(minPieces, toWhole(config.hpScale.maxPieces, minPieces));
    const targetHpPerPiece = Math.max(1, toWhole(config.hpScale.targetHpPerPiece, 1));
    const desiredPieces = Math.ceil(normalizedMaxHp / targetHpPerPiece);
    pieceCount = clamp(desiredPieces, minPieces, maxPieces);
    hpPerPiece = targetHpPerPiece;
  }

  const normalizedCurrentHp = clamp(toWhole(currentHp, 0), 0, normalizedMaxHp);
  const filledPieces =
    normalizedCurrentHp <= 0 ? 0 : clamp(Math.ceil(normalizedCurrentHp / hpPerPiece), 0, pieceCount);

  return {
    pieceCount,
    hpPerPiece,
    filledPieces,
  };
}
