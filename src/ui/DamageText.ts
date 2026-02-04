import Phaser from 'phaser';
import { COLORS_HEX } from '../config/constants';

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
  private activeTexts: Set<Phaser.GameObjects.Text> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // 텍스트 풀 생성
    for (let i = 0; i < 20; i++) {
      const text = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: COLORS_HEX.WHITE,
        stroke: '#000000',
        strokeThickness: 3,
      });
      text.setVisible(false);
      text.setOrigin(0.5);
      this.pool.push(text);
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
    this.activeTexts.delete(text);
  }
}
