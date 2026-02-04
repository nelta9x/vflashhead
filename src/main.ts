import Phaser from 'phaser';
import { gameConfig } from './config/game.config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { GameOverScene } from './scenes/GameOverScene';

// 씬 등록
const config: Phaser.Types.Core.GameConfig = {
  ...gameConfig,
  scene: [BootScene, MenuScene, GameScene, UpgradeScene, GameOverScene],
};

// 게임 인스턴스 생성
const game = new Phaser.Game(config);

// Hot Module Replacement (개발용)
declare global {
  interface ImportMeta {
    hot?: {
      dispose: (cb: () => void) => void;
    };
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

export default game;
