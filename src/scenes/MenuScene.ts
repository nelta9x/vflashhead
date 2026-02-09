import Phaser from 'phaser';
import { COLORS, COLORS_HEX, GAME_WIDTH, GAME_HEIGHT, FONTS } from '../data/constants';
import { Data } from '../data/DataManager';
import { SoundSystem } from '../systems/SoundSystem';
import { CursorTrail } from '../effects/CursorTrail';
import { ParticleManager } from '../effects/ParticleManager';
import { StarBackground } from '../effects/StarBackground';
import { GridRenderer } from '../effects/GridRenderer';
import { MenuBossRenderer } from '../effects/MenuBossRenderer';
import { CursorRenderer } from '../effects/CursorRenderer';
import { LanguageSelectorWidget } from './menu/LanguageSelectorWidget';
import { MenuAmbientController } from './menu/MenuAmbientController';
import { MenuInputController } from './menu/MenuInputController';

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private startPrompt!: Phaser.GameObjects.Text;
  private isTransitioning: boolean = false;
  private gridRenderer!: GridRenderer;
  private bossRenderer!: MenuBossRenderer;
  private starBackground!: StarBackground;
  private cursorRenderer!: CursorRenderer;
  private cursorTrail!: CursorTrail;
  private particleManager!: ParticleManager;
  private menuDishes!: Phaser.GameObjects.Group;
  private ambientController!: MenuAmbientController;
  private inputController!: MenuInputController;
  private languageSelector!: LanguageSelectorWidget;

  private bestWaveText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.isTransitioning = false;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.DARK_BG).setOrigin(0, 0).setDepth(-10);

    this.starBackground = new StarBackground(this, Data.mainMenu.stars);
    this.bossRenderer = new MenuBossRenderer(this);
    this.gridRenderer = new GridRenderer(this);

    this.particleManager = new ParticleManager(this);
    this.menuDishes = this.add.group();

    this.cursorTrail = new CursorTrail(this);
    this.cursorRenderer = new CursorRenderer(this);

    this.ambientController = new MenuAmbientController({
      scene: this,
      menuDishes: this.menuDishes,
      cursorTrail: this.cursorTrail,
      cursorRenderer: this.cursorRenderer,
      particleManager: this.particleManager,
    });

    SoundSystem.getInstance().setScene(this);

    this.createTitle();
    this.createStartUI();
    this.createBestWave();

    this.languageSelector = new LanguageSelectorWidget({
      scene: this,
      onLanguageChanged: () => {
        this.scene.restart();
      },
    });

    this.inputController = new MenuInputController({
      scene: this,
      isInsideSafeArea: (x, y) => this.languageSelector.isInsideSafeArea(x, y),
      onStartGame: () => {
        void this.startGame();
      },
    });
    this.inputController.setup();
  }

  private createTitle(): void {
    const config = Data.mainMenu.title;
    this.titleText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - config.yOffset,
      Data.t('menu.title'),
      {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: config.color,
        fontStyle: 'italic bold',
      }
    );
    this.titleText.setOrigin(0.5);
    this.titleText.setPadding(config.padding, config.padding, config.padding, config.padding);
    this.titleText.setShadow(0, 0, config.shadowColor, config.shadowBlur, true, true);

    this.tweens.add({
      targets: this.titleText,
      y: GAME_HEIGHT / 2 - config.moveY,
      duration: config.moveDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createStartUI(): void {
    const config = Data.mainMenu.startPrompt;
    this.startPrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + config.yOffset, Data.t('menu.start'), {
      fontFamily: FONTS.MAIN,
      fontSize: config.fontSize,
      color: Data.getColorHex(config.color),
    });
    this.startPrompt.setOrigin(0.5);
    this.startPrompt.setShadow(0, 0, COLORS_HEX.CYAN, 10, true, true);

    this.tweens.add({
      targets: this.startPrompt,
      alpha: 0.2,
      scale: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Cubic.easeInOut',
    });
  }

  private createBestWave(): void {
    const config = Data.mainMenu.bestWave;
    const bestWave = parseInt(localStorage.getItem(config.localStorageKey) || '0', 10);

    if (bestWave <= 0) return;

    this.bestWaveText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 150 - config.yOffset,
      Data.t('menu.best_wave', bestWave),
      {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: COLORS_HEX.WHITE,
      }
    );
    this.bestWaveText.setOrigin(0.5);
    this.bestWaveText.setAlpha(config.alpha);
    this.bestWaveText.setShadow(0, 0, COLORS_HEX.CYAN, 6, true, true);
  }

  update(time: number, delta: number): void {
    const globalConfig = Data.gameConfig.gameGrid;
    this.gridRenderer.update(delta);
    this.starBackground.update(delta, time, globalConfig.speed);
    this.bossRenderer.update(delta);
    this.ambientController.update(delta);
  }

  private async startGame(): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.inputController.cleanupNativeInputListeners();

    const ss = SoundSystem.getInstance();
    await ss.init();

    ss.playSafeSound();

    this.tweens.add({
      targets: [this.titleText, this.startPrompt, this.bestWaveText].filter(Boolean),
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.scene.start('GameScene');
      },
    });

    this.cameras.main.fadeOut(400, 0, 0, 0);
  }
}
