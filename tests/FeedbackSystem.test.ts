import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Display: {
      Color: {
        HexStringToColor: (hex: string) => ({ color: parseInt(hex.replace('#', ''), 16) }),
      },
    },
  },
}));

vi.mock('../src/data/DataManager', () => ({
  Data: {
    feedback: {
      shakePresets: {
        hpLost: { intensity: 12, duration: 200 },
      },
      playerHit: {
        sparkColor: '#ff4444',
      },
    },
  },
}));

vi.mock('../src/data/constants', () => ({
  COLORS: { RED: 0xff0044 },
}));

import { FeedbackSystem } from '../src/plugins/builtin/services/FeedbackSystem';

describe('FeedbackSystem', () => {
  let system: FeedbackSystem;
  let mockParticleManager: { createSparkBurst: ReturnType<typeof vi.fn>; createPlayerHitDebris: ReturnType<typeof vi.fn> };
  let mockScreenShake: { shake: ReturnType<typeof vi.fn> };
  let mockDamageText: Record<string, unknown>;
  let mockSoundSystem: Record<string, unknown>;

  beforeEach(() => {
    mockParticleManager = { createSparkBurst: vi.fn(), createPlayerHitDebris: vi.fn() };
    mockScreenShake = { shake: vi.fn() };
    mockDamageText = {};
    mockSoundSystem = {};

    system = new FeedbackSystem(
      {} as never,
      mockParticleManager as never,
      mockScreenShake as never,
      mockDamageText as never,
      mockSoundSystem as never,
    );
  });

  describe('onPlayerHit', () => {
    it('should create spark burst and debris at the given position', () => {
      system.onPlayerHit(100, 200);

      expect(mockParticleManager.createSparkBurst).toHaveBeenCalledTimes(1);
      expect(mockParticleManager.createSparkBurst).toHaveBeenCalledWith(
        100, 200, 0xff4444,
      );
      expect(mockParticleManager.createPlayerHitDebris).toHaveBeenCalledTimes(1);
      expect(mockParticleManager.createPlayerHitDebris).toHaveBeenCalledWith(
        100, 200, 0xff4444,
      );
    });

    it('should NOT trigger screen shake (HP_CHANGED path handles it)', () => {
      system.onPlayerHit(100, 200);

      expect(mockScreenShake.shake).not.toHaveBeenCalled();
    });

    it('should cache sparkColor after first call', () => {
      system.onPlayerHit(100, 200);
      system.onPlayerHit(300, 400);

      expect(mockParticleManager.createSparkBurst).toHaveBeenCalledTimes(2);
      // Both calls should use the same cached color
      const color1 = mockParticleManager.createSparkBurst.mock.calls[0][2];
      const color2 = mockParticleManager.createSparkBurst.mock.calls[1][2];
      expect(color1).toBe(color2);
    });
  });

  describe('onHpLost', () => {
    it('should trigger screen shake from hpLost preset', () => {
      system.onHpLost();

      expect(mockScreenShake.shake).toHaveBeenCalledWith(12, 200);
    });
  });
});
