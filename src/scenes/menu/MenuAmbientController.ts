import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../../data/constants';
import { Data } from '../../data/DataManager';
import { CursorTrail } from '../../plugins/builtin/entities/CursorTrail';
import { CursorRenderer } from '../../plugins/builtin/entities/CursorRenderer';
import { DishRenderer } from '../../plugins/builtin/entities/DishRenderer';
import { ParticleManager } from '../../effects/ParticleManager';

interface MenuAmbientControllerDeps {
  scene: Phaser.Scene;
  menuDishes: Phaser.GameObjects.Group;
  cursorTrail: CursorTrail;
  cursorRenderer: CursorRenderer;
  particleManager: ParticleManager;
}

export class MenuAmbientController {
  private readonly scene: Phaser.Scene;
  private readonly menuDishes: Phaser.GameObjects.Group;
  private readonly cursorTrail: CursorTrail;
  private readonly cursorRenderer: CursorRenderer;
  private readonly particleManager: ParticleManager;

  private cursorPos = { x: 0, y: 0 };
  private cursorTime = 0;
  private lastDishSpawnTime = 0;

  constructor(deps: MenuAmbientControllerDeps) {
    this.scene = deps.scene;
    this.menuDishes = deps.menuDishes;
    this.cursorTrail = deps.cursorTrail;
    this.cursorRenderer = deps.cursorRenderer;
    this.particleManager = deps.particleManager;
  }

  public update(delta: number): void {
    this.updateMenuCursor(delta);
    this.updateMenuDishes(delta);
  }

  private updateMenuCursor(delta: number): void {
    const config = Data.mainMenu.cursor;
    this.cursorTime += delta;

    let targetX: number;
    let targetY: number;

    let nearestDish: Phaser.GameObjects.Graphics | null = null;
    let minDist = Infinity;

    for (const child of this.menuDishes.getChildren()) {
      const dish = child as Phaser.GameObjects.Graphics;
      const dist = Phaser.Math.Distance.Between(this.cursorPos.x, this.cursorPos.y, dish.x, dish.y);
      if (dist < minDist && dish.y > GAME_HEIGHT * config.trackingYThreshold) {
        minDist = dist;
        nearestDish = dish;
      }
    }

    if (nearestDish) {
      targetX = nearestDish.x;
      targetY = nearestDish.y;
    } else {
      const centerX = GAME_WIDTH / 2;
      const centerY = GAME_HEIGHT - config.yOffset;
      targetX = centerX + Math.sin(this.cursorTime * config.floatSpeed) * config.floatRangeX;
      targetY = centerY + Math.sin(this.cursorTime * config.floatSpeed * 1.5) * config.floatRangeY;
    }

    const lerpFactor = nearestDish ? config.lerpTracking : config.lerpIdle;
    this.cursorPos.x = Phaser.Math.Linear(this.cursorPos.x, targetX, lerpFactor);
    this.cursorPos.y = Phaser.Math.Linear(this.cursorPos.y, targetY, lerpFactor);

    const x = this.cursorPos.x;
    const y = this.cursorPos.y;

    const horizonY = GAME_HEIGHT * Data.mainMenu.grid.horizonRatio;
    const verticalRange = GAME_HEIGHT - horizonY;
    const perspectiveFactor = Phaser.Math.Clamp((y - horizonY) / verticalRange, 0, 1);
    const currentRadius = config.radius * (0.4 + perspectiveFactor * 0.6);

    this.cursorTrail.update(delta, currentRadius, x, y);
    this.cursorRenderer.renderMenuCursor(x, y, currentRadius, perspectiveFactor, this.cursorTime);
  }

  private updateMenuDishes(delta: number): void {
    const config = Data.mainMenu.dishSpawn;
    const gridConfig = Data.mainMenu.grid;
    const globalGridConfig = Data.gameConfig.gameGrid;
    const cursorConfig = Data.mainMenu.cursor;
    const horizonY = GAME_HEIGHT * gridConfig.horizonRatio;

    const randomInterval = Phaser.Math.Between(400, 800);
    if (this.scene.time.now - this.lastDishSpawnTime > randomInterval) {
      this.spawnMenuDish(horizonY, config);
      this.lastDishSpawnTime = this.scene.time.now;
    }

    const cursorRadius = cursorConfig.radius;

    this.menuDishes.getChildren().forEach((child: Phaser.GameObjects.GameObject) => {
      const dish = child as Phaser.GameObjects.Graphics;

      const verticalRange = GAME_HEIGHT - horizonY;
      const perspectiveFactor = (dish.y - horizonY) / verticalRange;
      const speed = globalGridConfig.speed * delta * (1 + perspectiveFactor * config.speedMultiplier);

      dish.y += speed;

      const scale = 0.2 + perspectiveFactor * 0.8;
      dish.setScale(scale);

      if (dish.y > GAME_HEIGHT + 50) {
        dish.destroy();
        return;
      }

      const dist = Phaser.Math.Distance.Between(dish.x, dish.y, this.cursorPos.x, this.cursorPos.y);
      const hitDist = config.radius * scale + cursorRadius * (0.4 + perspectiveFactor * 0.6);

      if (dist < hitDist) {
        const color = parseInt(config.color.replace('#', ''), 16);
        this.particleManager.createExplosion(dish.x, dish.y, color, 'basic', 0.5);
        this.particleManager.createHitEffect(dish.x, dish.y, COLORS.WHITE);
        dish.destroy();
      }
    });
  }

  private spawnMenuDish(
    horizonY: number,
    config: { spawnRangeX: number; color: string; radius: number }
  ): void {
    const spawnXRange = config.spawnRangeX || 300;
    const x = GAME_WIDTH / 2 + (Math.random() - 0.5) * spawnXRange;
    const y = horizonY;

    const dish = this.scene.add.graphics();
    dish.x = x;
    dish.y = y;

    const color = parseInt(config.color.replace('#', ''), 16);
    DishRenderer.renderMenuDish(dish, config.radius, color);

    this.menuDishes.add(dish);
  }
}
