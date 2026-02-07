import Phaser from 'phaser';
import { COLORS } from '../data/constants';
import { Data } from '../data/DataManager';
import { SoundSystem } from '../systems/SoundSystem';

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

    // 자기장 이펙트 이미터
    const magnetEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 100 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 200, max: 400 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.emitters.set('magnet', magnetEmitter);
  }

  createMagnetPullEffect(dishX: number, dishY: number, cursorX: number, cursorY: number): void {
    const emitter = this.emitters.get('magnet');
    if (!emitter) return;

    // 접시 위치에서 커서 방향으로 아주 짧은 스파크/파티클 생성
    const angle = Phaser.Math.Angle.Between(dishX, dishY, cursorX, cursorY);

    emitter.setParticleTint(COLORS.MAGENTA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (emitter as any).setAngle({
      min: Phaser.Math.RadToDeg(angle) - 20,
      max: Phaser.Math.RadToDeg(angle) + 20,
    });

    emitter.explode(1, dishX, dishY);
  }

  createExplosion(
    x: number,
    y: number,
    color: number,
    dishType: string,
    particleMultiplier: number = 1
  ): void {
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

  createUpgradeAbsorption(
    startX: number,
    startY: number,
    _endX: number, // 실시간 추적을 위해 무시
    _endY: number, // 실시간 추적을 위해 무시
    color: number,
    onComplete?: () => void
  ): void {
    const config = Data.feedback.upgradeAbsorption;
    const { 
      particleCount, 
      duration, 
      particleSizeMin, 
      particleSizeMax, 
      startSpread,
      spreadDuration,
      spreadEase,
      suctionEase,
      suctionDelayMax
    } = config;

    // GameScene의 가상 커서 위치 사용
    const gameScene = this.scene as any;
    
    // 1. 입자 생성 및 확산 연출 (Slow Spread)
    for (let i = 0; i < particleCount; i++) {
      const size = Phaser.Math.Between(particleSizeMin, particleSizeMax);
      const particle = this.scene.add.circle(startX, startY, size, color, 1);
      particle.setDepth(2000);

      // 시작 위치 랜덤 오프셋 (스프레드)
      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadDist = Math.random() * startSpread;
      const spreadX = startX + Math.cos(spreadAngle) * spreadDist;
      const spreadY = startY + Math.sin(spreadAngle) * spreadDist;

      // 1단계: 천천히 퍼지기
      this.scene.tweens.add({
        targets: particle,
        x: spreadX,
        y: spreadY,
        alpha: 0.8,
        duration: spreadDuration + Math.random() * 200,
        ease: spreadEase,
        onComplete: () => {
          // 2단계: 커서의 "현재" 위치로 빠르게 흡수되기 (Dynamic Suction)
          const delay = Math.random() * suctionDelayMax;
          const currentSpreadX = particle.x;
          const currentSpreadY = particle.y;

          this.scene.tweens.add({
            targets: { progress: 0 },
            progress: 1,
            duration: duration,
            delay: delay,
            ease: suctionEase,
            onUpdate: (_tween, target) => {
              const p = target.progress;
              // 확산된 위치에서 실시간 커서 위치로 보간 (Interpolation)
              // GameScene에서 커서 위치 가져오기
              const cursorPos = gameScene.getCursorPosition ? gameScene.getCursorPosition() : { x: gameScene.input.activePointer.worldX, y: gameScene.input.activePointer.worldY };
              particle.x = currentSpreadX + (cursorPos.x - currentSpreadX) * p;
              particle.y = currentSpreadY + (cursorPos.y - currentSpreadY) * p;
              particle.alpha = 0.8 + 0.2 * p;
              particle.scale = 1 - p;
            },
            onComplete: () => {
              particle.destroy();
              // 마지막 입자가 도착할 때 현재 커서 위치에 임팩트 실행 및 사운드 재생
              if (i === particleCount - 1) {
                const finalPos = gameScene.getCursorPosition ? gameScene.getCursorPosition() : { x: gameScene.input.activePointer.worldX, y: gameScene.input.activePointer.worldY };
                this.createUpgradeImpact(finalPos.x, finalPos.y, color);
                if (onComplete) onComplete();
              }
            },
          });
        }
      });
    }
  }

  private createUpgradeImpact(x: number, y: number, color: number): void {
    // 사운드 재생 (완전히 흡수된 시점)
    SoundSystem.getInstance().playUpgradeSound();

    const config = Data.feedback.upgradeAbsorption;
    
    const ring = this.scene.add.graphics();
    ring.lineStyle(5, color, 1);
    ring.strokeCircle(0, 0, config.impactRingSize);
    ring.setPosition(x, y);
    ring.setDepth(2002);

    this.scene.tweens.add({
      targets: ring,
      scaleX: config.impactRingScale,
      scaleY: config.impactRingScale,
      alpha: 0,
      duration: config.impactRingDuration,
      ease: config.impactRingEase,
      onComplete: () => ring.destroy(),
    });

    this.createStarburst(x, y, color);

    const glow = this.scene.add.circle(x, y, config.impactGlowSize, color, 0.8);
    glow.setDepth(2003);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: glow,
      scale: config.impactGlowScale,
      alpha: 0,
      duration: config.impactGlowDuration,
      ease: config.impactGlowEase,
      onComplete: () => glow.destroy(),
    });
  }

  createEnergyEffect(x: number, y: number, combo: number, cursorRadius: number): void {
    const config = Data.feedback.energyEffect;
    const gameScene = this.scene as any;

    const comboConfig = Data.feedback.damageText.combo;
    const { thresholds, colors } = comboConfig;
    let colorStr: string;

    if (combo >= thresholds.ultra) colorStr = colors.ultra;
    else if (combo >= thresholds.high) colorStr = colors.high;
    else if (combo >= thresholds.mid) colorStr = colors.mid;
    else colorStr = colors.low;

    const color = parseInt(colorStr.replace('#', ''), 16);
    const size = config.baseSize + Math.min(config.maxSizeBonus, combo / config.comboDivision);

    const particle = this.scene.add.circle(x, y, size, color, config.alpha);
    particle.setDepth(100);

    const trail = this.scene.add.particles(0, 0, 'particle', {
      follow: particle,
      scale: { start: size / 10, end: 0 },
      lifespan: config.trailLifespan,
      blendMode: 'ADD',
      tint: color,
      frequency: 20,
    });
    trail.setDepth(99);

    const glow = this.scene.add.graphics();
    glow.setDepth(99);

    const angle = Math.random() * Math.PI * 2;
    const cpX = x + Math.cos(angle) * config.knockbackDistance;
    const cpY = y + Math.sin(angle) * config.knockbackDistance;

    const startX = x;
    const startY = y;

    let isAbsorbed = false;

    const tween = this.scene.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration: config.duration,
      ease: 'Sine.easeIn',
      onUpdate: (_tween, target) => {
        if (isAbsorbed) return;

        const t = target.t;
        const oneMinusT = 1 - t;
        const cursorPos = gameScene.getCursorPosition ? gameScene.getCursorPosition() : { x: gameScene.input.activePointer.worldX, y: gameScene.input.activePointer.worldY };
        const targetX = cursorPos.x;
        const targetY = cursorPos.y;

        particle.x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * cpX + t * t * targetX;
        particle.y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * cpY + t * t * targetY;

        const dist = Phaser.Math.Distance.Between(particle.x, particle.y, targetX, targetY);

        if (t > 0.2 && dist <= cursorRadius) {
          isAbsorbed = true;
          this.completeEnergyEffect(particle, glow, trail, color, config.trailLifespan);
          tween.stop();
          return;
        }

        if (glow.active) {
          glow.clear();
          glow.fillStyle(color, config.glowAlpha);
          const currentGlowSize = size * config.glowScale * (0.5 + 0.5 * t);
          glow.fillCircle(particle.x, particle.y, currentGlowSize);
        }
      },
      onComplete: () => {
        if (!isAbsorbed) {
          this.completeEnergyEffect(particle, glow, trail, color, config.trailLifespan);
        }
      },
    });
  }

  private completeEnergyEffect(
    particle: Phaser.GameObjects.Arc,
    glow: Phaser.GameObjects.Graphics,
    trail: Phaser.GameObjects.Particles.ParticleEmitter,
    color: number,
    trailLifespan: number
  ): void {
    const x = particle.x;
    const y = particle.y;

    particle.destroy();
    glow.destroy();

    this.scene.time.delayedCall(trailLifespan, () => {
      trail.destroy();
    });

    this.createHitEffect(x, y, color);
  }

  createRainbowExplosion(x: number, y: number, particleMultiplier: number = 1): void {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;

    const baseCount = Math.floor(5 * particleMultiplier);

    RAINBOW_COLORS.forEach((color, index) => {
      this.scene.time.delayedCall(index * 30, () => {
        emitter.setParticleTint(color);
        emitter.explode(baseCount, x, y);
      });
    });

    this.createRainbowRingEffect(x, y);
  }

  private createRainbowRingEffect(x: number, y: number): void {
    RAINBOW_COLORS.forEach((color, index) => {
      this.scene.time.delayedCall(index * 40, () => {
        const ring = this.scene.add.graphics();
        ring.setPosition(x, y);
        ring.lineStyle(3, color, 1);
        ring.strokeCircle(0, 0, 15 + index * 5);

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

  createElectricEffect(x: number, y: number, targets: { x: number; y: number }[]): void {
    targets.forEach((target, index) => {
      this.scene.time.delayedCall(index * 50, () => {
        this.drawLightning(x, y, target.x, target.y);
      });
    });

    this.createSparkBurst(x, y, COLORS.CYAN);
  }

  private drawLightning(x1: number, y1: number, x2: number, y2: number): void {
    const lightning = this.scene.add.graphics();
    lightning.lineStyle(3, COLORS.CYAN, 1);

    const segments = 5;
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = x1 + (x2 - x1) * t;
      const baseY = y1 + (y2 - y1) * t;
      const offset = (Math.random() - 0.5) * 30;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      points.push({ x: baseX + nx * offset, y: baseY + ny * offset });
    }
    points.push({ x: x2, y: y2 });

    lightning.beginPath();
    lightning.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      lightning.lineTo(points[i].x, points[i].y);
    }
    lightning.strokePath();

    const glow = this.scene.add.graphics();
    glow.lineStyle(8, COLORS.CYAN, 0.3);
    glow.beginPath();
    glow.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      glow.lineTo(points[i].x, points[i].y);
    }
    glow.strokePath();

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

  createFireworksExplosion(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;

    emitter.setParticleTint(color);
    emitter.explode(60, x, y);

    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 50, () => {
        this.createRingEffect(x, y, color);
      });
    }

    this.createStarburst(x, y, color);
    this.createSparkBurst(x, y, color);
  }

  createHitEffect(x: number, y: number, color: number): void {
    const emitter = this.emitters.get('hit');
    if (!emitter) return;

    emitter.setParticleTint(color);
    emitter.explode(8, x, y);
  }

  createEnhancedHitSparks(x: number, y: number, color: number, level: number): void {
    const emitter = this.emitters.get('spark');
    if (!emitter) return;

    const sparkCount = 5 + level * 5;
    emitter.setParticleTint(color);
    emitter.explode(sparkCount, x, y);

    if (level >= 2) {
      this.createRingEffect(x, y, color);
    }

    if (level >= 3) {
      this.createStarburst(x, y, color);
    }
  }

  createCriticalEffect(x: number, y: number): void {
    const emitter = this.emitters.get('critical');
    if (!emitter) return;

    emitter.setParticleTint(COLORS.YELLOW);
    emitter.explode(25, x, y);
    this.createStarburst(x, y, COLORS.YELLOW);
  }

  private createRingEffect(x: number, y: number, color: number): void {
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    ring.lineStyle(4, color, 1);
    ring.strokeCircle(0, 0, 10);

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
    shockwave.setPosition(x, y);
    shockwave.lineStyle(6, color, 1);
    shockwave.strokeCircle(0, 0, 20);

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
      ray.setPosition(x, y);

      ray.lineStyle(3, color, 1);
      ray.lineBetween(0, 0, Math.cos(angle) * 10, Math.sin(angle) * 10);

      this.scene.tweens.add({
        targets: ray,
        x: x + Math.cos(angle) * rayLength,
        y: y + Math.sin(angle) * rayLength,
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

    this.createHealRing(x, y, color);
    this.createHealSparkles(x, y, color);
  }

  private createHealRing(x: number, y: number, color: number): void {
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    ring.lineStyle(3, color, 1);
    ring.strokeCircle(0, 0, 15);

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

  createShieldEffect(x: number, y: number, color: number): void {
    const shield = this.scene.add.graphics();
    shield.setPosition(x, y);
    shield.lineStyle(4, color, 1);
    shield.fillStyle(color, 0.3);

    const sides = 6;
    const radius = 40;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }

    shield.fillPoints(points, true);
    shield.strokePoints(points, true);

    this.scene.tweens.add({
      targets: shield,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => shield.destroy(),
    });

    this.createSparkBurst(x, y, color);
  }

  createBossGaugeShatter(
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    bodyColor: number
  ): void {
    const config = Data.boss.visual.shatter;

    for (let i = 0; i < config.shardCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Phaser.Math.Between(innerRadius, outerRadius);
      const startX = x + Math.cos(angle) * radius;
      const startY = y + Math.sin(angle) * radius;

      const shard = this.scene.add.graphics();
      shard.setDepth(1999);

      const size = Phaser.Math.Between(config.minSize, config.maxSize);
      const isEnergy = Math.random() < config.energyShardRatio;
      const color = isEnergy ? COLORS.RED : bodyColor;
      const alpha = isEnergy ? 1 : 0.8;

      shard.fillStyle(color, alpha);

      const points = [];
      const numPoints = Phaser.Math.Between(3, 5);
      for (let j = 0; j < numPoints; j++) {
        const pAngle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const pRadius = (size / 2) * (0.5 + Math.random() * 0.5);
        points.push({ x: Math.cos(pAngle) * pRadius, y: Math.sin(pAngle) * pRadius });
      }

      shard.fillPoints(points, true);

      if (isEnergy) {
        shard.lineStyle(1, 0xffffff, 0.5);
        shard.strokePoints(points, true);
      }

      shard.setPosition(startX, startY);
      shard.setRotation(Math.random() * Math.PI * 2);

      const velocityX =
        (Math.cos(angle) * 0.5 + (Math.random() - 0.5)) *
        Phaser.Math.Between(config.minVelocity, config.maxVelocity);
      const velocityY =
        (Math.sin(angle) * 0.5 + (Math.random() - 0.5)) *
          Phaser.Math.Between(config.minVelocity, config.maxVelocity) -
        config.upwardForce;
      const gravity = config.gravity;
      const rotationSpeed = (Math.random() - 0.5) * config.rotationSpeedRange;
      const duration = Phaser.Math.Between(config.minDuration, config.maxDuration);

      this.scene.tweens.add({
        targets: shard,
        alpha: 0,
        duration: duration,
        ease: 'Cubic.easeIn',
        onUpdate: (_tween) => {
          const t = _tween.elapsed / 1000;
          const curX = startX + velocityX * t;
          const curY = startY + velocityY * t + 0.5 * gravity * t * t;
          shard.setPosition(curX, curY);
          shard.setRotation(shard.rotation + rotationSpeed * 0.016);
        },
        onComplete: () => shard.destroy(),
      });
    }

    for (let i = 0; i < config.sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spark = this.scene.add.circle(
        x + Math.cos(angle) * outerRadius,
        y + Math.sin(angle) * outerRadius,
        2,
        0xffffff,
        0.8
      );
      spark.setDepth(2001);

      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * config.sparkTravelDistance,
        y: spark.y + Math.sin(angle) * config.sparkTravelDistance,
        alpha: 0,
        scale: 0,
        duration: config.sparkDuration,
        onComplete: () => spark.destroy(),
      });
    }
  }
}