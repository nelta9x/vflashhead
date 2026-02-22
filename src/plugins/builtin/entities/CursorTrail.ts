import Phaser from 'phaser';
import { DEPTHS } from '../../../data/constants';
import { Data } from '../../../data/DataManager';

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  radius: number;
}

interface TrailConfig {
  enabled: boolean;
  color: string;
  lifespan: number;
  maxLength: number;
  minDistance: number;
  minWidth: number;
  speedAlphaMin: number;
  speedAlphaMax: number;
  speedNormalize: number;
}

export class CursorTrail {
  static inject = [Phaser.Scene] as const;
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private points: TrailPoint[] = [];
  private config: TrailConfig;
  private lastCenter: { x: number; y: number } | null = null;
  private lastFrameSpeed = 0;
  private readonly cachedColor: number;
  // Reusable edge buffers to avoid per-frame allocation
  private edgeLeftX: number[] = [];
  private edgeLeftY: number[] = [];
  private edgeRightX: number[] = [];
  private edgeRightY: number[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.config = Data.feedback.cursorTrail;
    this.cachedColor = Phaser.Display.Color.HexStringToColor(this.config.color).color;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(DEPTHS.cursorTrail);
  }

  update(delta: number, currentRadius: number, forcedX?: number, forcedY?: number): void {
    if (!this.config.enabled) {
      this.graphics.clear();
      return;
    }

    const currentTime = this.scene.time.now;
    let currentX: number;
    let currentY: number;

    if (forcedX !== undefined && forcedY !== undefined) {
      currentX = forcedX;
      currentY = forcedY;
    } else {
      const pointer = this.scene.input.activePointer;
      currentX = pointer.worldX;
      currentY = pointer.worldY;
    }

    // 초기화
    if (!this.lastCenter) {
      this.lastCenter = { x: currentX, y: currentY };
      return;
    }

    // 커서 이동 거리 계산 (중심점 기준)
    const dist = Phaser.Math.Distance.Between(
      this.lastCenter.x,
      this.lastCenter.y,
      currentX,
      currentY
    );

    if (dist >= this.config.minDistance) {
      // 프레임 간 속도 계산 (pixels/sec) — minDistance 이상 이동 시에만
      this.lastFrameSpeed = delta > 0 ? (dist / delta) * 1000 : 0;
      // 이동 각도 계산
      const angle = Phaser.Math.Angle.Between(
        this.lastCenter.x,
        this.lastCenter.y,
        currentX,
        currentY
      );

      // 커서의 반대 방향(뒤쪽) 호 위 좌표 계산
      // 각도에 180도(PI)를 더해서 반대 방향을 구함
      const offsetX = Math.cos(angle + Math.PI) * currentRadius;
      const offsetY = Math.sin(angle + Math.PI) * currentRadius;

      this.points.push({
        x: currentX + offsetX,
        y: currentY + offsetY,
        time: currentTime,
        radius: currentRadius,
      });

      // 중심점 업데이트
      this.lastCenter = { x: currentX, y: currentY };
    } else {
      // 미세 떨림에서 alpha 상승 방지
      this.lastFrameSpeed = 0;
    }

    // 오래된 포인트 제거
    this.points = this.points.filter((p) => currentTime - p.time < this.config.lifespan);

    // 최대 개수 제한
    if (this.points.length > this.config.maxLength) {
      this.points.shift();
    }

    this.draw();
  }

  private draw(): void {
    this.graphics.clear();
    if (this.points.length < 2) return;

    const color = this.cachedColor;
    const currentTime = this.scene.time.now;
    const totalPoints = this.points.length;

    // 속도 기반 동적 알파
    const speedRatio = Phaser.Math.Clamp(this.lastFrameSpeed / this.config.speedNormalize, 0, 1);
    const dynamicAlpha = this.config.speedAlphaMin +
      (this.config.speedAlphaMax - this.config.speedAlphaMin) * speedRatio;

    // Reuse edge buffers — reset length, fill in-place
    const leftX = this.edgeLeftX;
    const leftY = this.edgeLeftY;
    const rightX = this.edgeRightX;
    const rightY = this.edgeRightY;
    leftX.length = totalPoints;
    leftY.length = totalPoints;
    rightX.length = totalPoints;
    rightY.length = totalPoints;

    for (let i = 0; i < totalPoints; i++) {
      const p = this.points[i];

      // Calculate direction vector (forward-looking, last point uses backward)
      let dx: number, dy: number;
      if (i < totalPoints - 1) {
        dx = this.points[i + 1].x - p.x;
        dy = this.points[i + 1].y - p.y;
      } else {
        dx = p.x - this.points[i - 1].x;
        dy = p.y - this.points[i - 1].y;
      }

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.001) {
        // Degenerate segment — copy previous edge or collapse to point
        if (i > 0) {
          leftX[i] = leftX[i - 1];
          leftY[i] = leftY[i - 1];
          rightX[i] = rightX[i - 1];
          rightY[i] = rightY[i - 1];
        } else {
          leftX[i] = p.x;
          leftY[i] = p.y;
          rightX[i] = p.x;
          rightY[i] = p.y;
        }
        continue;
      }

      // Perpendicular vector (unit normal rotated 90°)
      const perpX = -dy / len;
      const perpY = dx / len;

      // Width calculation (same sizeRatio logic as original)
      const age = currentTime - p.time;
      const lifeRatio = 1 - Phaser.Math.Clamp(age / this.config.lifespan, 0, 1);
      const indexRatio = i / (totalPoints - 1);
      const sizeRatio = Math.pow(indexRatio, 0.8) * lifeRatio;
      const pointMaxWidth = p.radius * 2;
      const halfW = (this.config.minWidth + (pointMaxWidth - this.config.minWidth) * sizeRatio) / 2;

      leftX[i] = p.x + perpX * halfW;
      leftY[i] = p.y + perpY * halfW;
      rightX[i] = p.x - perpX * halfW;
      rightY[i] = p.y - perpY * halfW;
    }

    // Draw ribbon polygon: left edge forward → right edge backward → close
    this.graphics.fillStyle(color, dynamicAlpha);
    this.graphics.beginPath();
    this.graphics.moveTo(leftX[0], leftY[0]);

    for (let i = 1; i < totalPoints; i++) {
      this.graphics.lineTo(leftX[i], leftY[i]);
    }

    for (let i = totalPoints - 1; i >= 0; i--) {
      this.graphics.lineTo(rightX[i], rightY[i]);
    }

    this.graphics.closePath();
    this.graphics.fillPath();
  }

  destroy(): void {
    this.graphics.destroy();
    this.points = [];
  }
}
