import Phaser from 'phaser';
import { COLORS } from '../data/constants';
import { Data } from '../data/DataManager';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { SlowMotion } from '../effects/SlowMotion';
import { DamageText } from '../ui/DamageText';
import { SoundSystem } from './SoundSystem';

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
    soundSystem: SoundSystem
  ) {
    this.particleManager = particleManager;
    this.screenShake = screenShake;
    this.slowMotion = slowMotion;
    this.damageText = damageText;
    this.soundSystem = soundSystem;
  }

  onDishDestroyed(
    x: number,
    y: number,
    color: number,
    dishType: string,
    combo: number = 0,
    cursorRadius: number = 0
  ): void {
    // 파티클 폭발
    this.particleManager.createExplosion(x, y, color, dishType);

    // 에너지 획득 연출 (게이지로 날아가는 효과)
    // 지뢰가 아닐 때만 발생
    if (dishType !== 'bomb') {
      this.particleManager.createEnergyEffect(x, y, combo, cursorRadius);
    }

    // 화면 흔들림 (접시 타입에 따라 강도 조절)
    const baseShake = dishType === 'bomb' ? 10 : dishType === 'golden' ? 6 : 4;
    this.screenShake.shake(baseShake, 100);

    // 파괴 사운드 재생
    this.soundSystem.playDestroySound(dishType);
  }

  onComboMilestone(milestone: number): void {
    // 콤보 마일스톤별 피드백 (JSON에서 로드)
    const effect = Data.getComboMilestoneEffect(milestone);

    if (effect) {
      this.screenShake.shake(effect.shake, effect.shakeDuration);

      if (effect.slowMotion !== undefined && effect.slowDuration !== undefined) {
        this.slowMotion.trigger(effect.slowMotion, effect.slowDuration);
      }
    }

    // 콤보 사운드 재생
    this.soundSystem.playComboSound(milestone);
  }

  onDishDamaged(
    x: number,
    y: number,
    damage: number,
    hpRatio: number,
    color: number,
    combo: number = 0
  ): void {
    // 데미지 텍스트
    this.damageText.showDamage(x, y - 20, damage, 'normal', combo);

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

  onCriticalHit(x: number, y: number, damage: number, combo: number = 0): void {
    // 크리티컬 히트 피드백
    this.damageText.showDamage(x, y, damage, 'critical', combo);
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

  // 정전기 방출 효과 (단일 대상 번개)
  onStaticDischarge(x: number, y: number, targetX: number, targetY: number): void {
    this.particleManager.createElectricEffect(x, y, [{ x: targetX, y: targetY }]);
    this.screenShake.shake(3, 50);
  }

  // 보스 데미지 피드백
  onBossDamaged(x: number, y: number, damage: number): void {
    // 1. 크고 화려한 데미지 텍스트
    this.damageText.showBossDamage(x, y, damage);

    // 2. 강한 화면 흔들림
    this.screenShake.shake(8, 200);

    // 3. 화려한 폭발 파티클
    this.particleManager.createExplosion(x, y, COLORS.RED, 'bomb', 1.5);
    this.particleManager.createRainbowExplosion(x, y, 1.2);

    // 4. 슬로우 모션 (짧게)
    this.slowMotion.trigger(0.3, 150);

    // 5. 사운드
    this.soundSystem.playBossImpactSound();
  }

  // 보스 아머 파괴 피드백
  onBossArmorBreak(x: number, y: number, innerRadius: number, outerRadius: number, bodyColor: number): void {
    // 1. 화면 효과: 강한 흔들림
    const feedback = Data.boss.feedback.armorBreakShake;
    this.screenShake.shake(feedback.intensity * 1000, feedback.duration); // intensity 보정 필요 (shake intensity vs pixels)

    // 2. 사운드 효과: 묵직한 폭발음
    this.soundSystem.playBossImpactSound();

    // 3. 충격파 연출 (Expanding Ring)
    const config = Data.boss.visual;
    const sw = config.shockwave;
    this.particleManager.createShieldEffect(x, y, COLORS.WHITE); // 기존 ShieldEffect 활용 또는 별도 충격파 구현

    // 4. 게이지 파편 shattering & falling 효과
    this.particleManager.createBossGaugeShatter(x, y, innerRadius, outerRadius, bodyColor);
  }
}
