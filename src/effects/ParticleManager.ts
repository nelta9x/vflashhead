import Phaser from 'phaser';
import { COLORS } from '../config/constants';

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

  createExplosion(x: number, y: number, color: number, dishType: string): void {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;

    // 타입별 파티클 수 조절
    const particleCount =
      dishType === 'golden' ? 30 : dishType === 'crystal' ? 25 : dishType === 'bomb' ? 40 : 20;

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

  createHitEffect(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('hit');
    if (!emitter) return;

    emitter.setParticleTint(color);
    emitter.explode(8, x, y);
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

  private createSparkBurst(x: number, y: number, color: number): void {
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
}
