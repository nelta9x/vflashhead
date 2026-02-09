import Phaser from 'phaser';
import { COLORS_HEX, FONTS } from '../../data/constants';
import { Data } from '../../data/DataManager';

interface LanguageSelectorWidgetDeps {
  scene: Phaser.Scene;
  onLanguageChanged: () => void;
}

export class LanguageSelectorWidget {
  private readonly scene: Phaser.Scene;
  private readonly onLanguageChanged: () => void;
  private readonly container: Phaser.GameObjects.Container;
  private safeArea: Phaser.Geom.Rectangle | null = null;

  constructor(deps: LanguageSelectorWidgetDeps) {
    this.scene = deps.scene;
    this.onLanguageChanged = deps.onLanguageChanged;
    this.container = this.createWidget();
    this.updateSafeArea();
  }

  public isInsideSafeArea(x: number, y: number): boolean {
    return this.safeArea?.contains(x, y) ?? false;
  }

  private createWidget(): Phaser.GameObjects.Container {
    const config = Data.mainMenu.languageUI;
    const currentLang = Data.getLanguage();
    const container = this.scene.add.container(config.x, config.y);

    const enText = this.scene.add
      .text(-config.spacing * 2, 0, 'EN', {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: currentLang === 'en' ? COLORS_HEX.CYAN : COLORS_HEX.WHITE,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    const separator = this.scene.add
      .text(-config.spacing, 0, '|', {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: COLORS_HEX.WHITE,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.3);

    const koText = this.scene.add
      .text(0, 0, 'KO', {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: currentLang === 'ko' ? COLORS_HEX.CYAN : COLORS_HEX.WHITE,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    container.add([enText, separator, koText]);

    const updateStyle = (textObj: Phaser.GameObjects.Text, isActive: boolean) => {
      if (isActive) {
        textObj.setColor(COLORS_HEX.CYAN);
        textObj.setAlpha(1);
        textObj.setScale(config.activeScale);
        textObj.setShadow(0, 0, COLORS_HEX.CYAN, 5, true, true);
      } else {
        textObj.setColor(COLORS_HEX.WHITE);
        textObj.setAlpha(config.inactiveAlpha);
        textObj.setScale(1);
        textObj.setShadow(0, 0, '', 0);
      }
    };

    updateStyle(enText, currentLang === 'en');
    updateStyle(koText, currentLang === 'ko');

    enText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (Data.getLanguage() !== 'en') {
        Data.setLanguage('en');
        this.onLanguageChanged();
      }
    });

    koText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (Data.getLanguage() !== 'ko') {
        Data.setLanguage('ko');
        this.onLanguageChanged();
      }
    });

    [enText, koText].forEach((textNode) => {
      textNode.on('pointerover', () => {
        if (textNode.alpha < 1) textNode.setAlpha(0.8);
      });
      textNode.on('pointerout', () => {
        const isThisActive =
          (textNode === enText && Data.getLanguage() === 'en') ||
          (textNode === koText && Data.getLanguage() === 'ko');
        textNode.setAlpha(isThisActive ? 1 : config.inactiveAlpha);
      });
    });

    return container;
  }

  private updateSafeArea(): void {
    const config = Data.mainMenu.languageUI;
    const bounds = this.container.getBounds();

    this.safeArea = new Phaser.Geom.Rectangle(
      bounds.x - config.safeAreaPaddingX,
      bounds.y - config.safeAreaPaddingTop,
      bounds.width + config.safeAreaPaddingX * 2,
      bounds.height + config.safeAreaPaddingTop + config.safeAreaPaddingBottom
    );
  }
}
