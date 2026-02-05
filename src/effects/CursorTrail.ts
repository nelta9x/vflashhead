import Phaser from 'phaser';
import { Data } from '../data/DataManager';

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  radius: number;
}

export class CursorTrail {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private points: TrailPoint[] = [];
  private config: any;
  private lastCenter: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.config = Data.feedback.cursorTrail;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(900); // HUD(1000)보다 아래, 일반 오브젝트보다 위
  }

  update(_delta: number, currentRadius: number): void {
    if (!this.config.enabled) {
      this.graphics.clear();
      return;
    }

    const pointer = this.scene.input.activePointer;
    const currentTime = this.scene.time.now;
    const currentX = pointer.worldX;
    const currentY = pointer.worldY;

    // 초기화
    if (!this.lastCenter) {
      this.lastCenter = { x: currentX, y: currentY };
      return;
    }

    // 커서 이동 거리 계산 (중심점 기준)
    const dist = Phaser.Math.Distance.Between(this.lastCenter.x, this.lastCenter.y, currentX, currentY);

    if (dist >= this.config.minDistance) {
      // 이동 각도 계산
      const angle = Phaser.Math.Angle.Between(this.lastCenter.x, this.lastCenter.y, currentX, currentY);
      
      // 커서의 반대 방향(뒤쪽) 호 위 좌표 계산
      // 각도에 180도(PI)를 더해서 반대 방향을 구함
      const offsetX = Math.cos(angle + Math.PI) * currentRadius;
      const offsetY = Math.sin(angle + Math.PI) * currentRadius;

      this.points.push({
        x: currentX + offsetX,
        y: currentY + offsetY,
        time: currentTime,
        radius: currentRadius
      });

      // 중심점 업데이트
      this.lastCenter = { x: currentX, y: currentY };
    }

    // 오래된 포인트 제거
    this.points = this.points.filter(p => currentTime - p.time < this.config.lifespan);
    
    // 최대 개수 제한
    if (this.points.length > this.config.maxLength) {
      this.points.shift();
    }

    this.draw();
  }

  private draw(): void {
    this.graphics.clear();
    if (this.points.length < 2) return;

    const color = Phaser.Display.Color.HexStringToColor(this.config.color).color;
    const currentTime = this.scene.time.now;
    const totalPoints = this.points.length;

    for (let i = 0; i < totalPoints - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];

      // 1. 시간 기반 비율 (나이가 들수록 투명해짐)
      const age1 = currentTime - p1.time;
      const lifeRatio = 1 - Phaser.Math.Clamp(age1 / this.config.lifespan, 0, 1);
      
      // 2. 인덱스 기반 비율 (커서에서 멀어질수록 얇아짐)
      // i=0이 가장 오래된 점(꼬리 끝), i=totalPoints-1이 가장 최신 점(머리)
      const indexRatio = i / (totalPoints - 1);
      
      // 더 묵직한 올챙이 머리 느낌을 위해 지수 조정 (0.5 -> 0.8)
      const sizeRatio = Math.pow(indexRatio, 0.8) * lifeRatio;
      
      // 포인트가 생성될 때의 지름을 기준으로 트레일 두께 결정
      const pointMaxWidth = p1.radius * 2;
      const width = this.config.minWidth + (pointMaxWidth - this.config.minWidth) * sizeRatio;
      const alpha = this.config.alpha * sizeRatio;

      this.graphics.lineStyle(width, color, alpha);
      this.graphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.points = [];
  }
}
