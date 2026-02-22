import { describe, it, expect } from 'vitest';
import type { CursorSmoothingConfig } from '../src/data/types';
import { computeCursorSmoothing } from '../src/utils/cursorSmoothing';

const DEFAULT_CONFIG: CursorSmoothingConfig = {
  halfLifeMs: 22.6,
  keyboardHalfLifeMs: 8,
  snapThreshold: 175,
  convergenceThreshold: 0.5,
  deadZone: 2.5,
};

const FRAME_16 = 16.67; // ~60fps

describe('computeCursorSmoothing', () => {
  it('거리=0 → snap to target', () => {
    const result = computeCursorSmoothing(100, 100, 100, 100, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
    expect(result.snapped).toBe(true);
  });

  it('거리=snapThreshold → 즉시 snap', () => {
    const result = computeCursorSmoothing(0, 0, 175, 0, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBe(175);
    expect(result.y).toBe(0);
    expect(result.snapped).toBe(true);
  });

  it('거리 > snapThreshold → 즉시 snap', () => {
    const result = computeCursorSmoothing(0, 0, 500, 0, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBe(500);
    expect(result.y).toBe(0);
    expect(result.snapped).toBe(true);
  });

  it('중간 거리에서 부분적 스무딩 적용', () => {
    const result = computeCursorSmoothing(0, 0, 50, 0, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(50);
    expect(result.snapped).toBe(false);
  });

  it('convergenceThreshold 이하 → 즉시 snap', () => {
    const result = computeCursorSmoothing(100, 100, 100.3, 100, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBe(100.3);
    expect(result.y).toBe(100);
    expect(result.snapped).toBe(true);
  });

  it('deadZone 이내 → snap to target (not stuck)', () => {
    const result = computeCursorSmoothing(100, 100, 102, 100, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBe(102);
    expect(result.y).toBe(100);
    expect(result.snapped).toBe(true);
  });

  it('프레임 독립: 16.67ms×2 === 33.34ms×1 (고정 감쇠율)', () => {
    const distance = 80;
    const twoDelta = 16.67 * 2; // 33.34
    const result33 = computeCursorSmoothing(0, 0, distance, 0, twoDelta, DEFAULT_CONFIG);

    // 두 프레임의 16.67ms를 연속 적용
    const step1 = computeCursorSmoothing(0, 0, distance, 0, 16.67, DEFAULT_CONFIG);
    const step2 = computeCursorSmoothing(step1.x, 0, distance, 0, 16.67, DEFAULT_CONFIG);

    // 고정 감쇠율이므로 수학적으로 정확히 일치해야 함
    expect(step2.x).toBeCloseTo(result33.x, 10);
  });

  it('2D 대각선 이동에서도 올바르게 동작', () => {
    const result = computeCursorSmoothing(0, 0, 100, 100, FRAME_16, DEFAULT_CONFIG);
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.x).toBeCloseTo(result.y, 5);
  });

  it('halfLifeMs 값에 따라 스무딩 강도 변화', () => {
    const fastConfig: CursorSmoothingConfig = { ...DEFAULT_CONFIG, halfLifeMs: 10 };
    const slowConfig: CursorSmoothingConfig = { ...DEFAULT_CONFIG, halfLifeMs: 50 };
    const distance = 50;

    const fastResult = computeCursorSmoothing(0, 0, distance, 0, FRAME_16, fastConfig);
    const slowResult = computeCursorSmoothing(0, 0, distance, 0, FRAME_16, slowConfig);

    // 낮은 halfLifeMs → 더 빠르게 목표에 도달
    expect(fastResult.x).toBeGreaterThan(slowResult.x);
  });

  it('연속 프레임 수렴 테스트: 100프레임 후 목표 도달', () => {
    let cx = 0;
    let cy = 0;
    const tx = 200;
    const ty = 150;

    for (let i = 0; i < 100; i++) {
      const result = computeCursorSmoothing(cx, cy, tx, ty, FRAME_16, DEFAULT_CONFIG);
      cx = result.x;
      cy = result.y;
    }

    expect(cx).toBeCloseTo(tx, 1);
    expect(cy).toBeCloseTo(ty, 1);
  });

  it('delta=0 → 현재 위치 유지', () => {
    const result = computeCursorSmoothing(50, 50, 200, 200, 0, DEFAULT_CONFIG);
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
    expect(result.snapped).toBe(false);
  });

  it('delta=5000ms (탭 전환 후 복귀) → 안전하게 보간', () => {
    const result = computeCursorSmoothing(0, 0, 100, 0, 5000, DEFAULT_CONFIG);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(result.x).toBeCloseTo(100, 1);
  });
});
