import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from '../game/phaserConfig';

/**
 * Mounts a Phaser game running a single scene inside `parentId`.
 *
 * - `sceneData` is passed to the scene's `init(data)` via `scene.add(..., data)`.
 * - Creation is deferred until the tab is visible (Phaser misbehaves when
 *   booted in a hidden tab).
 * - The game is destroyed on unmount or when `enabled` becomes false.
 *
 * The scene is created once; changes to `sceneData` after mount are ignored.
 */
export function usePhaserGame({ parentId, sceneKey, SceneClass, sceneData, enabled = true }) {
  const gameRef = useRef(null);
  const dataRef = useRef(sceneData);
  dataRef.current = sceneData;

  useEffect(() => {
    if (!enabled) return undefined;

    const createGame = () => {
      if (gameRef.current) return;
      const game = new Phaser.Game(createPhaserConfig(parentId));
      game.scene.add(sceneKey, SceneClass, true, dataRef.current);
      gameRef.current = game;
    };

    let visibilityHandler = null;
    if (document.hidden) {
      visibilityHandler = () => {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', visibilityHandler);
          visibilityHandler = null;
          createGame();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    } else {
      createGame();
    }

    return () => {
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [enabled, parentId, sceneKey, SceneClass]);

  return gameRef;
}
