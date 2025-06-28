import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/Scenes/MainScene';
import { Box } from '@chakra-ui/react';

export default function Game({ socket, gameData }) {
  const gameRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
        min: {
          width: 800,
          height: 450
        },
        max: {
          width: 2560,
          height: 1440
        }
      },
      backgroundColor: '#333333',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scene: [MainScene]
    };

    const game = new Phaser.Game(config);
    game.socket = socket;

    // Wait for the scene to be created
    game.events.once('ready', () => {
      const mainScene = game.scene.getScene('MainScene');
      if (mainScene) {
        mainScene.socket = socket;
        mainScene.init({ game: gameData });
        mainScene.scene.start();
      }
    });

    gameRef.current = game;

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [socket, gameData]);

  return (
    <Box 
      width="100vw" 
      height="100vh" 
      backgroundColor="#000000"
      display="flex"
      alignItems="center"
      justifyContent="center"
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