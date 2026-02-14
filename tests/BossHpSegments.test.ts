import { describe, expect, it } from 'vitest';
import { resolveBossHpSegmentState } from '../src/plugins/builtin/entities/bossHpSegments';

const HP_SCALE_100 = {
  minPieces: 1,
  maxPieces: 9999,
  targetHpPerPiece: 100,
} as const;

describe('resolveBossHpSegmentState', () => {
  it('uses default piece count when hp scaling config is absent', () => {
    const state = resolveBossHpSegmentState(50, 100, {
      defaultPieces: 10,
    });

    expect(state.pieceCount).toBe(10);
    expect(state.hpPerPiece).toBe(10);
    expect(state.filledPieces).toBe(5);
  });

  it('creates one slot per 100 hp', () => {
    const state = resolveBossHpSegmentState(380, 380, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    expect(state.pieceCount).toBe(4);
    expect(state.hpPerPiece).toBe(100);
    expect(state.filledPieces).toBe(4);
  });

  it('rounds up slot count when hp has remainder', () => {
    const state = resolveBossHpSegmentState(300, 300, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    const roundedUp = resolveBossHpSegmentState(301, 301, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    expect(state.pieceCount).toBe(3);
    expect(roundedUp.pieceCount).toBe(4);
    expect(roundedUp.hpPerPiece).toBe(100);
    expect(roundedUp.filledPieces).toBe(4);
  });

  it('reduces filled slots every 100 hp', () => {
    const state = resolveBossHpSegmentState(3840, 3840, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    const afterDamage = resolveBossHpSegmentState(3800, 3840, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    expect(state.pieceCount).toBe(39);
    expect(state.filledPieces).toBe(39);
    expect(afterDamage.filledPieces).toBe(38);
  });

  it('keeps at least one filled piece until hp reaches zero', () => {
    const state = resolveBossHpSegmentState(1, 960, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    expect(state.filledPieces).toBe(1);
  });

  it('returns zero filled pieces when hp is depleted', () => {
    const state = resolveBossHpSegmentState(0, 960, {
      defaultPieces: 10,
      hpScale: HP_SCALE_100,
    });

    expect(state.filledPieces).toBe(0);
  });
});
