import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../../../../data/constants';
import type { HealthSystem } from '../../../../systems/HealthSystem';
import type { FeedbackSystem } from '../../../../systems/FeedbackSystem';
import type { SoundSystem } from '../../../../systems/SoundSystem';
import type { CursorSnapshot } from '../../../../scenes/game/GameSceneContracts';

interface BossBulletSpreadControllerDeps {
  scene: Phaser.Scene;
  healthSystem: HealthSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  isGameOver: () => boolean;
}

interface ActiveProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bossId: string;
  spawnTime: number;
}

interface ActiveBulletSpread {
  bossId: string;
  originX: number;
  originY: number;
  startTime: number;
  waveNumber: number;
  isWarning: boolean;
  isFiring: boolean;
  projectiles: ActiveProjectile[];
  onComplete: () => void;
}

export class BossBulletSpreadController {
  private readonly scene: Phaser.Scene;
  private readonly healthSystem: HealthSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly isGameOver: () => boolean;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private activeSpreads: ActiveBulletSpread[] = [];
  private lastHitTime = 0;

  constructor(deps: BossBulletSpreadControllerDeps) {
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
    const spread: ActiveBulletSpread = {
      bossId,
      originX: bossX,
      originY: bossY,
      startTime: gameTime,
      waveNumber,
      isWarning: true,
      isFiring: false,
      projectiles: [],
      onComplete,
    };
    this.activeSpreads.push(spread);
  }

  public update(delta: number, gameTime: number, cursor: CursorSnapshot, cursorRadius: number): void {
    const config = Data.bossAttacks.bulletSpread;

    for (let i = this.activeSpreads.length - 1; i >= 0; i--) {
      const spread = this.activeSpreads[i];

      if (spread.isWarning) {
        const elapsed = gameTime - spread.startTime;
        if (elapsed >= config.warningDuration) {
          // 경고 완료 → 탄막 발사
          if (this.isGameOver()) {
            spread.onComplete();
            this.activeSpreads.splice(i, 1);
            continue;
          }
          spread.isWarning = false;
          spread.isFiring = true;
          this.spawnProjectiles(spread, gameTime);
          this.scene.cameras.main.shake(150, 0.003);
        }
      }

      if (spread.isFiring) {
        // 투사체 이동
        const dtSec = delta / 1000;
        for (let j = spread.projectiles.length - 1; j >= 0; j--) {
          const p = spread.projectiles[j];
          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;

          // 화면 밖 또는 수명 초과 제거
          const age = gameTime - p.spawnTime;
          if (
            age > config.projectileLifetime ||
            p.x < -50 || p.x > GAME_WIDTH + 50 ||
            p.y < -50 || p.y > GAME_HEIGHT + 50
          ) {
            spread.projectiles.splice(j, 1);
          }
        }

        // 충돌 판정
        this.checkCollisions(spread, gameTime, cursor, cursorRadius);

        // 모든 투사체 소진 → 완료
        if (spread.projectiles.length === 0) {
          spread.onComplete();
          this.activeSpreads.splice(i, 1);
        }
      }
    }

    this.render(gameTime);
  }

  private spawnProjectiles(spread: ActiveBulletSpread, gameTime: number): void {
    const config = Data.bossAttacks.bulletSpread;
    const count = config.projectileCount;
    const angleStep = (config.spreadAngleDeg * Math.PI / 180) / count;
    const startAngle = Math.random() * Math.PI * 2; // 랜덤 시작 각도

    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep;
      spread.projectiles.push({
        x: spread.originX,
        y: spread.originY,
        vx: Math.cos(angle) * config.projectileSpeed,
        vy: Math.sin(angle) * config.projectileSpeed,
        bossId: spread.bossId,
        spawnTime: gameTime,
      });
    }
  }

  private checkCollisions(
    spread: ActiveBulletSpread,
    gameTime: number,
    cursor: CursorSnapshot,
    cursorRadius: number
  ): void {
    const config = Data.bossAttacks.bulletSpread;
    if (gameTime - this.lastHitTime < config.invincibilityDuration) return;

    for (const p of spread.projectiles) {
      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, p.x, p.y);
      if (dist < cursorRadius + config.hitboxRadius) {
        this.lastHitTime = gameTime;
        this.healthSystem.takeDamage(config.damage);
        this.feedbackSystem.onHpLost();
        this.soundSystem.playBossImpactSound();
        this.scene.cameras.main.shake(200, 0.008);
        return;
      }
    }
  }

  private render(gameTime: number): void {
    this.graphics.clear();
    const config = Data.bossAttacks.bulletSpread;
    const warningColor = Phaser.Display.Color.HexStringToColor(config.warningColor).color;
    const projectileColor = Phaser.Display.Color.HexStringToColor(config.projectileColor).color;
    const coreColor = Phaser.Display.Color.HexStringToColor(config.projectileCoreColor).color;

    for (const spread of this.activeSpreads) {
      if (spread.isWarning) {
        // 경고: 팽창하는 링 펄스
        const elapsed = gameTime - spread.startTime;
        const progress = Math.min(1, elapsed / config.warningDuration);
        const pulseRadius = 20 + progress * 60;
        const alpha = 0.3 + Math.sin(progress * Math.PI * 8) * 0.3;

        this.graphics.lineStyle(2, warningColor, alpha);
        this.graphics.strokeCircle(spread.originX, spread.originY, pulseRadius);

        // 내부 원
        this.graphics.fillStyle(warningColor, alpha * 0.3);
        this.graphics.fillCircle(spread.originX, spread.originY, pulseRadius * 0.5);
      }

      if (spread.isFiring) {
        // 투사체 렌더링
        for (const p of spread.projectiles) {
          // 외부 글로우
          this.graphics.fillStyle(projectileColor, 0.3);
          this.graphics.fillCircle(p.x, p.y, config.projectileSize * 2);

          // 본체
          this.graphics.fillStyle(projectileColor, 0.8);
          this.graphics.fillCircle(p.x, p.y, config.projectileSize);

          // 코어
          this.graphics.fillStyle(coreColor, 0.9);
          this.graphics.fillCircle(p.x, p.y, config.projectileSize * 0.5);
        }
      }
    }
  }

  public clear(): void {
    for (const spread of this.activeSpreads) {
      spread.onComplete();
    }
    this.activeSpreads = [];
    this.graphics.clear();
  }

  public destroy(): void {
    this.clear();
    this.graphics.destroy();
  }
}
