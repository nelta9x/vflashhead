import Phaser from 'phaser';

export class ScreenShake {
  static inject = [Phaser.Scene] as const;
  private scene: Phaser.Scene;
  private isShaking: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  shake(intensity: number = 5, duration: number = 100): void {
    if (this.isShaking) return;

    this.isShaking = true;

    this.scene.cameras.main.shake(duration, intensity / 1000);

    this.scene.time.delayedCall(duration, () => {
      this.isShaking = false;
    });
  }

  heavyShake(): void {
    this.shake(15, 200);
  }

  lightShake(): void {
    this.shake(3, 50);
  }
}
