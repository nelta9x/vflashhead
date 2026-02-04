import Phaser from 'phaser';
import { COLORS } from '../config/constants';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { SlowMotion } from '../effects/SlowMotion';
import { DamageText } from '../ui/DamageText';
import { SoundSystem } from './SoundSystem';
import { UpgradeSystem } from './UpgradeSystem';

export class FeedbackSystem {
  private particleManager: ParticleManager;
  private screenShake: ScreenShake;
  private slowMotion: SlowMotion;
  private damageText: DamageText;
  private soundSystem: SoundSystem;

  constructor(
    _scene: Phaser.Scene,
    particleManager: ParticleManager,
    screenShake: ScreenShake,
    slowMotion: SlowMotion,
    damageText: DamageText,
    soundSystem: SoundSystem,
    _upgradeSystem: UpgradeSystem
  ) {
    this.particleManager = particleManager;
    this.screenShake = screenShake;
    this.slowMotion = slowMotion;
    this.damageText = damageText;
    this.soundSystem = soundSystem;
  }

  onDishDestroyed(x: number, y: number, color: number, dishType: string): void {
    // 파티클 폭발
    this.particleManager.createExplosion(x, y, color, dishType);

    // 화면 흔들림 (접시 타입에 따라 강도 조절)
    const baseShake = dishType === 'bomb' ? 10 : dishType === 'golden' ? 6 : 4;
    this.screenShake.shake(baseShake, 100);

    // 파괴 사운드 재생
    this.soundSystem.playDestroySound(dishType);
  }

  onComboMilestone(milestone: number): void {
    // 콤보 마일스톤별 피드백
    switch (milestone) {
      case 5:
        this.screenShake.shake(3, 150);
        break;
      case 10:
        this.screenShake.shake(5, 200);
        this.slowMotion.trigger(0.3, 500);
        break;
      case 25:
        this.screenShake.shake(8, 250);
        this.slowMotion.trigger(0.2, 800);
        break;
      case 50:
        this.screenShake.shake(12, 300);
        this.slowMotion.trigger(0.1, 1000);
        break;
      case 100:
        this.screenShake.shake(15, 400);
        this.slowMotion.trigger(0.05, 1500);
        break;
    }

    // 콤보 사운드 재생
    this.soundSystem.playComboSound(milestone);
  }

  onDishDamaged(x: number, y: number, damage: number, hpRatio: number, color: number): void {
    // 데미지 텍스트
    this.damageText.showText(x, y - 20, `-${damage}`, COLORS.WHITE);

    // 히트 파티클
    this.particleManager.createHitEffect(x, y, color);

    // 미세 화면 흔들림
    this.screenShake.shake(2, 50);

    // 낮은 HP 시 추가 스파크 (30% 미만)
    if (hpRatio < 0.3) {
      this.particleManager.createSparkBurst(x, y, COLORS.RED);
    }

    // 히트 사운드
    this.soundSystem.playHitSound();
  }

  onCriticalHit(x: number, y: number, damage: number): void {
    // 크리티컬 히트 피드백
    this.damageText.showCritical(x, y, damage);
    this.screenShake.shake(4, 80);
    this.particleManager.createCriticalEffect(x, y);
  }

  onDishMissed(x: number, y: number, color: number, type: string): void {
    // 일반 접시 놓침: 부정 피드백
    this.damageText.showText(x, y, 'MISS!', 0xff0044);
    // 화면 흔들림
    this.screenShake.shake(6, 150);
    // 작은 파티클 (접시 색상)
    this.particleManager.createExplosion(x, y, color, type);
    // 놓침 사운드
    this.soundSystem.playMissSound();
  }

  onBombExploded(x: number, y: number): void {
    // 지뢰 폭발: 강한 부정 피드백
    this.damageText.showText(x, y, 'BOOM!', 0xff0044);
    // 강한 화면 흔들림
    this.screenShake.shake(15, 250);
    // 폭발 파티클
    this.particleManager.createExplosion(x, y, 0xff0044, 'bomb');
    // 슬로우모션
    this.slowMotion.trigger(0.3, 300);
    // 폭발 사운드
    this.soundSystem.playDestroySound('bomb');
  }

  onHpLost(): void {
    // 강한 화면 흔들림
    this.screenShake.shake(12, 200);
    // 짧은 슬로우모션
    this.slowMotion.trigger(0.5, 200);
  }

  onHealthPackCollected(x: number, y: number): void {
    // +1 HP 텍스트 표시 (초록색)
    this.damageText.showText(x, y, '+1 HP', COLORS.GREEN);
    // 힐 파티클 이펙트
    this.particleManager.createHealEffect(x, y, COLORS.GREEN);
    // 힐 사운드
    this.soundSystem.playHealSound();
  }

  // 전기 충격 효과 (업그레이드용)
  onElectricShock(x: number, y: number, targets: { x: number; y: number }[]): void {
    this.particleManager.createElectricEffect(x, y, targets);
    this.screenShake.shake(5, 100);
  }

  // 냉동 오라 효과 (업그레이드용)
  onFreezeAura(x: number, y: number, radius: number): void {
    this.particleManager.createFreezeEffect(x, y, radius);
  }

  // 자석 효과 (업그레이드용)
  onMagnetPull(x: number, y: number, targets: { x: number; y: number }[]): void {
    this.particleManager.createMagnetEffect(x, y, targets);
  }

  // 블랙홀 효과 (업그레이드용)
  onBlackHole(x: number, y: number, callback?: () => void): void {
    this.particleManager.createBlackHoleEffect(x, y, callback);
    this.slowMotion.trigger(0.2, 600);
    this.screenShake.shake(10, 500);
  }

  // 부활 효과
  onRevive(): void {
    // 화면 흔들림
    this.screenShake.shake(8, 300);
    // 슬로우모션
    this.slowMotion.trigger(0.3, 500);
  }

  // 폭탄 방어막 사용 효과
  onBombShieldUsed(x: number, y: number): void {
    this.damageText.showText(x, y, 'BLOCKED!', COLORS.CYAN);
    this.particleManager.createShieldEffect(x, y, COLORS.CYAN);
    this.screenShake.shake(4, 100);
  }

  // 생명력 흡수 효과
  onLifesteal(x: number, y: number): void {
    this.damageText.showText(x, y, '+1', COLORS.GREEN);
    this.particleManager.createHealEffect(x, y, COLORS.GREEN);
  }

  // 폭탄 전환 힐 효과
  onBombConvertHeal(x: number, y: number): void {
    this.damageText.showText(x, y, '+1 HP', COLORS.GREEN);
    this.particleManager.createHealEffect(x, y, COLORS.GREEN);
  }

  // 두 번째 기회 효과
  onSecondChance(x: number, y: number): void {
    this.damageText.showText(x, y, 'SECOND CHANCE!', COLORS.YELLOW);
    this.particleManager.createSparkBurst(x, y, COLORS.YELLOW);
  }

  // 시간 정지 효과
  onTimeStop(): void {
    this.slowMotion.trigger(0.1, 1000);
  }

  // 자동 파괴 효과
  onAutoDestroy(x: number, y: number): void {
    this.damageText.showText(x, y, 'AUTO!', COLORS.MAGENTA);
    this.particleManager.createSparkBurst(x, y, COLORS.MAGENTA);
    this.screenShake.shake(3, 80);
  }
}
