import Phaser from 'phaser';

export class SlowMotion {
  private scene: Phaser.Scene;
  private isActive: boolean = false;
  private targetTimeScale: number = 1;
  private duration: number = 0;
  private elapsed: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  trigger(timeScale: number = 0.3, duration: number = 500): void {
    if (this.isActive) return;

    this.isActive = true;
    this.targetTimeScale = timeScale;
    this.duration = duration;
    this.elapsed = 0;

    // 즉시 슬로우 모션 적용
    this.scene.time.timeScale = timeScale;
    this.scene.physics.world.timeScale = 1 / timeScale;
  }

  update(delta: number): void {
    if (!this.isActive) return;

    this.elapsed += delta;

    if (this.elapsed >= this.duration) {
      // 슬로우 모션 종료
      this.scene.time.timeScale = 1;
      this.scene.physics.world.timeScale = 1;
      this.isActive = false;
    } else {
      // 점진적 복구 (마지막 30%에서)
      const recoveryStart = this.duration * 0.7;
      if (this.elapsed > recoveryStart) {
        const recoveryProgress = (this.elapsed - recoveryStart) / (this.duration - recoveryStart);
        const newTimeScale = this.targetTimeScale + (1 - this.targetTimeScale) * recoveryProgress;

        this.scene.time.timeScale = newTimeScale;
        this.scene.physics.world.timeScale = 1 / newTimeScale;
      }
    }
  }

  isSlowMotionActive(): boolean {
    return this.isActive;
  }

  forceStop(): void {
    this.scene.time.timeScale = 1;
    this.scene.physics.world.timeScale = 1;
    this.isActive = false;
  }
}
