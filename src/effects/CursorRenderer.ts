import Phaser from 'phaser';
import { COLORS } from '../data/constants';
import { Data } from '../data/DataManager';

export class CursorRenderer {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  /**
   * 메뉴용 원근감 커서 렌더링
   */
  public renderMenuCursor(x: number, y: number, radius: number, perspectiveFactor: number): void {
    this.graphics.clear();

    // 1. 외곽 원 (원근감이 적용된 두께와 크기)
    this.graphics.lineStyle(
      1 + perspectiveFactor * 2,
      Data.gameConfig.player.cursorColorNumeric,
      0.4 + perspectiveFactor * 0.4
    );
    this.graphics.strokeCircle(x, y, radius);

    // 2. 내부 채우기
    this.graphics.fillStyle(
      Data.gameConfig.player.cursorColorNumeric,
      0.1 + perspectiveFactor * 0.2
    );
    this.graphics.fillCircle(x, y, radius);

    // 3. 중앙 점
    this.graphics.fillStyle(COLORS.WHITE, 0.7 + perspectiveFactor * 0.3);
    this.graphics.fillCircle(x, y, 2 * (0.5 + perspectiveFactor * 0.5));
  }

  /**
   * 게임용 공격 범위/게이지 커서 렌더링
   */
  public renderAttackIndicator(
    x: number,
    y: number,
    radius: number,
    gaugeRatio: number,
    magnetRadius: number,
    magnetLevel: number
  ): void {
    this.graphics.clear();

    // 1. 자기장 범위 원
    if (magnetLevel > 0) {
      this.graphics.lineStyle(1, COLORS.MAGENTA, 0.25);
      this.graphics.strokeCircle(x, y, magnetRadius);
      this.graphics.fillStyle(COLORS.MAGENTA, 0.04);
      this.graphics.fillCircle(x, y, magnetRadius);
    }

    // 2. 공격 범위 테두리
    const isReady = gaugeRatio >= 1;
    const readyColor = Phaser.Display.Color.HexStringToColor(
      Data.feedback.bossAttack.mainColor
    ).color;
    const baseColor = isReady ? readyColor : Data.gameConfig.player.cursorColorNumeric;

    this.graphics.lineStyle(2, baseColor, 0.8);
    this.graphics.strokeCircle(x, y, radius);

    // 3. 내부 게이지 채우기
    if (gaugeRatio > 0) {
      const fillRadius = radius * gaugeRatio;
      this.graphics.fillStyle(baseColor, isReady ? 0.5 : 0.4);
      this.graphics.fillCircle(x, y, fillRadius);

      if (isReady) {
        // 준비 완료 시 글로우 효과
        this.graphics.lineStyle(4, readyColor, 0.4);
        this.graphics.strokeCircle(x, y, radius + 2);
      }
    }

    // 4. 기본 내부 채우기
    this.graphics.fillStyle(baseColor, 0.15);
    this.graphics.fillCircle(x, y, radius);

    // 5. 중앙 점
    this.graphics.fillStyle(COLORS.WHITE, 1);
    this.graphics.fillCircle(x, y, 2);
  }

  public setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
