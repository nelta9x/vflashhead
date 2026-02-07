import Phaser from 'phaser';
import { COLORS, CURSOR_HITBOX } from '../data/constants';
import { Data } from '../data/DataManager';
import { Poolable } from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';

interface DishConfig {
  points: number;
  lifetime: number;
  color: number;
  chainReaction?: boolean;
  dangerous?: boolean;
  hp: number;
  invulnerable?: boolean;
  size: number;
}

// 업그레이드 옵션 인터페이스
export interface DishUpgradeOptions {
  damageBonus?: number;
  attackSpeedMultiplier?: number;
  criticalChance?: number;
  globalSlowPercent?: number;
  cursorSizeBonus?: number;
}

// JSON에서 접시 설정 로드
function getDishConfig(type: string): DishConfig {
  const dishData = Data.getDishData(type);
  if (!dishData) {
    // 폴백: basic 사용
    const basicData = Data.dishes.dishes.basic;
    return {
      points: basicData.points,
      lifetime: basicData.lifetime,
      color: parseInt(basicData.color.replace('#', ''), 16),
      chainReaction: basicData.chainReaction,
      dangerous: basicData.dangerous,
      hp: basicData.hp,
      invulnerable: basicData.invulnerable,
      size: basicData.size,
    };
  }

  return {
    points: dishData.points,
    lifetime: dishData.lifetime,
    color: parseInt(dishData.color.replace('#', ''), 16),
    chainReaction: dishData.chainReaction,
    dangerous: dishData.dangerous,
    hp: dishData.hp,
    invulnerable: dishData.invulnerable,
    size: dishData.size,
  };
}

export class Dish extends Phaser.GameObjects.Container implements Poolable {
  active: boolean = false;
  private graphics: Phaser.GameObjects.Graphics;
  private dishType: string = 'basic';
  private points: number = 100;
  private lifetime: number = 2000;
  private elapsedTime: number = 0;
  private color: number = COLORS.CYAN;
  private chainReaction: boolean = false;
  private dangerous: boolean = false;
  private wobblePhase: number = 0;
  private size: number = 30;
  private isHovered: boolean = false;
  private blinkPhase: number = 0;

  // 스폰 정보
  private spawnDuration: number = 150;

  // HP 시스템
  private currentHp: number = 3;
  private maxHp: number = 3;
  private damageTimer: Phaser.Time.TimerEvent | null = null;
  private isBeingDamaged: boolean = false;
  private hitFlashPhase: number = 0;
  private invulnerable: boolean = false;

  // 자기장 효과
  private isBeingPulled: boolean = false;
  private pullPhase: number = 0;

  // 상태 효과
  private slowFactor: number = 1.0;
  private slowEndTime: number = 0;
  private isFrozen: boolean = false;

  // 어빌리티에 의한 파괴 여부
  private destroyedByAbility: boolean = false;

  // 업그레이드 효과
  private upgradeOptions: DishUpgradeOptions = {};
  private damageInterval: number = Data.dishes.damage.damageInterval;
  private interactiveRadius: number = 40;

  constructor(scene: Phaser.Scene, x: number, y: number, _type: string = 'basic') {
    super(scene, x, y);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // 물리 바디 설정
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(30);
    body.setOffset(-30, -30);

    this.setVisible(false);
    this.setActive(false);
  }

  reset(): void {
    this.wobblePhase = 0;
    this.blinkPhase = 0;
    this.elapsedTime = 0;
    this.isHovered = false;
    this.hitFlashPhase = 0;
    this.isBeingDamaged = false;
    this.isBeingPulled = false;
    this.pullPhase = 0;
    this.clearDamageTimer();
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
  }

  setBeingPulled(pulled: boolean): void {
    this.isBeingPulled = pulled;
  }

  spawn(
    x: number,
    y: number,
    type: string,
    _speedMultiplier: number = 1,
    options: DishUpgradeOptions = {}
  ): void {
    this.dishType = type;
    const config = getDishConfig(type);
    const dishData = Data.getDishData(type);

    this.points = config.points;
    this.lifetime = config.lifetime;
    this.elapsedTime = 0;
    this.blinkPhase = 0;
    this.hitFlashPhase = 0;
    this.color = config.color;
    this.chainReaction = config.chainReaction || false;
    this.destroyedByAbility = false;
    this.dangerous = config.dangerous || false;
    this.invulnerable = config.invulnerable || false;
    this.active = true;
    this.isHovered = false;
    this.isBeingDamaged = false;

    // HP 설정
    this.maxHp = config.hp;
    this.currentHp = config.hp;

    // 업그레이드 옵션 저장
    this.upgradeOptions = options;

    // 공격 속도 계산
    const attackSpeedMultiplier = options.attackSpeedMultiplier ?? 1;
    this.damageInterval = Data.dishes.damage.damageInterval * attackSpeedMultiplier;

    this.size = config.size;

    // 인터랙티브 반경 계산 (접시 크기 + 커서 히트박스)
    const cursorSizeBonus = options.cursorSizeBonus ?? 0;
    const cursorRadius = CURSOR_HITBOX.BASE_RADIUS * (1 + cursorSizeBonus);
    this.interactiveRadius = this.size + cursorRadius;

    this.setPosition(x, y);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setCircle(this.size);
    body.setOffset(-this.size, -this.size);

    // 정지 상태 (이동 없음)
    body.setVelocity(0, 0);

    // 클릭 가능하게 설정 (업그레이드된 반경 적용)
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, this.interactiveRadius),
      Phaser.Geom.Circle.Contains
    );
    this.setupClickHandlers();

    // 스폰 애니메이션 (JSON에서 로드)
    const spawnAnim = dishData?.spawnAnimation ?? { duration: 150, ease: 'Back.easeOut' };
    this.spawnDuration = spawnAnim.duration;
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: spawnAnim.duration,
      ease: spawnAnim.ease,
    });

    this.drawDish();
    EventBus.getInstance().emit(GameEvents.DISH_SPAWNED, this);
  }

  private setupClickHandlers(): void {
    // 이전 리스너 제거 (Phaser 기본 이벤트는 사용하지 않음)
    this.removeAllListeners();
  }

  // 커서 범위 공격 시스템용 public 메서드
  setInCursorRange(inRange: boolean): void {
    if (inRange && !this.isHovered) {
      this.isHovered = true;

      // Bomb(지뢰)은 즉시 폭발
      if (this.dangerous) {
        this.explodeBomb();
        return;
      }

      this.startDamaging();
    } else if (!inRange && this.isHovered) {
      this.isHovered = false;
      this.stopDamaging();
    }
  }

  isDangerous(): boolean {
    return this.dangerous;
  }

  isFullySpawned(): boolean {
    return this.elapsedTime >= this.spawnDuration;
  }

  private explodeBomb(): void {
    if (!this.active) return;

    this.active = false;
    this.clearDamageTimer();
    this.disableInteractive();
    this.removeAllListeners();

    EventBus.getInstance().emit(GameEvents.DISH_DESTROYED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      chainReaction: false,
    });

    this.deactivate();
  }

  private startDamaging(): void {
    if (this.isBeingDamaged || !this.active) return;
    if (this.invulnerable) return;

    this.isBeingDamaged = true;

    // 첫 접촉: 즉시 데미지
    this.takeDamage(true);

    // 반복 데미지 타이머 시작
    this.damageTimer = this.scene.time.addEvent({
      delay: Data.dishes.damage.damageInterval,
      callback: () => this.takeDamage(false),
      loop: true,
    });
  }

  private stopDamaging(): void {
    this.isBeingDamaged = false;
    this.clearDamageTimer();
  }

  private clearDamageTimer(): void {
    if (this.damageTimer) {
      this.damageTimer.destroy();
      this.damageTimer = null;
    }
  }

  private takeDamage(isFirstHit: boolean): void {
    if (!this.active || this.invulnerable) return;

    // 업그레이드 적용: 기본 데미지 + 보너스 + 치명타
    const damageConfig = Data.dishes.damage;
    const baseDamage = damageConfig.playerDamage;
    const damageBonus = this.upgradeOptions.damageBonus || 0;
    
    // 기본 치명타 확률 + 업그레이드 확률
    const critChance = Math.min(
      1,
      (damageConfig.criticalChance || 0) + (this.upgradeOptions.criticalChance || 0)
    );
    const critMultiplier = damageConfig.criticalMultiplier || 2;

    let damage = baseDamage + damageBonus;
    let isCritical = false;

    // 치명타 판정
    if (Math.random() < critChance) {
      damage *= critMultiplier;
      isCritical = true;
    }

    this.currentHp -= damage;

    // 피격 플래시 트리거
    this.hitFlashPhase = 1;

    // 데미지 이벤트 발생
    EventBus.getInstance().emit(GameEvents.DISH_DAMAGED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      damage,
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      hpRatio: this.currentHp / this.maxHp,
      isFirstHit,
      isCritical,
      byAbility: false,
    });

    // HP가 0 이하면 파괴
    if (this.currentHp <= 0) {
      this.destroy_dish();
    }
  }

  private drawDish(): void {
    this.graphics.clear();

    // 지뢰는 완전히 다른 비주얼
    if (this.dangerous) {
      this.drawMine();
      return;
    }

    const sides = 8;
    const wobble = Math.sin(this.wobblePhase) * 2;

    // 자기장 떨림 효과 (매우 빠른 미세 진동)
    let pullOffsetX = 0;
    let pullOffsetY = 0;
    if (this.isBeingPulled) {
      pullOffsetX = Math.sin(this.pullPhase * 2) * 2;
      pullOffsetY = Math.cos(this.pullPhase * 1.5) * 2;
    }

    // 피격 플래시 적용
    const flashWhite = this.hitFlashPhase > 0 ? this.hitFlashPhase : 0;

    // HP 비율에 따른 색상 변화 (빨간색으로 전환)
    const hpRatio = this.currentHp / this.maxHp;
    let displayColor = this.lerpColor(COLORS.RED, this.color, hpRatio);

    // 냉동 상태면 파란색으로 표시
    if (this.isFrozen) {
      displayColor = 0x88ccff;
    }

    // 자기장 글로우 (보라색/마젠타)
    if (this.isBeingPulled) {
      const magnetAlpha = 0.15; // 깜빡임 없이 고정된 투명도 사용
      this.graphics.fillStyle(COLORS.MAGENTA, magnetAlpha);
      this.graphics.fillCircle(pullOffsetX, pullOffsetY, this.size + 15);
    }

    // 글로우 효과 (호버 시 더 밝게)
    const glowAlpha = this.isHovered ? 0.4 : 0.2;
    this.graphics.fillStyle(displayColor, glowAlpha);
    this.graphics.fillCircle(pullOffsetX, pullOffsetY, this.size + 10 + wobble);

    // 외곽 팔각형
    const fillAlpha = flashWhite > 0 ? 0.7 + flashWhite * 0.3 : 0.7;
    const fillColor =
      flashWhite > 0 ? this.lerpColor(displayColor, COLORS.WHITE, flashWhite) : displayColor;
    this.graphics.fillStyle(fillColor, fillAlpha);
    this.drawPolygon(pullOffsetX, pullOffsetY, this.size + wobble, sides);
    this.graphics.fillPath();

    // 외곽선 (호버 시 더 굵게)
    const lineWidth = this.isHovered ? 4 : 3;
    this.graphics.lineStyle(lineWidth, displayColor, 1);
    this.drawPolygon(pullOffsetX, pullOffsetY, this.size + wobble, sides);
    this.graphics.strokePath();

    // 내부 원
    this.graphics.lineStyle(2, COLORS.WHITE, 0.4);
    this.graphics.strokeCircle(pullOffsetX, pullOffsetY, this.size * 0.5);

    // HP 바 그리기 (데미지를 받았을 때만)
    if (this.currentHp < this.maxHp) {
      this.drawHpBar(pullOffsetX, pullOffsetY);
    }

    // 히트박스 표시 (디버그용) - 접시 크기만 표시
    this.graphics.lineStyle(1, COLORS.GREEN, 0.5);
    this.graphics.strokeCircle(pullOffsetX, pullOffsetY, this.size);
  }

  private drawHpBar(offsetX: number = 0, offsetY: number = 0): void {
    const barWidth = this.size * 1.6;
    const barHeight = 6;
    const barY = -this.size - 15 + offsetY;

    // 배경
    this.graphics.fillStyle(0x000000, 0.6);
    this.graphics.fillRect(-barWidth / 2 - 1 + offsetX, barY - 1, barWidth + 2, barHeight + 2);

    // HP 바
    const hpRatio = Math.max(0, this.currentHp / this.maxHp);
    const hpColor = this.lerpColor(COLORS.RED, COLORS.GREEN, hpRatio);
    this.graphics.fillStyle(hpColor, 1);
    this.graphics.fillRect(-barWidth / 2 + offsetX, barY, barWidth * hpRatio, barHeight);

    // 테두리
    this.graphics.lineStyle(1, COLORS.WHITE, 0.5);
    this.graphics.strokeRect(-barWidth / 2 + offsetX, barY, barWidth, barHeight);
  }

  private lerpColor(colorA: number, colorB: number, t: number): number {
    const rA = (colorA >> 16) & 0xff;
    const gA = (colorA >> 8) & 0xff;
    const bA = colorA & 0xff;

    const rB = (colorB >> 16) & 0xff;
    const gB = (colorB >> 8) & 0xff;
    const bB = colorB & 0xff;

    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const b = Math.round(bA + (bB - bA) * t);

    return (r << 16) | (g << 8) | b;
  }

  private drawMine(): void {
    const pulse = Math.sin(this.blinkPhase * 2) * 0.15 + 0.85; // 깜빡임 효과
    const baseRadius = this.size * 0.7;

    // 검은 원형 베이스
    this.graphics.fillStyle(0x1a1a1a, 1);
    this.graphics.fillCircle(0, 0, baseRadius);

    // 빨간 테두리 (펄스)
    this.graphics.lineStyle(4, COLORS.RED, pulse);
    this.graphics.strokeCircle(0, 0, baseRadius);

    // 스파이크 (지뢰 돌기)
    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 - Math.PI / 8;
      const innerRadius = baseRadius * 0.8;
      const outerRadius = baseRadius + 12;

      // 스파이크 삼각형
      const x1 = Math.cos(angle - 0.15) * innerRadius;
      const y1 = Math.sin(angle - 0.15) * innerRadius;
      const x2 = Math.cos(angle + 0.15) * innerRadius;
      const y2 = Math.sin(angle + 0.15) * innerRadius;
      const x3 = Math.cos(angle) * outerRadius;
      const y3 = Math.sin(angle) * outerRadius;

      this.graphics.fillStyle(COLORS.RED, pulse);
      this.graphics.beginPath();
      this.graphics.moveTo(x1, y1);
      this.graphics.lineTo(x3, y3);
      this.graphics.lineTo(x2, y2);
      this.graphics.closePath();
      this.graphics.fillPath();
    }

    // 중앙 경고 심볼 (해골/X 대신 간단한 원)
    this.graphics.fillStyle(COLORS.RED, pulse);
    this.graphics.fillCircle(0, 0, 8);

    // 내부 하이라이트
    this.graphics.fillStyle(0xffffff, 0.3);
    this.graphics.fillCircle(-5, -5, 4);
  }

  private drawPolygon(cx: number, cy: number, radius: number, sides: number): void {
    this.graphics.beginPath();

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) {
        this.graphics.moveTo(x, y);
      } else {
        this.graphics.lineTo(x, y);
      }
    }

    this.graphics.closePath();
  }

  update(delta: number = 16.67): void {
    if (!this.active) return;

    // 냉동 효과 처리
    if (this.isFrozen) {
      if (this.elapsedTime >= this.slowEndTime) {
        // 냉동 해제
        this.isFrozen = false;
        this.slowFactor = 1.0;
      }
    }

    // 글로벌 슬로우 적용 (업그레이드)
    const globalSlowPercent = this.upgradeOptions.globalSlowPercent ?? 0;
    const globalSlowFactor = 1 - globalSlowPercent;

    // 시간 경과 (냉동 + 글로벌 슬로우 적용)
    const effectiveDelta = delta * this.slowFactor * globalSlowFactor;
    this.elapsedTime += effectiveDelta;

    // 타임아웃 체크
    if (this.elapsedTime >= this.lifetime) {
      this.onTimeout();
      return;
    }

    // 좌우 흔들림 (냉동 시 느리게)
    this.wobblePhase += 0.1 * this.slowFactor;

    // 자기장 흔들림
    if (this.isBeingPulled) {
      this.pullPhase += 0.5;
    }

    // 피격 플래시 감쇠
    if (this.hitFlashPhase > 0) {
      this.hitFlashPhase -= delta / 100; // 100ms 동안 감쇠
      if (this.hitFlashPhase < 0) this.hitFlashPhase = 0;
    }

    // 30% 미만일 때 깜빡임 효과
    const timeRatio = this.getTimeRatio();
    if (timeRatio < 0.3) {
      this.blinkPhase += 0.3;
      const blinkAlpha = 0.5 + Math.sin(this.blinkPhase) * 0.5;
      this.setAlpha(blinkAlpha);
    }

    this.drawDish();
  }

  private onTimeout(): void {
    if (!this.active) return;

    // 타이머 정리
    this.clearDamageTimer();

    // 현재 위치/타입 저장 (이벤트용)
    const eventData = {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      isDangerous: this.dangerous,
    };

    // 즉시 비활성화 (재사용 방지)
    this.deactivate();

    // DISH_MISSED 이벤트 발생
    EventBus.getInstance().emit(GameEvents.DISH_MISSED, eventData);
  }

  getTimeRatio(): number {
    return Math.max(0, 1 - this.elapsedTime / this.lifetime);
  }

  getLifetime(): number {
    return this.lifetime;
  }

  private destroy_dish(): void {
    this.active = false;

    // 타이머 정리
    this.clearDamageTimer();

    // 인터랙티브 제거
    this.disableInteractive();
    this.removeAllListeners();

    EventBus.getInstance().emit(GameEvents.DISH_DESTROYED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      chainReaction: this.chainReaction,
      byAbility: this.destroyedByAbility,
    });

    this.deactivate();
  }

  deactivate(): void {
    this.active = false;
    this.clearDamageTimer();
    this.setVisible(false);
    this.setActive(false);
    this.disableInteractive();
    this.removeAllListeners();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }

  getPoints(): number {
    return this.points;
  }

  getColor(): number {
    return this.color;
  }

  getDishType(): string {
    return this.dishType;
  }

  isChainReaction(): boolean {
    return this.chainReaction;
  }

  getSize(): number {
    return this.size;
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getHpRatio(): number {
    return this.currentHp / this.maxHp;
  }

  // 외부에서 데미지 적용 (전기 충격, 관통 등)
  applyDamage(damage: number, isChainReaction: boolean = false): void {
    if (!this.active || this.invulnerable) return;

    if (isChainReaction) {
      this.chainReaction = true;
    }

    this.destroyedByAbility = true;
    this.currentHp -= damage;
    this.hitFlashPhase = 1;

    EventBus.getInstance().emit(GameEvents.DISH_DAMAGED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      damage,
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      hpRatio: this.currentHp / this.maxHp,
      isFirstHit: false,
      byAbility: true,
    });

    if (this.currentHp <= 0) {
      this.destroy_dish();
    }
  }

  // 냉동 효과 적용
  applySlow(duration: number, factor: number = 0.3): void {
    if (!this.active) return;

    this.isFrozen = true;
    this.slowFactor = factor;
    this.slowEndTime = this.elapsedTime + duration;
  }

  // 즉시 파괴
  forceDestroy(): void {
    if (!this.active) return;
    this.destroyedByAbility = true;
    this.destroy_dish();
  }

  isSlowed(): boolean {
    return this.isFrozen;
  }

  // 업그레이드 적용 데미지 메서드
  applyDamageWithUpgrades(baseDamage: number, damageBonus: number, criticalChance: number): void {
    if (!this.active || this.invulnerable) return;

    const damageConfig = Data.dishes.damage;
    const totalCritChance = Math.min(1, (damageConfig.criticalChance || 0) + criticalChance);
    const critMultiplier = damageConfig.criticalMultiplier || 2;

    let totalDamage = baseDamage + damageBonus;
    let isCritical = false;

    // 치명타 적용
    if (totalCritChance > 0 && Math.random() < totalCritChance) {
      totalDamage *= critMultiplier;
      isCritical = true;
    }

    this.currentHp -= totalDamage;
    this.hitFlashPhase = 1;
    this.destroyedByAbility = true;

    EventBus.getInstance().emit(GameEvents.DISH_DAMAGED, {
      dish: this,
      x: this.x,
      y: this.y,
      type: this.dishType,
      damage: totalDamage,
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      hpRatio: this.currentHp / this.maxHp,
      isFirstHit: false,
      isCritical,
      byAbility: true,
    });

    if (this.currentHp <= 0) {
      this.destroy_dish();
    }
  }

  getDamageInterval(): number {
    return this.damageInterval;
  }

  getInteractiveRadius(): number {
    return this.interactiveRadius;
  }

  getUpgradeOptions(): DishUpgradeOptions {
    return this.upgradeOptions;
  }
}
