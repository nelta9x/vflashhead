import Phaser from 'phaser';
export {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  COLORS_HEX,
  UPGRADE_INTERVAL,
  COMBO_TIMEOUT,
} from './constants';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './constants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.DARK_BG,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  audio: {
    noAudio: true,
  },
};
