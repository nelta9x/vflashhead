import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import type { HealthSystem } from '../../../../systems/HealthSystem';
import type { FeedbackSystem } from '../FeedbackSystem';
import type { SoundSystem } from '../SoundSystem';
import type { CursorSnapshot } from '../../../../scenes/game/GameSceneContracts';

interface BossShockwaveControllerDeps {
  scene: Phaser.Scene;
  healthSystem: HealthSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  isGameOver: () => boolean;
}

interface ActiveShockwave {
  bossId: string;
  originX: number;
  originY: number;
  startTime: number;
  waveNumber: number;
  isWarning: boolean;
  isFiring: boolean;
  currentRadius: number;
  onComplete: () => void;
}

export class BossShockwaveController {
  private readonly scene: Phaser.Scene;
  private readonly healthSystem: HealthSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly isGameOver: () => boolean;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private activeShockwaves: ActiveShockwave[] = [];
  private lastHitTime = 0;

  constructor(deps: BossShockwaveControllerDeps) {
    this.scene = deps.scene;
    this.healthSystem = deps.healthSystem;
    this.feedbackSystem = deps.feedbackSystem;
    this.soundSystem = deps.soundSystem;
    this.isGameOver = deps.isGameOver;

    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(Data.gameConfig.depths.laser);
  }

  public trigger(
    bossId: string,
    bossX: number,
    bossY: number,
    gameTime: number,
    waveNumber: number,
    onComplete: () => void
  ): void {
    const shockwave: ActiveShockwave = {
      bossId,
      originX: bossX,
      originY: bossY,
      startTime: gameTime,
      waveNumber,
      isWarning: true,
      isFiring: false,
      currentRadius: 0,
      onComplete,
    };
    this.activeShockwaves.push(shockwave);
  }

  public update(delta: number, gameTime: number, cursor: CursorSnapshot, cursorRadius: number): void {
    const config = Data.bossAttacks.shockwave;

    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];

      if (sw.isWarning) {
        const elapsed = gameTime - sw.startTime;
        if (elapsed >= config.warningDuration) {
          if (this.isGameOver()) {
            sw.onComplete();
            this.activeShockwaves.splice(i, 1);
            continue;
          }
          sw.isWarning = false;
          sw.isFiring = true;
          sw.currentRadius = 0;
          sw.startTime = gameTime; // 리셋 타이밍
          this.scene.cameras.main.shake(150, 0.004);
        }
      }

      if (sw.isFiring) {
        const dtSec = delta / 1000;
        sw.currentRadius += config.ringSpeed * dtSec;

        // 충돌 판정
        this.checkCollision(sw, gameTime, cursor, cursorRadius);

        // 최대 반경 도달 → 완료
        if (sw.currentRadius >= config.maxRadius) {
          sw.onComplete();
          this.activeShockwaves.splice(i, 1);
        }
      }
    }

    this.render(gameTime);
  }

  private checkCollision(
    sw: ActiveShockwave,
    gameTime: number,
    cursor: CursorSnapshot,
    cursorRadius: number
  ): void {
    const config = Data.bossAttacks.shockwave;
    if (gameTime - this.lastHitTime < config.invincibilityDuration) return;

    const distToCenter = Phaser.Math.Distance.Between(
      cursor.x, cursor.y, sw.originX, sw.originY
    );

    // 링의 안쪽/바깥쪽 경계
    const innerEdge = sw.currentRadius - config.hitboxThickness / 2;
    const outerEdge = sw.currentRadius + config.hitboxThickness / 2;

    // 커서가 링 경계 안에 있는지 판정
    if (distToCenter + cursorRadius > innerEdge && distToCenter - cursorRadius < outerEdge) {
      this.lastHitTime = gameTime;
      this.healthSystem.takeDamage(config.damage);
      this.feedbackSystem.onHpLost();
      this.soundSystem.playBossImpactSound();
      this.scene.cameras.main.shake(200, 0.008);
    }
  }

  private render(gameTime: number): void {
    this.graphics.clear();
    const config = Data.bossAttacks.shockwave;
    const warningColor = Phaser.Display.Color.HexStringToColor(config.warningColor).color;
    const ringColor = Phaser.Display.Color.HexStringToColor(config.ringColor).color;
    const coreColor = Phaser.Display.Color.HexStringToColor(config.ringCoreColor).color;

    for (const sw of this.activeShockwaves) {
      if (sw.isWarning) {
        const elapsed = gameTime - sw.startTime;
        const progress = Math.min(1, elapsed / config.warningDuration);
        const blinkAlpha = 0.3 + Math.sin(progress * Math.PI * 10) * 0.4;
        const warningRadius = 15 + progress * 10;

        // 깜빡이는 작은 원
        this.graphics.fillStyle(warningColor, blinkAlpha);
        this.graphics.fillCircle(sw.originX, sw.originY, warningRadius);

        this.graphics.lineStyle(2, warningColor, blinkAlpha * 0.6);
        this.graphics.strokeCircle(sw.originX, sw.originY, warningRadius + 5);
      }

      if (sw.isFiring) {
        const fadeProgress = Math.min(1, sw.currentRadius / config.maxRadius);
        const alpha = 0.8 * (1 - fadeProgress * 0.6);

        // 메인 링
        this.graphics.lineStyle(config.ringThickness, ringColor, alpha);
        this.graphics.strokeCircle(sw.originX, sw.originY, sw.currentRadius);

        // 코어 링
        this.graphics.lineStyle(config.ringThickness * 0.4, coreColor, alpha * 0.8);
        this.graphics.strokeCircle(sw.originX, sw.originY, sw.currentRadius);

        // 외부 글로우
        this.graphics.lineStyle(config.ringThickness * 2, ringColor, alpha * 0.15);
        this.graphics.strokeCircle(sw.originX, sw.originY, sw.currentRadius);
      }
    }
  }

  public clear(): void {
    for (const sw of this.activeShockwaves) {
      sw.onComplete();
    }
    this.activeShockwaves = [];
    this.graphics.clear();
  }

  public destroy(): void {
    this.clear();
    this.graphics.destroy();
  }
}
