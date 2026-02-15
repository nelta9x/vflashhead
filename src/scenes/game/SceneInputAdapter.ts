import Phaser from 'phaser';
import type { PlayerCursorInputController } from '../../systems/PlayerCursorInputController';

interface SceneInputAdapterDeps {
  scene: Phaser.Scene;
  inputController: PlayerCursorInputController;
  getInputTimestamp: () => number;
  applyCursorPosition: (x: number, y: number) => void;
  resetMovementInput: () => void;
  isGameOver: () => boolean;
  togglePause: () => void;
  toggleFps: () => void;
}

export class SceneInputAdapter {
  private readonly scene: Phaser.Scene;
  private readonly inputController: PlayerCursorInputController;
  private readonly getInputTimestamp: () => number;
  private readonly applyCursorPosition: (x: number, y: number) => void;
  private readonly resetMovementInput: () => void;
  private readonly isGameOver: () => boolean;
  private readonly togglePause: () => void;
  private readonly toggleFps: () => void;

  private tornDown = false;
  private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private pointerDownHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private escapeKeyHandler: (() => void) | null = null;
  private fpsKeyHandler: (() => void) | null = null;
  private gameOutHandler: ((..._args: unknown[]) => void) | null = null;
  private windowBlurHandler: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private shutdownHandler: (() => void) | null = null;

  constructor(deps: SceneInputAdapterDeps) {
    this.scene = deps.scene;
    this.inputController = deps.inputController;
    this.getInputTimestamp = deps.getInputTimestamp;
    this.applyCursorPosition = deps.applyCursorPosition;
    this.resetMovementInput = deps.resetMovementInput;
    this.isGameOver = deps.isGameOver;
    this.togglePause = deps.togglePause;
    this.toggleFps = deps.toggleFps;
  }

  public setup(): void {
    const keyboardPlugin = this.scene.input.keyboard;
    if (keyboardPlugin) {
      this.inputController.bindKeyboard(keyboardPlugin);
    }

    this.applyCursorPosition(
      this.scene.input.activePointer.worldX,
      this.scene.input.activePointer.worldY
    );
    this.inputController.onPointerInput(this.getInputTimestamp());

    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      this.applyCursorPosition(pointer.worldX, pointer.worldY);
      this.inputController.onPointerInput(this.getInputTimestamp());
    };
    this.scene.input.on('pointermove', this.pointerMoveHandler);

    this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      this.applyCursorPosition(pointer.worldX, pointer.worldY);
      this.inputController.onPointerInput(this.getInputTimestamp());
    };
    this.scene.input.on('pointerdown', this.pointerDownHandler);

    this.escapeKeyHandler = () => {
      if (this.isGameOver()) return;
      this.togglePause();
    };
    this.scene.input.keyboard?.on('keydown-ESC', this.escapeKeyHandler);

    this.fpsKeyHandler = () => {
      this.toggleFps();
    };
    this.scene.input.keyboard?.on('keydown-F', this.fpsKeyHandler);

    this.setupSafetyHandlers();
  }

  public teardown(): void {
    if (this.tornDown) return;
    this.tornDown = true;

    if (this.pointerMoveHandler) {
      this.scene.input.off('pointermove', this.pointerMoveHandler);
      this.pointerMoveHandler = null;
    }

    if (this.pointerDownHandler) {
      this.scene.input.off('pointerdown', this.pointerDownHandler);
      this.pointerDownHandler = null;
    }

    this.inputController.unbindKeyboard();

    if (this.escapeKeyHandler) {
      this.scene.input.keyboard?.off('keydown-ESC', this.escapeKeyHandler);
      this.escapeKeyHandler = null;
    }

    if (this.fpsKeyHandler) {
      this.scene.input.keyboard?.off('keydown-F', this.fpsKeyHandler);
      this.fpsKeyHandler = null;
    }

    if (this.gameOutHandler) {
      this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.gameOutHandler);
      this.gameOutHandler = null;
    }

    if (this.windowBlurHandler && typeof window !== 'undefined') {
      window.removeEventListener('blur', this.windowBlurHandler);
      this.windowBlurHandler = null;
    }

    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    if (this.shutdownHandler) {
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdownHandler, this);
      this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.shutdownHandler, this);
      this.shutdownHandler = null;
    }
  }

  private setupSafetyHandlers(): void {
    this.windowBlurHandler = () => {
      this.resetMovementInput();
    };
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.resetMovementInput();
      }
    };
    this.gameOutHandler = () => {
      this.resetMovementInput();
    };
    this.shutdownHandler = () => {
      this.teardown();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.windowBlurHandler);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    this.scene.input.on(Phaser.Input.Events.GAME_OUT, this.gameOutHandler);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownHandler, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.shutdownHandler, this);
  }
}
