import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/Scenes/MainScene';
import {
  Box,
  Button,
  VStack,
  Heading,
  Text,
  HStack,
  Container,
  Badge,
  keyframes,
} from '@chakra-ui/react';

const pulseAnimation = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

export default function Game({ socket, gameData, onReturnToLobby }) {
  const gameRef = useRef(null);
  const [endGameState, setEndGameState] = useState(null);
  const [rematchCount, setRematchCount] = useState(0);
  const [rematchAccepted, setRematchAccepted] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

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
      pauseOnBlur: false,
      backgroundPause: false,
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

    game.events.once('ready', () => {
      const mainScene = game.scene.getScene('MainScene');
      if (mainScene) {
        mainScene.socket = socket;
        mainScene.init({ game: gameData });
        mainScene.scene.start();
      }
    });

    gameRef.current = game;
  }, [socket, gameData]);

  // Phaser lifecycle
  useEffect(() => {
    if (!socket) return;

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
  }, [socket, createGame]);

  // End-game socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleMatchEnded = ({ winnerId, scores }) => {
      setEndGameState({
        winnerId,
        scores,
        isWinner: winnerId === socket.id,
      });
    };

    const handlePlayerDisconnected = () => {
      setOpponentDisconnected(true);
    };

    const handleRematchUpdate = ({ accepted }) => {
      setRematchCount(accepted);
    };

    const handleRematchStarted = () => {
      // MainScene handles its own restart via its own rematchStarted listener.
      // Here we just clear the React overlay state.
      setEndGameState(null);
      setRematchCount(0);
      setRematchAccepted(false);
      setOpponentDisconnected(false);
    };

    socket.on('matchEnded', handleMatchEnded);
    socket.on('playerDisconnected', handlePlayerDisconnected);
    socket.on('rematchUpdate', handleRematchUpdate);
    socket.on('rematchStarted', handleRematchStarted);

    return () => {
      socket.off('matchEnded', handleMatchEnded);
      socket.off('playerDisconnected', handlePlayerDisconnected);
      socket.off('rematchUpdate', handleRematchUpdate);
      socket.off('rematchStarted', handleRematchStarted);
    };
  }, [socket]);

  const handleRematch = () => {
    setRematchAccepted(true);
    socket.emit('requestRematch', { gameId: gameData.id, playerId: socket.id });
  };

  const handleBackToLobby = () => {
    socket.emit('leaveGame', { gameId: gameData.id });
    onReturnToLobby();
  };

  const showOverlay = endGameState || opponentDisconnected;

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

      {showOverlay && (
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="rgba(0, 0, 0, 0.7)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex="10"
        >
          <Container maxW="480px">
            <Box
              bg="rgba(0, 0, 0, 0.9)"
              borderRadius="xl"
              border="1px solid"
              borderColor="whiteAlpha.200"
              p={8}
              backdropFilter="blur(12px)"
            >
              <VStack spacing={6}>
                {/* Disconnect-only state (no match result) */}
                {!endGameState && opponentDisconnected && (
                  <>
                    <Heading
                      color="orange.300"
                      size="lg"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      textShadow="0 0 20px rgba(237, 137, 54, 0.5)"
                    >
                      Opponent Disconnected
                    </Heading>
                    <Button
                      bg="cyan.500"
                      color="black"
                      fontWeight="bold"
                      size="lg"
                      w="200px"
                      _hover={{
                        bg: 'cyan.400',
                        boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
                        transform: 'scale(1.05)',
                      }}
                      transition="all 0.2s"
                      onClick={handleBackToLobby}
                    >
                      Back to Lobby
                    </Button>
                  </>
                )}

                {/* Match ended state */}
                {endGameState && (
                  <>
                    <Heading
                      color={endGameState.isWinner ? 'green.300' : 'red.300'}
                      size="xl"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      fontWeight="bold"
                      textShadow={endGameState.isWinner
                        ? '0 0 20px rgba(72, 187, 120, 0.5), 0 0 40px rgba(72, 187, 120, 0.2)'
                        : '0 0 20px rgba(245, 101, 101, 0.5), 0 0 40px rgba(245, 101, 101, 0.2)'
                      }
                    >
                      {endGameState.isWinner ? 'Victory!' : 'Defeat'}
                    </Heading>

                    {/* Scores */}
                    <VStack spacing={2}>
                      {endGameState.scores.map((s) => (
                        <HStack key={s.id} spacing={3}>
                          <Text
                            color={s.id === socket.id ? 'cyan.300' : 'whiteAlpha.700'}
                            fontSize="lg"
                            fontWeight={s.id === socket.id ? 'bold' : 'normal'}
                          >
                            {s.id === socket.id ? 'You' : 'Opponent'}:
                          </Text>
                          <Text
                            color="white"
                            fontSize="lg"
                            fontWeight="bold"
                          >
                            {s.score}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>

                    {/* Opponent disconnected notice */}
                    {opponentDisconnected && (
                      <Text
                        color="orange.300"
                        fontSize="sm"
                        fontWeight="semibold"
                      >
                        Opponent disconnected
                      </Text>
                    )}

                    {/* Buttons */}
                    <VStack spacing={3} w="100%">
                      {!opponentDisconnected && (
                        <Button
                          bg={rematchAccepted ? 'whiteAlpha.200' : 'green.500'}
                          color={rematchAccepted ? 'whiteAlpha.700' : 'white'}
                          fontWeight="bold"
                          size="lg"
                          w="220px"
                          border="2px solid"
                          borderColor={rematchAccepted ? 'green.400' : 'green.500'}
                          isDisabled={rematchAccepted}
                          _hover={rematchAccepted ? {} : {
                            bg: 'green.400',
                            boxShadow: '0 0 20px rgba(72, 187, 120, 0.4)',
                            transform: 'scale(1.05)',
                          }}
                          transition="all 0.2s"
                          onClick={handleRematch}
                        >
                          {rematchAccepted ? (
                            <HStack spacing={2}>
                              <Text
                                animation={`${pulseAnimation} 2s ease-in-out infinite`}
                              >
                                Waiting...
                              </Text>
                              <Badge
                                colorScheme="green"
                                variant="solid"
                                fontSize="sm"
                              >
                                {rematchCount}/2
                              </Badge>
                            </HStack>
                          ) : (
                            'Rematch'
                          )}
                        </Button>
                      )}
                      <Button
                        bg="whiteAlpha.200"
                        color="cyan.300"
                        fontWeight="bold"
                        size="lg"
                        w="220px"
                        border="1px solid"
                        borderColor="cyan.600"
                        _hover={{
                          bg: 'whiteAlpha.300',
                          boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
                        }}
                        transition="all 0.2s"
                        onClick={handleBackToLobby}
                      >
                        Back to Lobby
                      </Button>
                    </VStack>
                  </>
                )}
              </VStack>
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
}
