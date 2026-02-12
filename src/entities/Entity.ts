import Phaser from 'phaser';
import type { Poolable } from '../utils/ObjectPool';

export type { EntitySpawnConfig } from './EntitySpawnConfig';

export interface EntityOptions {
  physics?: boolean;
}

/**
 * Entity: 순수 Phaser Container + Poolable 래퍼.
 * 모든 게임 상태는 World 컴포넌트에 존재하며,
 * Entity는 Phaser 렌더링 노드 역할만 수행한다.
 */
export class Entity extends Phaser.GameObjects.Container implements Poolable {
  active: boolean = false;

  private _entityId: string = '';
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, options?: EntityOptions) {
    super(scene, 0, 0);
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    if (options?.physics !== false) {
      scene.physics.add.existing(this);
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setCircle(30);
      body.setOffset(-30, -30);
    }

    this.setVisible(false);
    this.setActive(false);
  }

  // === Poolable ===

  reset(): void {
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(1);
    this.setScale(1);
    this.rotation = 0;
  }

  // === Identity ===

  getEntityId(): string { return this._entityId; }

  setEntityId(id: string): void { this._entityId = id; }

  // === Graphics ===

  getGraphics(): Phaser.GameObjects.Graphics { return this.graphics; }
}
