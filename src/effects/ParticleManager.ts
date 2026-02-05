import Phaser from 'phaser';
import { COLORS } from '../config/constants';
import { Data } from '../data/DataManager';

// 무지개 색상 배열
const RAINBOW_COLORS = [
  0xff0000, // 빨강
  0xff7f00, // 주황
  0xffff00, // 노랑
  0x00ff00, // 초록
  0x0000ff, // 파랑
  0x4b0082, // 남색
  0x9400d3, // 보라
];

export class ParticleManager {
  private scene: Phaser.Scene;
  private emitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createEmitters();
  }

  private createEmitters(): void {
    // 기본 폭발 이미터
    const explosionEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 100, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: { min: 300, max: 600 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.emitters.set('explosion', explosionEmitter);

    // 히트 이미터
    const hitEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 100, max: 300 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.emitters.set('hit', hitEmitter);

    // 크리티컬 이미터
    const criticalEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 150, max: 400 },
      angle: { min: 0, max: 360 },
      scale: { start: 2, end: 0 },
      lifespan: { min: 400, max: 800 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.emitters.set('critical', criticalEmitter);

    // 스파크 이미터 (체인 라이트닝용)
    const sparkEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 200, max: 500 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 100, max: 200 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.emitters.set('spark', sparkEmitter);
  }

  createExplosion(x: number, y: number, color: number, dishType: string, particleMultiplier: number = 1): void {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;

    // 타입별 파티클 수 조절 (JSON에서 로드)
    const particles = Data.feedback.particles;
    let baseCount: number;
    switch (dishType) {
      case 'golden':
        baseCount = particles.golden.count;
        break;
      case 'crystal':
        baseCount = particles.crystal.count;
        break;
      case 'bomb':
        baseCount = particles.bomb.count;
        break;
      default:
        baseCount = particles.basic.count;
    }

    // 파티클 배율 적용
    const particleCount = Math.floor(baseCount * particleMultiplier);

    emitter.setParticleTint(color);
    emitter.explode(particleCount, x, y);

    // 추가 링 효과
    this.createRingEffect(x, y, color);

    // 크리스탈 접시는 추가 스파크
    if (dishType === 'crystal') {
      this.createSparkBurst(x, y, COLORS.MAGENTA);
    }

    // 폭탄 접시는 더 큰 폭발
    if (dishType === 'bomb') {
      this.createShockwave(x, y, COLORS.RED);
    }
  }

  // 무지개 폭발 이펙트
  createRainbowExplosion(x: number, y: number, particleMultiplier: number = 1): void {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;

    const baseCount = Math.floor(5 * particleMultiplier);

    // 각 무지개 색상으로 순차적 폭발
    RAINBOW_COLORS.forEach((color, index) => {
      this.scene.time.delayedCall(index * 30, () => {
        emitter.setParticleTint(color);
        emitter.explode(baseCount, x, y);
      });
    });

    // 무지개 링 효과
    this.createRainbowRingEffect(x, y);
  }

  private createRainbowRingEffect(x: number, y: number): void {
    RAINBOW_COLORS.forEach((color, index) => {
      this.scene.time.delayedCall(index * 40, () => {
        const ring = this.scene.add.graphics();
        ring.lineStyle(3, color, 1);
        ring.strokeCircle(x, y, 15 + index * 5);

        this.scene.tweens.add({
          targets: ring,
          scaleX: 2.5 - index * 0.2,
          scaleY: 2.5 - index * 0.2,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => ring.destroy(),
        });
      });
    });
  }

  // 전기 충격 이펙트
  createElectricEffect(x: number, y: number, targets: { x: number; y: number }[]): void {
    targets.forEach((target, index) => {
      this.scene.time.delayedCall(index * 50, () => {
        this.drawLightning(x, y, target.x, target.y);
      });
    });

    // 중심에 스파크
    this.createSparkBurst(x, y, COLORS.CYAN);
  }

  private drawLightning(x1: number, y1: number, x2: number, y2: number): void {
    const lightning = this.scene.add.graphics();
    lightning.lineStyle(3, COLORS.CYAN, 1);

    // 번개 경로 생성 (지그재그)
    const segments = 5;
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = x1 + (x2 - x1) * t;
      const baseY = y1 + (y2 - y1) * t;
      const offset = (Math.random() - 0.5) * 30;

      // 수직 방향으로 오프셋
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      points.push({
        x: baseX + nx * offset,
        y: baseY + ny * offset,
      });
    }
    points.push({ x: x2, y: y2 });

    // 번개 그리기
    lightning.beginPath();
    lightning.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      lightning.lineTo(points[i].x, points[i].y);
    }
    lightning.strokePath();

    // 글로우 효과
    const glow = this.scene.add.graphics();
    glow.lineStyle(8, COLORS.CYAN, 0.3);
    glow.beginPath();
    glow.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      glow.lineTo(points[i].x, points[i].y);
    }
    glow.strokePath();

    // 페이드 아웃
    this.scene.tweens.add({
      targets: [lightning, glow],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        lightning.destroy();
        glow.destroy();
      },
    });
  }

  // 불꽃놀이 폭발 (3배 강화)
  createFireworksExplosion(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;

    // 3배 파티클
    emitter.setParticleTint(color);
    emitter.explode(60, x, y);

    // 3배 링
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 50, () => {
        this.createRingEffect(x, y, color);
      });
    }

    // 추가 스타버스트
    this.createStarburst(x, y, color);
    this.createSparkBurst(x, y, color);
  }

  createHitEffect(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('hit');
    if (!emitter) return;

    emitter.setParticleTint(color);
    emitter.explode(8, x, y);
  }

  // 강화된 히트 스파크 (업그레이드용)
  createEnhancedHitSparks(x: number, y: number, color: number, level: number): void {
    const emitter = this.emitters.get('spark');
    if (!emitter) return;

    const sparkCount = 5 + level * 5;
    emitter.setParticleTint(color);
    emitter.explode(sparkCount, x, y);

    // 레벨 2 이상: 추가 링
    if (level >= 2) {
      this.createRingEffect(x, y, color);
    }

    // 레벨 3: 스타버스트
    if (level >= 3) {
      this.createStarburst(x, y, color);
    }
  }

  createCriticalEffect(x: number, y: number): void {
    const emitter = this.emitters.get('critical');
    if (!emitter) return;

    emitter.setParticleTint(COLORS.YELLOW);
    emitter.explode(25, x, y);

    // 추가 스타버스트 효과
    this.createStarburst(x, y, COLORS.YELLOW);
  }

  private createRingEffect(x: number, y: number, color: number): void {
    const ring = this.scene.add.graphics();
    ring.lineStyle(4, color, 1);
    ring.strokeCircle(x, y, 10);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  createSparkBurst(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('spark');
    if (!emitter) return;

    emitter.setParticleTint(color);
    emitter.explode(15, x, y);
  }

  private createShockwave(x: number, y: number, color: number): void {
    const shockwave = this.scene.add.graphics();
    shockwave.lineStyle(6, color, 1);
    shockwave.strokeCircle(x, y, 20);

    this.scene.tweens.add({
      targets: shockwave,
      scaleX: 5,
      scaleY: 5,
      alpha: 0,
      duration: 500,
      ease: 'Power1',
      onComplete: () => shockwave.destroy(),
    });
  }

  private createStarburst(x: number, y: number, color: number): void {
    const rays = 8;
    const rayLength = 40;

    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const ray = this.scene.add.graphics();

      ray.lineStyle(3, color, 1);
      ray.lineBetween(x, y, x + Math.cos(angle) * 10, y + Math.sin(angle) * 10);

      this.scene.tweens.add({
        targets: ray,
        x: Math.cos(angle) * rayLength,
        y: Math.sin(angle) * rayLength,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => ray.destroy(),
      });
    }
  }

  createTrail(x: number, y: number, color: number): void {
    const trail = this.scene.add.circle(x, y, 4, color, 0.6);

    this.scene.tweens.add({
      targets: trail,
      scale: 0,
      alpha: 0,
      duration: 200,
      onComplete: () => trail.destroy(),
    });
  }

  createHealEffect(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('hit');
    if (!emitter) return;

    emitter.setParticleTint(color);
    emitter.explode(15, x, y);

    // 상승하는 + 모양 파티클 효과
    this.createHealRing(x, y, color);
    this.createHealSparkles(x, y, color);
  }

  private createHealRing(x: number, y: number, color: number): void {
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, color, 1);
    ring.strokeCircle(x, y, 15);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  private createHealSparkles(x: number, y: number, color: number): void {
    // 상승하는 작은 파티클들
    for (let i = 0; i < 8; i++) {
      const offsetX = Phaser.Math.Between(-20, 20);
      const sparkle = this.scene.add.circle(x + offsetX, y, 3, color, 1);

      this.scene.tweens.add({
        targets: sparkle,
        y: y - Phaser.Math.Between(40, 80),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(300, 500),
        delay: i * 30,
        ease: 'Power1',
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  // 방어막 효과
  createShieldEffect(x: number, y: number, color: number): void {
    // 육각형 방어막
    const shield = this.scene.add.graphics();
    shield.lineStyle(4, color, 1);
    shield.fillStyle(color, 0.3);

    const sides = 6;
    const radius = 40;
    const points: number[] = [];

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      points.push(x + Math.cos(angle) * radius);
      points.push(y + Math.sin(angle) * radius);
    }

    shield.fillPoints(points.map((_, i) => (i % 2 === 0 ? { x: points[i], y: points[i + 1] } : null)).filter(Boolean) as Phaser.Geom.Point[]);
    shield.strokePoints(points.map((_, i) => (i % 2 === 0 ? { x: points[i], y: points[i + 1] } : null)).filter(Boolean) as Phaser.Geom.Point[], true);

    this.scene.tweens.add({
      targets: shield,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => shield.destroy(),
    });

    // 스파크 추가
    this.createSparkBurst(x, y, color);
  }
}
