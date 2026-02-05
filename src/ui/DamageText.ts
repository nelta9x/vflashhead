import Phaser from 'phaser';
import { COLORS_HEX, FONTS } from '../../data/constants';
import { Data } from '../../data/DataManager';

type DamageType = 'normal' | 'critical';

interface DamageTextConfig {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  isCritical: boolean;
}

export class DamageText {
  private scene: Phaser.Scene;
  private pool: Phaser.GameObjects.Text[] = [];
  private comboPool: Phaser.GameObjects.Text[] = [];
  private activeTexts: Set<Phaser.GameObjects.Text> = new Set();
  private activeComboTexts: Set<Phaser.GameObjects.Text> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const style = Data.feedback.damageText.style;

    // 텍스트 풀 생성
    for (let i = 0; i < 20; i++) {
      const text = scene.add.text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: '20px',
        color: COLORS_HEX.WHITE,
        stroke: '#000000',
        strokeThickness: style?.strokeThickness || 3,
        fontStyle: style?.fontStyle || 'normal',
      });
      text.setVisible(false);
      text.setOrigin(0.5);
      this.pool.push(text);
    }

    // 콤보 텍스트 풀 생성
    for (let i = 0; i < 20; i++) {
      const comboText = scene.add.text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: '16px',
        color: COLORS_HEX.WHITE,
        stroke: '#000000',
        strokeThickness: 2,
      });
      comboText.setVisible(false);
      comboText.setOrigin(0, 0.5);
      this.comboPool.push(comboText);
    }
  }

  show(x: number, y: number, damage: number): void {
    this.createDamageText({
      x,
      y,
      text: damage.toString(),
      color: COLORS_HEX.WHITE,
      fontSize: 20,
      isCritical: false,
    });
  }

  showCritical(x: number, y: number, damage: number): void {
    this.createDamageText({
      x,
      y,
      text: `${damage}!`,
      color: COLORS_HEX.YELLOW,
      fontSize: 32,
      isCritical: true,
    });
  }

  showDamage(x: number, y: number, damage: number, type: DamageType = 'normal', combo: number = 0): void {
    const config = Data.feedback.damageText;
    const typeConfig = config[type];
    const comboConfig = config.combo;

    let text = this.pool.find((t) => !this.activeTexts.has(t));

    if (!text) {
      const style = config.style;
      text = this.scene.add.text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: '20px',
        color: COLORS_HEX.WHITE,
        stroke: '#000000',
        strokeThickness: style?.strokeThickness || 3,
        fontStyle: style?.fontStyle || 'normal',
      });
      text.setOrigin(0.5);
      this.pool.push(text);
    }

    // 랜덤 크기 적용
    const randomScale = config.randomScale;
    let sizeMultiplier = 1;
    if (randomScale?.enabled) {
      sizeMultiplier = Phaser.Math.FloatBetween(randomScale.min, randomScale.max);
    }
    const finalFontSize = Math.round(typeConfig.fontSize * sizeMultiplier);

    const posX = x + Phaser.Math.Between(-10, 10);
    // 랜덤 회전 적용
    const randomRotation = config.randomRotation;
    let rotation = 0;
    if (randomRotation?.enabled) {
      rotation = Phaser.Math.FloatBetween(randomRotation.min, randomRotation.max);
    }

    text.setText(damage.toString());
    text.setPosition(posX, y);
    text.setColor(typeConfig.color);
    text.setFontSize(finalFontSize);
    text.setVisible(true);
    text.setAlpha(1);
    text.setScale(typeConfig.initialScale);
    text.setRotation(Phaser.Math.DegToRad(rotation));

    this.activeTexts.add(text);

    // 포물선 연출을 위한 랜덤 값 계산
    const side = Math.random() > 0.5 ? 1 : -1;
    const jumpX = side * Phaser.Math.Between(30, 60);
    const jumpY = -Phaser.Math.Between(40, 70);

    // 콤보 텍스트 표시
    let comboText: Phaser.GameObjects.Text | null = null;
    if (combo >= comboConfig.minComboToShow) {
      comboText = this.comboPool.find((t) => !this.activeComboTexts.has(t)) || null;

      if (!comboText) {
        comboText = this.scene.add.text(0, 0, '', {
          fontFamily: FONTS.MAIN,
          fontSize: '16px',
          color: COLORS_HEX.WHITE,
          stroke: '#000000',
          strokeThickness: 2,
        });
        comboText.setOrigin(0, 0.5);
        this.comboPool.push(comboText);
      }

      const comboColor = this.getComboColor(combo, comboConfig);
      comboText.setText(`x${combo}`);
      comboText.setPosition(posX + comboConfig.offsetX, y + comboConfig.offsetY);
      comboText.setColor(comboColor);
      comboText.setFontSize(comboConfig.fontSize);
      comboText.setVisible(true);
      comboText.setAlpha(1);
      comboText.setScale(0.5);

      this.activeComboTexts.add(comboText);
    }

    const capturedText = text;
    const capturedComboText = comboText;

    // 대미지 텍스트 애니메이션: 포물선 점프
    this.scene.tweens.add({
      targets: capturedText,
      x: posX + jumpX,
      y: y + jumpY,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: capturedText,
          y: capturedText.y + 20,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => this.releaseText(capturedText),
        });
      },
    });

    // 콤보 텍스트 애니메이션: 팝업 후 페이드
    if (capturedComboText) {
      this.scene.tweens.add({
        targets: capturedComboText,
        x: posX + jumpX + comboConfig.offsetX,
        y: y + jumpY + comboConfig.offsetY,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 400,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: capturedComboText,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => this.releaseComboText(capturedComboText),
          });
        },
      });
    }
  }

  private getComboColor(combo: number, comboConfig: typeof Data.feedback.damageText.combo): string {
    const { thresholds, colors } = comboConfig;
    if (combo >= thresholds.ultra) return colors.ultra;
    if (combo >= thresholds.high) return colors.high;
    if (combo >= thresholds.mid) return colors.mid;
    return colors.low;
  }

  private releaseComboText(text: Phaser.GameObjects.Text): void {
    text.setVisible(false);
    this.activeComboTexts.delete(text);
  }

  showBossDamage(x: number, y: number, damage: number): void {
    // 풀에서 텍스트 가져오기
    let text = this.pool.find((t) => !this.activeTexts.has(t));

    if (!text) {
      text = this.scene.add.text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: '48px',
        color: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 6,
        fontStyle: 'bold',
      });
      text.setOrigin(0.5);
      this.pool.push(text);
    }

    // 보스용 특별 스타일 설정
    text.setText(damage.toString());
    // 보스가 상단(y=80)에 있으므로, 숫자가 위로 올라가면 화면 밖으로 나감
    // 타격 지점보다 약간 아래에서 시작해서 아래로 떨어지거나 제자리에서 팝업되도록 수정
    text.setPosition(x + Phaser.Math.Between(-30, 30), y + 40);
    text.setColor('#ff3300'); // 강렬한 빨강-주황
    text.setFontSize(64);
    text.setVisible(true);
    text.setAlpha(1);
    text.setScale(0.2); // 아주 작게 시작해서 커지는 효과
    text.setRotation(Phaser.Math.DegToRad(Phaser.Math.Between(-10, 10)));

    this.activeTexts.add(text);

    // 보스 데미지 애니메이션: 쾅! 하고 커지면서 약간 아래로 내려옴
    this.scene.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      y: text.y + 30, // 아래로 이동
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        text!.setColor('#ffff00');
        
        this.scene.tweens.add({
          targets: text,
          y: text!.y + 20, // 더 아래로 이동
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 800,
          delay: 200,
          ease: 'Power2',
          onComplete: () => this.releaseText(text!),
        });
      },
    });
  }

  showText(x: number, y: number, text: string, color: number): void {
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    this.createDamageText({
      x,
      y,
      text,
      color: hexColor,
      fontSize: 24,
      isCritical: false,
    });
  }

  private createDamageText(config: DamageTextConfig): void {
    // 풀에서 사용 가능한 텍스트 찾기
    let text = this.pool.find((t) => !this.activeTexts.has(t));

    if (!text) {
      // 풀이 가득 찼으면 새로 생성
      text = this.scene.add.text(0, 0, '', {
        fontFamily: FONTS.MAIN,
        fontSize: '20px',
        color: COLORS_HEX.WHITE,
        stroke: '#000000',
        strokeThickness: 3,
      });
      text.setOrigin(0.5);
      this.pool.push(text);
    }

    // 텍스트 설정
    text.setText(config.text);
    text.setPosition(config.x + Phaser.Math.Between(-10, 10), config.y);
    text.setColor(config.color);
    text.setFontSize(config.fontSize);
    text.setVisible(true);
    text.setAlpha(1);
    text.setScale(config.isCritical ? 0.5 : 1);

    this.activeTexts.add(text);

    const side = Math.random() > 0.5 ? 1 : -1;
    const jumpX = side * Phaser.Math.Between(20, 50);
    const jumpY = config.isCritical ? -Phaser.Math.Between(80, 120) : -Phaser.Math.Between(40, 70);
    const duration = config.isCritical ? 500 : 400;

    // 대미지 텍스트 애니메이션: 포물선 점프
    this.scene.tweens.add({
      targets: text,
      x: text.x + jumpX,
      y: text.y + jumpY,
      scaleX: config.isCritical ? 1.8 : 1.2,
      scaleY: config.isCritical ? 1.8 : 1.2,
      duration: duration,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          y: text!.y + 30,
          alpha: 0,
          scaleX: config.isCritical ? 1.0 : 0.8,
          scaleY: config.isCritical ? 1.0 : 0.8,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => this.releaseText(text!),
        });
      },
    });
  }

  private releaseText(text: Phaser.GameObjects.Text): void {
    text.setVisible(false);
    text.setRotation(0);
    this.activeTexts.delete(text);
  }
}
