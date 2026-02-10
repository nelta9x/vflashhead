import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, DEPTHS } from '../data/constants';
import { Data } from '../data/DataManager';

export class WaveCountdownUI {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private waveLabel!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const config = Data.gameConfig.waveCountdownUI;
    this.container = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.container.setDepth(DEPTHS.waveCountdown);
    this.container.setVisible(false);
    this.container.setAlpha(0);

    // "WAVE X STARTING IN" 라벨
    this.waveLabel = this.scene.add
      .text(0, config.label.yOffset, '', {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.label.fontSize}px`,
        color: Data.getColorHex(config.label.color),
      })
      .setOrigin(0.5);
    this.container.add(this.waveLabel);

    // 카운트다운 숫자
    this.countdownText = this.scene.add
      .text(0, config.number.yOffset, '', {
        fontFamily: FONTS.MAIN,
        fontSize: `${config.number.fontSize}px`,
        color: Data.getColorHex(config.number.color),
        stroke: Data.getColorHex(config.number.stroke),
        strokeThickness: config.number.strokeThickness,
      })
      .setOrigin(0.5);
    this.container.add(this.countdownText);
  }

  show(waveNumber: number): void {
    if (this.visible) return;

    const config = Data.gameConfig.waveCountdownUI;
    this.visible = true;
    this.waveLabel.setText(Data.t('hud.wave_starting', waveNumber));
    
    // 설정된 시작 카운트 값 표시 (예: countFrom=3 -> '3')
    const initialCount = Math.max(1, Data.gameConfig.waveTransition.countFrom ?? 3);
    this.countdownText.setText(initialCount.toString());
    this.countdownText.setColor(Data.getColorHex(config.number.color));
    
    this.container.setVisible(true);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
  }

  hide(): void {
    if (!this.visible) return;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.visible = false;
        this.container.setVisible(false);
      },
    });
  }

  updateCountdown(seconds: number): void {
    if (!this.visible) return;

    const config = Data.gameConfig.waveCountdownUI;
    this.countdownText.setText(seconds.toString());

    // 펄스 애니메이션
    this.countdownText.setScale(1.3);
    this.scene.tweens.add({
      targets: this.countdownText,
      scale: 1,
      duration: 200,
      ease: 'Back.out',
    });

    // 0일 때 "GO!" 표시
    if (seconds === 0) {
      this.countdownText.setText(Data.t('hud.go'));
      this.countdownText.setColor(Data.getColorHex(config.number.goColor));
    } else {
      this.countdownText.setColor(Data.getColorHex(config.number.color));
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}
