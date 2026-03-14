import { useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { SinglePlayerScene } from '../game/Scenes/SinglePlayerScene';
import { Box } from '@chakra-ui/react';

export default function SinglePlayerGame({ levelData, onReturnHome }) {
  const gameRef = useRef(null);

  const createGame = useCallback(() => {
    if (gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
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
      scene: [SinglePlayerScene],
    };

    const game = new Phaser.Game(config);
    game.onReturnHome = onReturnHome;

    game.events.once('ready', () => {
      const scene = game.scene.getScene('SinglePlayerScene');
      if (scene) {
        scene.init({ level: levelData });
        scene.scene.start();
      }
    });

    gameRef.current = game;
  }, [levelData, onReturnHome]);

  useEffect(() => {
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
  }, [createGame]);

  return (
    <Box
      width="100vw"
      height="100vh"
      backgroundColor="#000000"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      <Box
        id="game-container"
        width="100%"
        maxWidth="2560px"
        height="100%"
        maxHeight="1440px"
        position="relative"
      />
    </Box>
  );
}
