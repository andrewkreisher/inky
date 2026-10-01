import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';

/**
 * Shared Phaser.Game config. Scenes are added by `usePhaserGame`, not here,
 * so that init() data can be passed in at creation time.
 */
export function createPhaserConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      min: { width: 800, height: 450 },
      max: { width: 2560, height: 1440 },
    },
    backgroundColor: '#333333',
    pauseOnBlur: false,
    backgroundPause: false,
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: [],
  };
}
