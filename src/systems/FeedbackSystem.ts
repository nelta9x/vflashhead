import Phaser from 'phaser';
import { COLORS } from '../data/constants';
import { Data } from '../data/DataManager';
import { ParticleManager } from '../effects/ParticleManager';
import { ScreenShake } from '../effects/ScreenShake';
import { DamageText } from '../ui/DamageText';
import { SoundSystem } from './SoundSystem';

export class FeedbackSystem {
  private particleManager: ParticleManager;
  private screenShake: ScreenShake;
  private damageText: DamageText;
  private soundSystem: SoundSystem;

  constructor(
    _scene: Phaser.Scene,
    particleManager: ParticleManager,
    screenShake: ScreenShake,
    damageText: DamageText,
    soundSystem: SoundSystem
  ) {
    this.particleManager = particleManager;
    this.screenShake = screenShake;
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

    const shakeKey = dishType === 'bomb' ? 'bombDestroyed' : dishType === 'golden' ? 'goldenDestroyed' : 'dishDestroyed';
    const shake = Data.feedback.shakePresets[shakeKey];
    if (shake) this.screenShake.shake(shake.intensity, shake.duration);

    // 파괴 사운드 재생
    this.soundSystem.playDestroySound(dishType);
  }

  onComboMilestone(milestone: number): void {
    // 콤보 마일스톤별 피드백 (JSON에서 로드)
    const effect = Data.getComboMilestoneEffect(milestone);

    if (effect) {
      this.screenShake.shake(effect.shake, effect.shakeDuration);
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

    const damageShake = Data.feedback.shakePresets['dishDamaged'];
    if (damageShake) this.screenShake.shake(damageShake.intensity, damageShake.duration);

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
    const critShake = Data.feedback.shakePresets['criticalHit'];
    if (critShake) this.screenShake.shake(critShake.intensity, critShake.duration);
    this.particleManager.createCriticalEffect(x, y);
  }

  onDishMissed(x: number, y: number, color: number, type: string): void {
    // 일반 접시 놓침: 부정 피드백
    this.damageText.showText(x, y, Data.t('feedback.miss'), COLORS.RED);
    const missShake = Data.feedback.shakePresets['dishMissed'];
    if (missShake) this.screenShake.shake(missShake.intensity, missShake.duration);
    // 작은 파티클 (접시 색상)
    this.particleManager.createExplosion(x, y, color, type);
    // 놓침 사운드
    this.soundSystem.playMissSound();
  }

  onBombExploded(x: number, y: number, isRemoved: boolean = false): void {
    // 지뢰 폭발: 강한 부정 피드백
    // 어빌리티로 제거된 경우 BOOM! 텍스트와 강한 흔들림/폭발음 생략, REMOVED! 텍스트와 약한 흔들림만 적용
    if (!isRemoved) {
      this.damageText.showText(x, y, Data.t('feedback.bomb_exploded'), COLORS.RED);
      const bombShake = Data.feedback.shakePresets['bombExploded'];
      if (bombShake) this.screenShake.shake(bombShake.intensity, bombShake.duration);
      this.soundSystem.playDestroySound('bomb');
    } else {
      const removedShake = Data.feedback.shakePresets['bombRemoved'];
      if (removedShake) this.screenShake.shake(removedShake.intensity, removedShake.duration);
    }
    
    // 폭발 파티클 (제거 시에도 시각적 효과는 유지하되 양 조절 고려 가능하나 일단 유지)
    this.particleManager.createExplosion(x, y, COLORS.RED, 'bomb');
  }

  onHpLost(): void {
    const hpShake = Data.feedback.shakePresets['hpLost'];
    if (hpShake) this.screenShake.shake(hpShake.intensity, hpShake.duration);
  }

  onHealthPackCollected(x: number, y: number): void {
    // +1 HP 텍스트 표시 (초록색)
    this.damageText.showText(x, y, '+1 HP', COLORS.GREEN);
    // 힐 파티클 이펙트
    this.particleManager.createHealEffect(x, y, COLORS.GREEN);
    // 힐 사운드
    this.soundSystem.playHealSound();
  }

  onHealthPackPassing(x: number, y: number): void {
    this.damageText.showShakingText(
      x,
      y + Data.healthPack.preMissWarningTextOffsetY,
      Data.t('feedback.health_pack_passing'),
      COLORS.GREEN
    );
  }

  // 전기 충격 효과 (업그레이드용)
  onElectricShock(x: number, y: number, targets: { x: number; y: number }[]): void {
    this.particleManager.createElectricEffect(x, y, targets);
    const electricShake = Data.feedback.shakePresets['electricShock'];
    if (electricShake) this.screenShake.shake(electricShake.intensity, electricShake.duration);
  }

  // 보스 데미지 피드백
  onBossDamaged(x: number, y: number, damage: number, isCritical: boolean = false): void {
    // 1. 데미지 텍스트 (치명타면 크리티컬 효과, 아니면 보스 데미지 효과)
    if (isCritical) {
      this.onCriticalHit(x, y, damage);
    } else {
      this.damageText.showBossDamage(x, y, damage);
    }

    const bossShake = Data.feedback.shakePresets[isCritical ? 'bossCritical' : 'bossDamaged'];
    if (bossShake) this.screenShake.shake(bossShake.intensity, bossShake.duration);

    // 3. 화려한 폭발 파티클
    this.particleManager.createExplosion(x, y, isCritical ? COLORS.YELLOW : COLORS.RED, 'bomb', isCritical ? 2.0 : 1.5);
    if (isCritical) {
      this.particleManager.createRainbowExplosion(x, y, 1.5);
    }

    // 4. 사운드
    this.soundSystem.playBossImpactSound();
  }

  // 보스 겹침 데미지 피드백 (텍스트 중심, 과한 연출/사운드 없음)
  onBossContactDamaged(x: number, y: number, damage: number, isCritical: boolean = false): void {
    this.damageText.showDamage(x, y, damage, isCritical ? 'critical' : 'normal');
  }

  // 보스 아머 파괴 피드백
  onBossArmorBreak(
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    bodyColor: number
  ): void {
    // 1. 화면 효과: 강한 흔들림
    const feedback = Data.boss.feedback.armorBreakShake;
    this.screenShake.shake(feedback.intensity * 1000, feedback.duration); // intensity 보정 필요 (shake intensity vs pixels)

    // 2. 사운드 효과: 묵직한 폭발음
    this.soundSystem.playBossImpactSound();

    // 3. 충격파 연출 (Expanding Ring)
    this.particleManager.createShieldEffect(x, y, COLORS.WHITE); // 기존 ShieldEffect 활용 또는 별도 충격파 구현

    // 4. 게이지 파편 shattering & falling 효과
    this.particleManager.createBossGaugeShatter(x, y, innerRadius, outerRadius, bodyColor);
  }
}
