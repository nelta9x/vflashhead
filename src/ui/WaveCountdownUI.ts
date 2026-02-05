import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONTS } from '../../data/constants';

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
    this.container = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.container.setDepth(850);
    this.container.setVisible(false);
    this.container.setAlpha(0);

    // "WAVE X STARTING IN" 라벨
    this.waveLabel = this.scene.add.text(0, -60, '', {
              fontFamily: FONTS.MAIN,      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(this.waveLabel);

    // 카운트다운 숫자
    this.countdownText = this.scene.add.text(0, 20, '', {
              fontFamily: FONTS.MAIN,      fontSize: '120px',
      color: '#00ffff',
      stroke: '#003333',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.container.add(this.countdownText);
  }

  show(waveNumber: number): void {
    if (this.visible) return;

    this.visible = true;
    this.waveLabel.setText(`WAVE ${waveNumber} STARTING IN`);
    this.countdownText.setText('5');
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
      this.countdownText.setText('GO!');
      this.countdownText.setColor('#00ff88');
    } else {
      this.countdownText.setColor('#00ffff');
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}
