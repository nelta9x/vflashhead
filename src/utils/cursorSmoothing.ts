import type { CursorSmoothingConfig } from '../data/types';

export interface SmoothingResult {
  x: number;
  y: number;
  snapped: boolean;
  skipped: boolean;
}

/**
 * 적응형 커서 스무딩 계산 (순수 함수)
 *
 * @param currentX 현재 커서 X
 * @param currentY 현재 커서 Y
 * @param targetX 목표 커서 X
 * @param targetY 목표 커서 Y
 * @param delta 프레임 델타(ms)
 * @param config 스무딩 설정
 * @returns 스무딩 적용된 새 위치
 */
export function computeCursorSmoothing(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  delta: number,
  config: CursorSmoothingConfig
): SmoothingResult {
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // convergenceThreshold 이하 → 즉시 snap
  if (distance <= config.convergenceThreshold) {
    return { x: targetX, y: targetY, snapped: true, skipped: false };
  }

  // deadZone 이내 → 이동 건너뜀
  if (distance <= config.deadZone) {
    return { x: currentX, y: currentY, snapped: false, skipped: true };
  }

  // 적응형 lerp: 거리가 멀수록 factor → 1.0
  const rawFactor = config.baseLerp +
    (1 - config.baseLerp) * Math.min(Math.max(distance / config.snapThreshold, 0), 1);

  // 프레임 독립 보정
  const smoothFactor = 1 - Math.pow(1 - rawFactor, delta / 16.67);

  return {
    x: currentX + dx * smoothFactor,
    y: currentY + dy * smoothFactor,
    snapped: false,
    skipped: false,
  };
}
