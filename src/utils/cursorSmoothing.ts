import type { CursorSmoothingConfig } from '../data/types';

export interface SmoothingResult {
  x: number;
  y: number;
  snapped: boolean;
}

/**
 * 프레임 독립 지수 감쇠 커서 스무딩 (순수 함수)
 *
 * halfLifeMs 기반: FPS와 무관하게 동일 시간 후 동일 위치에 도달.
 * smoothFactor = 1 - 2^(-delta / halfLifeMs)
 */
export function computeCursorSmoothing(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  delta: number,
  config: CursorSmoothingConfig
): SmoothingResult {
  if (delta <= 0) {
    return { x: currentX, y: currentY, snapped: false };
  }

  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const snapRadius = Math.max(config.convergenceThreshold, config.deadZone);
  if (distance <= snapRadius) {
    return { x: targetX, y: targetY, snapped: true };
  }

  // snapThreshold 이상 → 즉시 snap
  if (distance >= config.snapThreshold) {
    return { x: targetX, y: targetY, snapped: true };
  }

  // 프레임 독립 지수 감쇠: halfLifeMs마다 남은 거리가 절반
  const smoothFactor = 1 - Math.pow(2, -delta / config.halfLifeMs);

  return {
    x: currentX + dx * smoothFactor,
    y: currentY + dy * smoothFactor,
    snapped: false,
  };
}
