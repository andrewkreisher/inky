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
  keyframes,
} from '@chakra-ui/react';

const pulseAnimation = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

const panelShadow = 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.03)';
const buttonBorder = '#6A5890 #2A1840 #2A1840 #6A5890';

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
          bg="rgba(15, 10, 26, 0.8)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex="10"
        >
          <Container maxW="440px">
            <Box
              bg="rgba(26, 18, 48, 0.95)"
              borderRadius="md"
              border="2px solid"
              borderColor="#4A3870"
              boxShadow={panelShadow}
              p={8}
            >
              <VStack spacing={6}>
                {/* Disconnect-only state (no match result) */}
                {!endGameState && opponentDisconnected && (
                  <>
                    <Heading
                      color="#C8A868"
                      fontSize="22px"
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      Opponent Left
                    </Heading>
                    <Button
                      bg="#5BA8A8"
                      color="#0F0A1A"
                      fontWeight="bold"
                      fontSize="15px"
                      size="lg"
                      w="220px"
                      border="3px solid"
                      sx={{ borderColor: '#7CC8C8 #3A7878 #3A7878 #7CC8C8' }}
                      boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
                      _hover={{
                        bg: '#6BB8B8',
                        boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                        transform: 'translate(-1px, -1px)',
                      }}
                      _active={{
                        boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                        transform: 'translate(1px, 1px)',
                      }}
                      transition="all 0.1s"
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
                      color={endGameState.isWinner ? '#68A878' : '#C87068'}
                      fontSize="28px"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      fontWeight="bold"
                    >
                      {endGameState.isWinner ? 'Victory!' : 'Defeat'}
                    </Heading>

                    {/* Scores */}
                    <Box
                      w="100%"
                      bg="#140E25"
                      border="2px solid"
                      borderColor="#3A2860"
                      borderRadius="sm"
                      boxShadow="inset 1px 1px 4px rgba(0,0,0,0.5)"
                      p={4}
                    >
                      <VStack spacing={2}>
                        {endGameState.scores.map((s) => (
                          <HStack key={s.id} spacing={4} justify="center">
                            <Text
                              color={s.id === socket.id ? '#5BA8A8' : '#8878A8'}
                              fontSize="14px"
                              fontWeight="bold"
                            >
                              {s.id === socket.id ? 'You' : 'Opponent'}:
                            </Text>
                            <Text
                              color="#E8DCC8"
                              fontSize="16px"
                              fontWeight="bold"
                            >
                              {s.score}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>

                    {/* Opponent disconnected notice */}
                    {opponentDisconnected && (
                      <Text
                        color="#C8A868"
                        fontSize="12px"
                        fontWeight="bold"
                      >
                        Opponent disconnected
                      </Text>
                    )}

                    {/* Buttons */}
                    <VStack spacing={3} w="100%">
                      {!opponentDisconnected && (
                        <Button
                          bg={rematchAccepted ? '#1A1230' : '#68A878'}
                          color={rematchAccepted ? '#8878A8' : '#0F0A1A'}
                          fontWeight="bold"
                          fontSize="15px"
                          size="lg"
                          w="220px"
                          border="3px solid"
                          sx={{
                            borderColor: rematchAccepted
                              ? buttonBorder
                              : '#88C898 #387848 #387848 #88C898',
                          }}
                          boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
                          isDisabled={rematchAccepted}
                          _hover={rematchAccepted ? {} : {
                            bg: '#78B888',
                            boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                            transform: 'translate(-1px, -1px)',
                          }}
                          _active={rematchAccepted ? {} : {
                            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                            transform: 'translate(1px, 1px)',
                          }}
                          transition="all 0.1s"
                          onClick={handleRematch}
                        >
                          {rematchAccepted ? (
                            <HStack spacing={2}>
                              <Text
                                animation={`${pulseAnimation} 2s ease-in-out infinite`}
                              >
                                Waiting...
                              </Text>
                              <Box
                                bg="rgba(104,168,120,0.2)"
                                border="1px solid"
                                borderColor="#68A878"
                                borderRadius="sm"
                                px={2}
                                py={0.5}
                              >
                                <Text color="#68A878" fontSize="12px" fontWeight="bold">
                                  {rematchCount}/2
                                </Text>
                              </Box>
                            </HStack>
                          ) : (
                            'Rematch'
                          )}
                        </Button>
                      )}
                      <Button
                        bg="#1A1230"
                        color="#5BA8A8"
                        fontWeight="bold"
                        fontSize="15px"
                        size="lg"
                        w="220px"
                        border="3px solid"
                        sx={{ borderColor: '#7CC8C8 #3A7878 #3A7878 #7CC8C8' }}
                        boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
                        _hover={{
                          bg: '#221845',
                          boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                          transform: 'translate(-1px, -1px)',
                        }}
                        _active={{
                          boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                          transform: 'translate(1px, 1px)',
                        }}
                        transition="all 0.1s"
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
