import Phaser from 'phaser';

interface MenuInputControllerDeps {
  scene: Phaser.Scene;
  isInsideSafeArea: (x: number, y: number) => boolean;
  onStartGame: () => void;
}

export class MenuInputController {
  private readonly scene: Phaser.Scene;
  private readonly isInsideSafeArea: (x: number, y: number) => boolean;
  private readonly onStartGame: () => void;

  private nativeMouseDownHandler: ((event: MouseEvent) => void) | null = null;
  private nativeKeyDownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(deps: MenuInputControllerDeps) {
    this.scene = deps.scene;
    this.isInsideSafeArea = deps.isInsideSafeArea;
    this.onStartGame = deps.onStartGame;
  }

  public setup(): void {
    this.cleanupNativeInputListeners();

    this.nativeMouseDownHandler = (event: MouseEvent) => {
      const gamePoint = this.getGamePointFromClientPosition(event.clientX, event.clientY);
      if (!gamePoint) return;
      if (this.isInsideSafeArea(gamePoint.x, gamePoint.y)) return;
      this.onStartGame();
    };

    this.nativeKeyDownHandler = () => {
      this.onStartGame();
    };

    window.addEventListener('mousedown', this.nativeMouseDownHandler);
    window.addEventListener('keydown', this.nativeKeyDownHandler);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupNativeInputListeners();
    });
  }

  public cleanupNativeInputListeners(): void {
    if (this.nativeMouseDownHandler) {
      window.removeEventListener('mousedown', this.nativeMouseDownHandler);
      this.nativeMouseDownHandler = null;
    }

    if (this.nativeKeyDownHandler) {
      window.removeEventListener('keydown', this.nativeKeyDownHandler);
      this.nativeKeyDownHandler = null;
    }
  }

  private getGamePointFromClientPosition(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    const canvas = this.scene.scale.canvas;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();
    if (
      clientX < bounds.left ||
      clientX > bounds.right ||
      clientY < bounds.top ||
      clientY > bounds.bottom ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      return null;
    }

    const x = ((clientX - bounds.left) / bounds.width) * this.scene.scale.width;
    const y = ((clientY - bounds.top) / bounds.height) * this.scene.scale.height;

    return { x, y };
  }
}
