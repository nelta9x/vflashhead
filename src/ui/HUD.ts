import Phaser from 'phaser';
import { GAME_WIDTH, COLORS_HEX, INITIAL_HP, FONTS } from '../data/constants';
import { Data } from '../data/DataManager';
import { WaveSystem } from '../systems/WaveSystem';
import { HealthSystem } from '../systems/HealthSystem';

export class HUD {
  private scene: Phaser.Scene;
  private waveSystem: WaveSystem;
  private healthSystem: HealthSystem | null = null;

  // UI 요소들
  private waveText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private feverText!: Phaser.GameObjects.Text;

  // HP UI
  private hpContainer!: Phaser.GameObjects.Container;
  private hpHearts: Phaser.GameObjects.Graphics[] = [];
  private hpBlinkTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, waveSystem: WaveSystem, healthSystem?: HealthSystem) {
    this.scene = scene;
    this.waveSystem = waveSystem;
    this.healthSystem = healthSystem || null;

    this.createUI();
  }

  private createUI(): void {
    // 웨이브 (우측 상단, 타이머 위)
    const textCfg = Data.gameConfig.textSettings;
    this.waveText = this.scene.add.text(GAME_WIDTH - 20, 10, Data.t('hud.wave', 1), {
      fontFamily: FONTS.MAIN,
      fontSize: `${textCfg.hud.waveSize}px`,
      fontStyle: 'normal',
      color: COLORS_HEX.WHITE,
      stroke: '#000000',
      strokeThickness: textCfg.hud.strokeThickness,
      resolution: textCfg.resolution,
    });
    this.waveText.setOrigin(1, 0);

    // 생존 시간 (우측 상단) - 정순 카운트
    this.timerText = this.scene.add.text(GAME_WIDTH - 20, 32, '0:00', {
      fontFamily: FONTS.MAIN,
      fontSize: `${textCfg.hud.timerSize}px`,
      fontStyle: 'normal',
      color: COLORS_HEX.GREEN,
      stroke: '#000000',
      strokeThickness: textCfg.hud.timerStrokeThickness,
      resolution: textCfg.resolution,
    });
    this.timerText.setOrigin(1, 0);

    // 피버 타임 텍스트 (숨김)
    this.feverText = this.scene.add.text(GAME_WIDTH / 2, 100, Data.t('hud.fever_time'), {
      fontFamily: FONTS.MAIN,
      fontSize: `${textCfg.hud.feverSize}px`,
      fontStyle: 'normal',
      color: COLORS_HEX.YELLOW,
      stroke: COLORS_HEX.RED,
      strokeThickness: textCfg.hud.timerStrokeThickness,
      resolution: textCfg.resolution,
    });
    this.feverText.setOrigin(0.5, 0);
    this.feverText.setVisible(false);

    // HP 표시 생성
    this.createHpDisplay();
  }

  private createHpDisplay(): void {
    const config = Data.gameConfig.hud.hpDisplay;
    const maxHp = this.healthSystem?.getMaxHp() ?? INITIAL_HP;
    const startX = config.startX;
    const startY = config.startY;
    const heartSpacing = config.spacing;

    this.hpContainer = this.scene.add.container(startX, startY);

    // 하트 아이콘들 생성
    for (let i = 0; i < maxHp; i++) {
      const heart = this.scene.add.graphics();
      heart.setPosition(i * heartSpacing, 0);
      this.drawHeart(heart, true);
      this.hpHearts.push(heart);
      this.hpContainer.add(heart);
    }
  }

  private drawHeart(graphics: Phaser.GameObjects.Graphics, filled: boolean): void {
    graphics.clear();

    const config = Data.gameConfig.hud.hpDisplay;
    const filledColor = Data.getColor(config.filledColor);
    const emptyColor = Data.getColor(config.emptyColor);

    const color = filled ? filledColor : emptyColor;
    const alpha = filled ? 1 : 0.5;

    graphics.fillStyle(color, alpha);

    // 심장 모양 그리기 (간단한 버전)
    const size = config.heartSize;
    graphics.fillCircle(-size / 2, 0, size / 2);
    graphics.fillCircle(size / 2, 0, size / 2);
    graphics.fillTriangle(-size, 0, size, 0, 0, size * 1.2);

    if (filled) {
      // 글로우 효과
      graphics.fillStyle(color, 0.3);
      graphics.fillCircle(0, size / 3, size * 1.2);
    }
  }

  updateHpDisplay(): void {
    if (!this.healthSystem) return;

    const currentHp = this.healthSystem.getHp();
    const maxHp = this.healthSystem.getMaxHp();

    // 만약 현재 하트 개수가 최대 체력과 다르면 조정
    if (this.hpHearts.length !== maxHp) {
      this.syncHpHearts(maxHp);
    }

    for (let i = 0; i < this.hpHearts.length; i++) {
      const filled = i < currentHp;
      this.drawHeart(this.hpHearts[i], filled);
    }

    // HP 1일 때 깜빡임 효과
    if (currentHp === 1 && !this.hpBlinkTween) {
      this.hpBlinkTween = this.scene.tweens.add({
        targets: this.hpHearts[0],
        alpha: { from: 1, to: 0.3 },
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    } else if (currentHp !== 1 && this.hpBlinkTween) {
      this.hpBlinkTween.stop();
      this.hpBlinkTween = null;
      if (this.hpHearts[0]) {
        this.hpHearts[0].setAlpha(1);
      }
    }
  }

  private syncHpHearts(maxHp: number): void {
    const config = Data.gameConfig.hud.hpDisplay;
    const heartSpacing = config.spacing;

    // 부족한 만큼 추가
    while (this.hpHearts.length < maxHp) {
      const i = this.hpHearts.length;
      const heart = this.scene.add.graphics();
      heart.setPosition(i * heartSpacing, 0);
      this.hpHearts.push(heart);
      this.hpContainer.add(heart);
    }

    // 넘치는 만큼 제거
    while (this.hpHearts.length > maxHp) {
      const heart = this.hpHearts.pop();
      heart?.destroy();
    }
  }

  showHpLoss(): void {
    // HP 감소 시 빨간 플래시 + 흔들림
    this.scene.tweens.add({
      targets: this.hpContainer,
      x: this.hpContainer.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }

  setHealthSystem(healthSystem: HealthSystem): void {
    this.healthSystem = healthSystem;
    this.updateHpDisplay();
  }

  update(gameTime: number): void {
    // HP 업데이트
    this.updateHpDisplay();

    // 생존 시간 업데이트 (정순 카운트)
    this.timerText.setText(this.formatTime(gameTime));

    // 생존 시간에 따라 색상 변경 (오래 버틸수록 밝아짐)
    const hudConfig = Data.gameConfig.hud;
    const thresholds = hudConfig.timerThresholds;
    const colors = hudConfig.timerColors;

    if (gameTime >= thresholds.ultra) {
      this.timerText.setColor(Data.getColorHex(colors.ultra));
    } else if (gameTime >= thresholds.high) {
      this.timerText.setColor(Data.getColorHex(colors.high));
    } else if (gameTime >= thresholds.mid) {
      this.timerText.setColor(Data.getColorHex(colors.mid));
    } else {
      this.timerText.setColor(Data.getColorHex(colors.default));
    }

    // 웨이브 업데이트
    const wave = this.waveSystem.getCurrentWave();
    const isFever = this.waveSystem.isFever();

    if (isFever) {
      this.waveText.setText(Data.t('hud.fever'));
      this.waveText.setColor(COLORS_HEX.YELLOW);
      this.feverText.setVisible(true);

      // 피버 텍스트 애니메이션
      if (!this.scene.tweens.isTweening(this.feverText)) {
        this.scene.tweens.add({
          targets: this.feverText,
          scaleX: { from: 1, to: 1.1 },
          scaleY: { from: 1, to: 1.1 },
          duration: 300,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      this.waveText.setText(Data.t('hud.wave', wave));
      this.waveText.setColor(COLORS_HEX.WHITE);
      this.feverText.setVisible(false);
    }
  }

  showWaveComplete(waveNumber: number): void {
    const textCfg = Data.gameConfig.textSettings;
    const text = this.scene.add.text(GAME_WIDTH / 2, 200, Data.t('hud.wave_complete', waveNumber), {
      fontFamily: FONTS.MAIN,
      fontSize: `${textCfg.hud.completeSize}px`,
      fontStyle: 'normal',
      color: COLORS_HEX.GREEN,
      stroke: '#000000',
      strokeThickness: textCfg.hud.timerStrokeThickness,
      resolution: textCfg.resolution,
    });
    text.setOrigin(0.5);

    this.scene.tweens.add({
      targets: text,
      y: 150,
      alpha: { from: 1, to: 0 },
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
