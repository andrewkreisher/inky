import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  HStack,
  Container,
} from '@chakra-ui/react';
import { MainScene } from '../game/Scenes/MainScene';
import { usePhaserGame } from '../hooks/usePhaserGame';
import { panelShadow, pulseAnimation } from '../theme';
import RetroButton from './ui/RetroButton';

const CONTAINER_ID = 'game-container';

export default function Game({ socket, gameData, onReturnToLobby }) {
  const [endGameState, setEndGameState] = useState(null);
  const [rematchCount, setRematchCount] = useState(0);
  const [rematchAccepted, setRematchAccepted] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  usePhaserGame({
    parentId: CONTAINER_ID,
    sceneKey: 'MainScene',
    SceneClass: MainScene,
    sceneData: { gameId: gameData?.id, socket, usernames: gameData?.usernames || {} },
    enabled: Boolean(socket),
  });

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
    socket.emit('requestRematch', { gameId: gameData.id });
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
        id={CONTAINER_ID}
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
                    <RetroButton variant="teal" w="220px" onClick={handleBackToLobby}>
                      Back to Lobby
                    </RetroButton>
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
                              {s.username || (s.id === socket.id ? 'You' : 'Opponent')}:
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
                        <RetroButton
                          variant={rematchAccepted ? 'dark' : 'green'}
                          w="220px"
                          isDisabled={rematchAccepted}
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
                        </RetroButton>
                      )}
                      <RetroButton variant="tealOutline" w="220px" onClick={handleBackToLobby}>
                        Back to Lobby
                      </RetroButton>
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
