import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS_HEX, FONTS } from '../../data/constants';
import { Data } from '../../data/DataManager';
import { WaveSystem } from '../../systems/WaveSystem';

export class WaveTimerWidget {
  private readonly scene: Phaser.Scene;
  private readonly waveSystem: WaveSystem;
  private waveText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private feverText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, waveSystem: WaveSystem) {
    this.scene = scene;
    this.waveSystem = waveSystem;

    const textCfg = Data.gameConfig.textSettings;
    const waveTimerCfg = Data.gameConfig.hud.waveTimerDisplay;
    const rightX = GAME_WIDTH - waveTimerCfg.rightMargin;
    const timerY = GAME_HEIGHT - waveTimerCfg.bottomMargin;
    const waveY = timerY - waveTimerCfg.spacing;

    this.waveText = this.scene.add.text(rightX, waveY, Data.t('hud.wave', 1), {
      fontFamily: FONTS.MAIN,
      fontSize: `${textCfg.hud.waveSize}px`,
      fontStyle: 'normal',
      color: COLORS_HEX.WHITE,
      stroke: '#000000',
      strokeThickness: textCfg.hud.strokeThickness,
      resolution: textCfg.resolution,
    });
    this.waveText.setOrigin(1, 1);
    this.waveText.setVisible(false);

    this.timerText = this.scene.add.text(rightX, timerY, '0:00', {
      fontFamily: FONTS.MAIN,
      fontSize: `${textCfg.hud.timerSize}px`,
      fontStyle: 'normal',
      color: COLORS_HEX.GREEN,
      stroke: '#000000',
      strokeThickness: textCfg.hud.timerStrokeThickness,
      resolution: textCfg.resolution,
    });
    this.timerText.setOrigin(1, 1);
    this.timerText.setVisible(false);

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
  }

  public setWaveTimerVisible(visible: boolean): void {
    this.waveText.setVisible(visible);
    this.timerText.setVisible(visible);
  }

  public update(gameTime: number): void {
    this.timerText.setText(this.formatTime(gameTime));
    this.updateTimerColor(gameTime);

    const wave = this.waveSystem.getCurrentWave();
    const isFever = this.waveSystem.isFever();

    if (isFever) {
      this.waveText.setText(Data.t('hud.fever'));
      this.waveText.setColor(COLORS_HEX.YELLOW);
      this.feverText.setVisible(true);

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
      return;
    }

    this.waveText.setText(Data.t('hud.wave', wave));
    this.waveText.setColor(COLORS_HEX.WHITE);
    this.feverText.setVisible(false);
  }

  public showWaveComplete(waveNumber: number): void {
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

  private updateTimerColor(gameTime: number): void {
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
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
