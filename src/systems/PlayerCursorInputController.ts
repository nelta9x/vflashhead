import type Phaser from 'phaser';

type InputDevice = 'pointer' | 'keyboard';

interface MovementKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

export interface PlayerCursorInputControllerConfig {
  pointerPriorityMs: number;
  keyboardAxisRampUpMs: number;
}

export interface KeyboardAxisState {
  x: number;
  y: number;
  isMoving: boolean;
}

export class PlayerCursorInputController {
  private pointerPriorityMs: number = 0;
  private keyboardAxisRampUpMs: number = 1;
  private lastInputDevice: InputDevice = 'pointer';
  private lastPointerMoveAt: number = Number.NEGATIVE_INFINITY;

  private axisX: number = 0;
  private axisY: number = 0;

  private keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null = null;
  private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasdKeys: MovementKeys | null = null;
  private movementKeyDownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(config: PlayerCursorInputControllerConfig) {
    this.updateConfig(config);
  }

  public updateConfig(config: PlayerCursorInputControllerConfig): void {
    this.pointerPriorityMs = Math.max(0, config.pointerPriorityMs);
    this.keyboardAxisRampUpMs = Math.max(1, config.keyboardAxisRampUpMs);
  }

  public bindKeyboard(keyboard: Phaser.Input.Keyboard.KeyboardPlugin): void {
    this.unbindKeyboard();

    this.keyboard = keyboard;
    this.cursorKeys = keyboard.createCursorKeys();
    this.wasdKeys = {
      W: keyboard.addKey('W'),
      A: keyboard.addKey('A'),
      S: keyboard.addKey('S'),
      D: keyboard.addKey('D'),
    };

    this.movementKeyDownHandler = (event: KeyboardEvent) => {
      if (this.isMovementKeyCode(event.code)) {
        this.lastInputDevice = 'keyboard';
      }
    };
    keyboard.on('keydown', this.movementKeyDownHandler);
  }

  public unbindKeyboard(): void {
    if (this.keyboard && this.movementKeyDownHandler) {
      this.keyboard.off('keydown', this.movementKeyDownHandler);
    }

    this.keyboard = null;
    this.cursorKeys = null;
    this.wasdKeys = null;
    this.movementKeyDownHandler = null;
    this.axisX = 0;
    this.axisY = 0;
  }

  public onPointerInput(timestamp: number): void {
    this.lastInputDevice = 'pointer';
    this.lastPointerMoveAt = timestamp;
    this.axisX = 0;
    this.axisY = 0;
  }

  public getKeyboardAxis(deltaMs: number, timestamp: number): KeyboardAxisState {
    if (!this.shouldUseKeyboardMovement(timestamp)) {
      this.axisX = 0;
      this.axisY = 0;
      return { x: 0, y: 0, isMoving: false };
    }

    const targetX = this.resolveTargetAxisX();
    const targetY = this.resolveTargetAxisY();
    this.axisX = this.updateAxis(this.axisX, targetX, deltaMs);
    this.axisY = this.updateAxis(this.axisY, targetY, deltaMs);

    if (this.axisX === 0 && this.axisY === 0) {
      return { x: 0, y: 0, isMoving: false };
    }

    this.lastInputDevice = 'keyboard';

    let x = this.axisX;
    let y = this.axisY;
    const lengthSq = x * x + y * y;
    if (lengthSq > 1) {
      const factor = 1 / Math.sqrt(lengthSq);
      x *= factor;
      y *= factor;
    }

    return { x, y, isMoving: true };
  }

  public resetMovementInput(timestamp: number): void {
    this.keyboard?.resetKeys?.();

    this.cursorKeys?.left.reset();
    this.cursorKeys?.right.reset();
    this.cursorKeys?.up.reset();
    this.cursorKeys?.down.reset();
    this.wasdKeys?.W.reset();
    this.wasdKeys?.A.reset();
    this.wasdKeys?.S.reset();
    this.wasdKeys?.D.reset();

    this.axisX = 0;
    this.axisY = 0;
    this.lastInputDevice = 'pointer';
    this.lastPointerMoveAt = timestamp;
  }

  public shouldUseKeyboardMovement(timestamp: number): boolean {
    if (!this.hasMovementKeyDown()) {
      return false;
    }

    if (this.lastInputDevice !== 'pointer') {
      return true;
    }

    const elapsedSincePointerMove = timestamp - this.lastPointerMoveAt;
    return elapsedSincePointerMove > this.pointerPriorityMs;
  }

  public hasMovementKeyDown(): boolean {
    if (!this.cursorKeys || !this.wasdKeys) {
      return false;
    }

    return (
      this.cursorKeys.left.isDown ||
      this.cursorKeys.right.isDown ||
      this.cursorKeys.up.isDown ||
      this.cursorKeys.down.isDown ||
      this.wasdKeys.A.isDown ||
      this.wasdKeys.D.isDown ||
      this.wasdKeys.W.isDown ||
      this.wasdKeys.S.isDown
    );
  }

  private resolveTargetAxisX(): number {
    if (!this.cursorKeys || !this.wasdKeys) return 0;

    let x = 0;
    if (this.cursorKeys.left.isDown || this.wasdKeys.A.isDown) x -= 1;
    if (this.cursorKeys.right.isDown || this.wasdKeys.D.isDown) x += 1;
    return x;
  }

  private resolveTargetAxisY(): number {
    if (!this.cursorKeys || !this.wasdKeys) return 0;

    let y = 0;
    if (this.cursorKeys.up.isDown || this.wasdKeys.W.isDown) y -= 1;
    if (this.cursorKeys.down.isDown || this.wasdKeys.S.isDown) y += 1;
    return y;
  }

  private updateAxis(current: number, target: number, deltaMs: number): number {
    if (target === 0) {
      return 0;
    }

    if (current !== 0 && Math.sign(current) !== Math.sign(target)) {
      current = 0;
    }

    const step = Math.max(0, deltaMs) / this.keyboardAxisRampUpMs;
    const direction = Math.sign(target);
    const next = current + direction * step;

    if (direction > 0) {
      return Math.min(target, Math.min(1, next));
    }
    return Math.max(target, Math.max(-1, next));
  }

  private isMovementKeyCode(code: string): boolean {
    switch (code) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'KeyW':
      case 'KeyA':
      case 'KeyS':
      case 'KeyD':
        return true;
      default:
        return false;
    }
  }
}
