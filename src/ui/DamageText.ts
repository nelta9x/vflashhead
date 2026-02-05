import Phaser from 'phaser';
import { COLORS_HEX } from '../config/constants';
import { Data } from '../data/DataManager';

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
        fontFamily: 'monospace',
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
        fontFamily: 'monospace',
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
    const anim = config.animation;

    let text = this.pool.find((t) => !this.activeTexts.has(t));

    if (!text) {
      const style = config.style;
      text = this.scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
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

    // 콤보 텍스트 표시
    let comboText: Phaser.GameObjects.Text | null = null;
    if (combo >= comboConfig.minComboToShow) {
      comboText = this.comboPool.find((t) => !this.activeComboTexts.has(t)) || null;

      if (!comboText) {
        comboText = this.scene.add.text(0, 0, '', {
          fontFamily: 'monospace',
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
      comboText.setScale(1);

      this.activeComboTexts.add(comboText);
    }

    const capturedText = text;
    const capturedComboText = comboText;

    // 1단계: 스케일 팝
    this.scene.tweens.add({
      targets: capturedText,
      scaleX: 1,
      scaleY: 1,
      duration: anim.scalePop.duration,
      ease: anim.scalePop.ease,
      onComplete: () => {
        // 2단계: 좌우 흔들림
        const startX = capturedText.x;
        this.scene.tweens.add({
          targets: capturedText,
          x: startX + anim.shake.distance,
          duration: anim.shake.duration,
          ease: anim.shake.ease,
          yoyo: true,
          repeat: anim.shake.repeat,
          onComplete: () => {
            // 3단계: 체류
            this.scene.time.delayedCall(anim.hold.duration, () => {
              // 4단계: 축소 + 페이드아웃
              this.scene.tweens.add({
                targets: capturedText,
                scaleX: anim.shrinkFade.targetScale,
                scaleY: anim.shrinkFade.targetScale,
                alpha: 0,
                duration: anim.shrinkFade.duration,
                ease: anim.shrinkFade.ease,
                onComplete: () => this.releaseText(capturedText),
              });
            });
          },
        });
      },
    });

    // 콤보 텍스트 애니메이션
    if (capturedComboText) {
      this.scene.tweens.add({
        targets: capturedComboText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: anim.scalePop.duration,
        ease: anim.scalePop.ease,
        yoyo: true,
        onComplete: () => {
          // 체류 후 축소 페이드
          this.scene.time.delayedCall(anim.hold.duration, () => {
            this.scene.tweens.add({
              targets: capturedComboText,
              scaleX: anim.shrinkFade.targetScale,
              scaleY: anim.shrinkFade.targetScale,
              alpha: 0,
              duration: anim.shrinkFade.duration,
              ease: anim.shrinkFade.ease,
              onComplete: () => this.releaseComboText(capturedComboText),
            });
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
        fontFamily: 'monospace',
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

    // 애니메이션
    const duration = config.isCritical ? 1000 : 600;

    if (config.isCritical) {
      // 크리티컬: 확대 + 떠오름
      this.scene.tweens.add({
        targets: text,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          this.scene.tweens.add({
            targets: text,
            y: text.y - 80,
            alpha: 0,
            duration: duration - 100,
            ease: 'Power2',
            onComplete: () => this.releaseText(text!),
          });
        },
      });
    } else {
      // 일반: 떠오름
      this.scene.tweens.add({
        targets: text,
        y: text.y - 50,
        alpha: 0,
        duration,
        ease: 'Power2',
        onComplete: () => this.releaseText(text!),
      });
    }
  }

  private releaseText(text: Phaser.GameObjects.Text): void {
    text.setVisible(false);
    text.setRotation(0);
    this.activeTexts.delete(text);
  }
}
