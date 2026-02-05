import Phaser from 'phaser';
import { COLORS } from '../data/constants';
import { EventBus, GameEvents } from '../utils/EventBus';

export class Boss extends Phaser.GameObjects.Container {
  private core: Phaser.GameObjects.Arc;
  private rings: Phaser.GameObjects.Graphics;
  private hpRatio: number = 1;
  private timeElapsed: number = 0;
  private isDead: boolean = false;
  
  // 링 설정
  private ringConfigs = [
    { radius: 60, speed: 0.002, segments: 3, gap: 0.4 },
    { radius: 85, speed: -0.0015, segments: 2, gap: 0.6 },
    { radius: 110, speed: 0.001, segments: 4, gap: 0.3 }
  ];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // 중앙 코어 생성
    this.core = scene.add.arc(0, 0, 35, 0, 360, false, COLORS.RED, 0.8);
    this.add(this.core);

    // 링을 그릴 그래픽스 객체
    this.rings = scene.add.graphics();
    this.add(this.rings);

    // 기본적으로 보이지 않음 (웨이브 시작 시 나타남)
    this.setVisible(false);
    this.setAlpha(0);

    scene.add.existing(this);

    // 이벤트 리스너
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    EventBus.getInstance().on(GameEvents.MONSTER_HP_CHANGED, (...args: any[]) => {
      const data = args[0] as { ratio: number };
      this.hpRatio = data.ratio;
      this.onDamage();
    });

    EventBus.getInstance().on(GameEvents.MONSTER_DIED, () => {
      this.die();
    });

    EventBus.getInstance().on(GameEvents.WAVE_STARTED, () => {
      this.spawn();
    });
  }

  private spawn(): void {
    this.isDead = false;
    this.hpRatio = 1;
    this.setVisible(true);
    
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 1000,
      ease: 'Back.easeOut'
    });
  }

  private onDamage(): void {
    if (this.isDead) return;

    // 히트 시 짧은 화이트 플래시 효과
    this.scene.tweens.add({
      targets: this.core,
      fillAlpha: 1,
      duration: 50,
      yoyo: true,
      onStart: () => {
        this.core.setFillStyle(0xffffff);
      },
      onComplete: () => {
        this.core.setFillStyle(COLORS.RED, 0.8);
      }
    });

    // 데미지 시 진동 효과
    this.scene.tweens.add({
      targets: this,
      x: this.x + Phaser.Math.Between(-5, 5),
      y: this.y + Phaser.Math.Between(-5, 5),
      duration: 50,
      yoyo: true,
      repeat: 2
    });
  }

  private die(): void {
    this.isDead = true;
    
    // 파괴 애니메이션
    this.scene.tweens.add({
      targets: this,
      scale: 1.5,
      alpha: 0,
      duration: 800,
      ease: 'Power2.In',
      onComplete: () => {
        this.setVisible(false);
      }
    });
  }

  update(delta: number): void {
    if (!this.visible || this.isDead) return;

    this.timeElapsed += delta;

    // HP 비율에 따른 연출 변화
    const dangerLevel = 1 - this.hpRatio; // 0 to 1
    
    // 코어 연출: 위기일수록 더 밝고 격렬하게 깜빡임
    const corePulse = 0.8 + Math.sin(this.timeElapsed * 0.01 * (1 + dangerLevel * 2)) * 0.2;
    this.core.setAlpha(corePulse);
    
    // 코어 크기 변화: 위기일수록 약간 커짐
    const coreScale = 1 + dangerLevel * 0.2;
    this.core.setScale(coreScale);

    // 링 그리기
    this.rings.clear();
    
    // HP 비율에 따라 활성화된 링 개수 조절
    // 1.0~0.7: 3개, 0.7~0.3: 2개, 0.3~0: 1개
    let activeRingCount = 1;
    if (this.hpRatio > 0.7) activeRingCount = 3;
    else if (this.hpRatio > 0.3) activeRingCount = 2;

    for (let i = 0; i < activeRingCount; i++) {
      const config = this.ringConfigs[i];
      // 위기일수록 링 회전 속도 증가
      const speedMult = 1 + dangerLevel * 1.5;
      const rotation = this.timeElapsed * config.speed * speedMult;
      
      this.drawRing(config.radius, rotation, config.segments, config.gap, dangerLevel);
    }
    
    // 위기 시 제자리 진동 (상시)
    if (dangerLevel > 0.5) {
      this.x += (Math.random() - 0.5) * dangerLevel * 2;
      this.y += (Math.random() - 0.5) * dangerLevel * 2;
    }
  }

  private drawRing(radius: number, rotation: number, segments: number, gap: number, dangerLevel: number): void {
    // 위기일수록 색상이 더 밝은 빨강/오렌지로 변함
    const color = COLORS.RED;
    const alpha = 0.4 + (1 - this.hpRatio) * 0.4;
    const thickness = 4 + dangerLevel * 4;

    this.rings.lineStyle(thickness, color, alpha);

    const segmentAngle = (Math.PI * 2) / segments;
    const gapAngle = segmentAngle * gap;
    const drawAngle = segmentAngle - gapAngle;

    for (let i = 0; i < segments; i++) {
      const startAngle = rotation + i * segmentAngle;
      
      // Phaser Graphics.arc는 도(degree) 단위를 사용함
      this.rings.beginPath();
      this.rings.arc(
        0, 0, 
        radius, 
        Phaser.Math.RadToDeg(startAngle), 
        Phaser.Math.RadToDeg(startAngle + drawAngle)
      );
      this.rings.strokePath();
      
      // 글로우 효과 (더 두껍고 투명한 라인)
      this.rings.lineStyle(thickness * 2, color, alpha * 0.3);
      this.rings.beginPath();
      this.rings.arc(
        0, 0, 
        radius, 
        Phaser.Math.RadToDeg(startAngle), 
        Phaser.Math.RadToDeg(startAngle + drawAngle)
      );
      this.rings.strokePath();
      
      // 원래 두께로 복구
      this.rings.lineStyle(thickness, color, alpha);
    }
  }
}
