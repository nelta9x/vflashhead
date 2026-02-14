import Phaser from 'phaser';
import { Data } from '../../../../data/DataManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../../../../data/constants';
import type { HealthSystem } from '../../../../systems/HealthSystem';
import type { FeedbackSystem } from '../../../../systems/FeedbackSystem';
import type { SoundSystem } from '../../../../systems/SoundSystem';
import type { CursorSnapshot } from '../../../../scenes/game/GameSceneContracts';

interface BossDangerZoneControllerDeps {
  scene: Phaser.Scene;
  healthSystem: HealthSystem;
  feedbackSystem: FeedbackSystem;
  soundSystem: SoundSystem;
  isGameOver: () => boolean;
}

interface DangerZoneArea {
  x: number;
  y: number;
  radius: number;
}

interface ActiveDangerZone {
  bossId: string;
  startTime: number;
  waveNumber: number;
  isWarning: boolean;
  isExploding: boolean;
  zones: DangerZoneArea[];
  explodeTime: number;
  hitApplied: boolean;
  onComplete: () => void;
}

export class BossDangerZoneController {
  private readonly scene: Phaser.Scene;
  private readonly healthSystem: HealthSystem;
  private readonly feedbackSystem: FeedbackSystem;
  private readonly soundSystem: SoundSystem;
  private readonly isGameOver: () => boolean;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private activeDangerZones: ActiveDangerZone[] = [];
  private lastHitTime = 0;

  constructor(deps: BossDangerZoneControllerDeps) {
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
    cursor: CursorSnapshot,
    onComplete: () => void
  ): void {
    const config = Data.bossAttacks.dangerZone;
    const zoneCount = Phaser.Math.Between(config.zoneCount.min, config.zoneCount.max);
    const zones: DangerZoneArea[] = [];

    for (let i = 0; i < zoneCount; i++) {
      const radius = Phaser.Math.Between(config.zoneRadius.min, config.zoneRadius.max);
      const padding = config.spawnPadding + radius;

      // 커서 주변 또는 보스-커서 사이에 생성
      let x: number;
      let y: number;

      if (i === 0) {
        // 첫 번째 존은 커서 근처 (위협적)
        x = cursor.x + Phaser.Math.Between(-100, 100);
        y = cursor.y + Phaser.Math.Between(-100, 100);
      } else {
        // 나머지는 보스와 커서 사이 랜덤 영역
        const t = Math.random();
        x = bossX + (cursor.x - bossX) * t + Phaser.Math.Between(-120, 120);
        y = bossY + (cursor.y - bossY) * t + Phaser.Math.Between(-120, 120);
      }

      // 화면 내 제한
      x = Phaser.Math.Clamp(x, padding, GAME_WIDTH - padding);
      y = Phaser.Math.Clamp(y, padding, GAME_HEIGHT - padding);

      zones.push({ x, y, radius });
    }

    const dz: ActiveDangerZone = {
      bossId,
      startTime: gameTime,
      waveNumber,
      isWarning: true,
      isExploding: false,
      zones,
      explodeTime: 0,
      hitApplied: false,
      onComplete,
    };
    this.activeDangerZones.push(dz);
  }

  public update(_delta: number, gameTime: number, cursor: CursorSnapshot, cursorRadius: number): void {
    const config = Data.bossAttacks.dangerZone;

    for (let i = this.activeDangerZones.length - 1; i >= 0; i--) {
      const dz = this.activeDangerZones[i];

      if (dz.isWarning) {
        const elapsed = gameTime - dz.startTime;
        if (elapsed >= config.warningDuration) {
          if (this.isGameOver()) {
            dz.onComplete();
            this.activeDangerZones.splice(i, 1);
            continue;
          }
          dz.isWarning = false;
          dz.isExploding = true;
          dz.explodeTime = gameTime;
          this.scene.cameras.main.shake(200, 0.006);

          // 폭발 시 충돌 판정
          this.checkExplosionCollision(dz, gameTime, cursor, cursorRadius);
        }
      }

      if (dz.isExploding) {
        const explosionElapsed = gameTime - dz.explodeTime;
        if (explosionElapsed >= config.explosionDuration) {
          dz.onComplete();
          this.activeDangerZones.splice(i, 1);
        }
      }
    }

    this.render(gameTime);
  }

  private checkExplosionCollision(
    dz: ActiveDangerZone,
    gameTime: number,
    cursor: CursorSnapshot,
    cursorRadius: number
  ): void {
    const config = Data.bossAttacks.dangerZone;
    if (dz.hitApplied) return;
    if (gameTime - this.lastHitTime < config.invincibilityDuration) return;

    for (const zone of dz.zones) {
      const dist = Phaser.Math.Distance.Between(cursor.x, cursor.y, zone.x, zone.y);
      if (dist < cursorRadius + zone.radius) {
        dz.hitApplied = true;
        this.lastHitTime = gameTime;
        this.healthSystem.takeDamage(config.damage);
        this.feedbackSystem.onHpLost();
        this.soundSystem.playBossImpactSound();
        this.scene.cameras.main.shake(300, 0.01);
        return;
      }
    }
  }

  private render(gameTime: number): void {
    this.graphics.clear();
    const config = Data.bossAttacks.dangerZone;
    const warningColor = Phaser.Display.Color.HexStringToColor(config.warningColor).color;
    const explosionColor = Phaser.Display.Color.HexStringToColor(config.explosionColor).color;
    const coreColor = Phaser.Display.Color.HexStringToColor(config.explosionCoreColor).color;

    for (const dz of this.activeDangerZones) {
      if (dz.isWarning) {
        const elapsed = gameTime - dz.startTime;
        const progress = Math.min(1, elapsed / config.warningDuration);
        const blinkAlpha = 0.15 + Math.sin(progress * Math.PI * 6) * 0.2;

        for (const zone of dz.zones) {
          // 위험 영역 표시 (빨간 원)
          this.graphics.fillStyle(warningColor, blinkAlpha);
          this.graphics.fillCircle(zone.x, zone.y, zone.radius);

          // 테두리
          this.graphics.lineStyle(2, warningColor, blinkAlpha + 0.2);
          this.graphics.strokeCircle(zone.x, zone.y, zone.radius);

          // 경고가 진행됨에 따라 수축하는 내부 원
          const innerRadius = zone.radius * (1 - progress);
          this.graphics.lineStyle(1, warningColor, blinkAlpha + 0.3);
          this.graphics.strokeCircle(zone.x, zone.y, innerRadius);
        }
      }

      if (dz.isExploding) {
        const explosionElapsed = gameTime - dz.explodeTime;
        const explosionProgress = Math.min(1, explosionElapsed / config.explosionDuration);
        const fadeAlpha = 0.8 * (1 - explosionProgress);

        for (const zone of dz.zones) {
          const expandRadius = zone.radius * (1 + explosionProgress * 0.3);

          // 폭발 영역
          this.graphics.fillStyle(explosionColor, fadeAlpha * 0.4);
          this.graphics.fillCircle(zone.x, zone.y, expandRadius);

          // 코어
          this.graphics.fillStyle(coreColor, fadeAlpha * 0.6);
          this.graphics.fillCircle(zone.x, zone.y, expandRadius * 0.5);

          // 링
          this.graphics.lineStyle(3, explosionColor, fadeAlpha);
          this.graphics.strokeCircle(zone.x, zone.y, expandRadius);
        }
      }
    }
  }

  public clear(): void {
    for (const dz of this.activeDangerZones) {
      dz.onComplete();
    }
    this.activeDangerZones = [];
    this.graphics.clear();
  }

  public destroy(): void {
    this.clear();
    this.graphics.destroy();
  }
}
