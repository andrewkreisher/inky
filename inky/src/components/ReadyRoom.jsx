import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Heading,
  Text,
  HStack,
  Container,
  useToast,
  keyframes,
} from '@chakra-ui/react';
import backgroundImage from '../assets/inkybacklobby.png';

const pulseAnimation = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

export default function ReadyRoom({ socket, readyRoomData, onGameStart, onAbort }) {
  const [gameData, setGameData] = useState(readyRoomData);
  const [readyState, setReadyState] = useState(readyRoomData?.ready || {});
  const [isReady, setIsReady] = useState(false);
  const toast = useToast();

  const players = gameData?.players || [];
  const myId = socket?.id;
  const hasBothPlayers = players.length === 2;

  useEffect(() => {
    if (!socket) return;

    const handleEnterReadyRoom = (data) => {
      setGameData(data);
      setReadyState(data.ready || {});
    };

    const handleReadyStateUpdated = (ready) => {
      setReadyState(ready);
    };

    const handleStartGame = (data) => {
      onGameStart(data);
    };

    const handleReadyRoomAborted = () => {
      toast({
        title: "Opponent left",
        status: "warning",
        duration: 2000,
        isClosable: true,
      });
      setTimeout(() => onAbort(), 1000);
    };

    socket.on('enterReadyRoom', handleEnterReadyRoom);
    socket.on('readyStateUpdated', handleReadyStateUpdated);
    socket.on('startGame', handleStartGame);
    socket.on('readyRoomAborted', handleReadyRoomAborted);

    return () => {
      socket.off('enterReadyRoom', handleEnterReadyRoom);
      socket.off('readyStateUpdated', handleReadyStateUpdated);
      socket.off('startGame', handleStartGame);
      socket.off('readyRoomAborted', handleReadyRoomAborted);
    };
  }, [socket]);

  const toggleReady = () => {
    if (isReady) {
      socket.emit('playerUnready', { gameId: gameData.id, playerId: myId });
      setIsReady(false);
    } else {
      socket.emit('playerReady', { gameId: gameData.id, playerId: myId });
      setIsReady(true);
    }
  };

  const leaveRoom = () => {
    socket.emit('leaveReadyRoom', { gameId: gameData.id, playerId: myId });
    onAbort();
  };

  return (
    <Box
      minH="100vh"
      bgImage={`url(${backgroundImage})`}
      bgSize="100% 100%"
      bgPosition="center"
      bgRepeat="no-repeat"
      bgAttachment="fixed"
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      overflowY="auto"
      width="100vw"
      height="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Container maxW="600px">
        <Box
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="xl"
          border="1px solid"
          borderColor="whiteAlpha.200"
          p={8}
          backdropFilter="blur(12px)"
        >
          <VStack spacing={8}>
            <Heading
              color="cyan.300"
              size="xl"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="bold"
              textShadow="0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.2)"
            >
              Ready Room
            </Heading>

            <HStack spacing={6} w="100%" justify="center">
              {/* Player 1 card */}
              {players.length > 0 ? (
                <PlayerCard
                  playerId={players[0]}
                  index={0}
                  isMe={players[0] === myId}
                  playerReady={readyState[players[0]] || false}
                />
              ) : null}

              {/* Player 2 card — or waiting placeholder */}
              {players.length > 1 ? (
                <PlayerCard
                  playerId={players[1]}
                  index={1}
                  isMe={players[1] === myId}
                  playerReady={readyState[players[1]] || false}
                />
              ) : (
                <Box
                  flex="1"
                  bg="whiteAlpha.50"
                  border="2px dashed"
                  borderColor="whiteAlpha.200"
                  borderRadius="lg"
                  p={6}
                  textAlign="center"
                >
                  <VStack spacing={3}>
                    <Text color="whiteAlpha.400" fontSize="lg" fontWeight="bold">
                      Player 2
                    </Text>
                    <Text
                      color="whiteAlpha.400"
                      fontSize="sm"
                      fontStyle="italic"
                      animation={`${pulseAnimation} 2s ease-in-out infinite`}
                    >
                      Waiting for opponent...
                    </Text>
                  </VStack>
                </Box>
              )}
            </HStack>

            <Button
              size="lg"
              w="200px"
              bg={isReady ? 'green.500' : 'whiteAlpha.200'}
              color={isReady ? 'white' : 'whiteAlpha.700'}
              border="2px solid"
              borderColor={isReady ? 'green.400' : 'whiteAlpha.400'}
              fontWeight="bold"
              fontSize="lg"
              _hover={{
                bg: isReady ? 'green.400' : 'whiteAlpha.300',
                boxShadow: isReady
                  ? '0 0 20px rgba(72, 187, 120, 0.4)'
                  : '0 0 10px rgba(255, 255, 255, 0.1)',
              }}
              transition="all 0.2s"
              onClick={toggleReady}
              isDisabled={!hasBothPlayers}
            >
              {isReady ? 'READY' : 'READY UP'}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              color="whiteAlpha.500"
              _hover={{ color: 'whiteAlpha.800' }}
              onClick={leaveRoom}
            >
              Leave
            </Button>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}

function PlayerCard({ playerId, index, isMe, playerReady }) {
  return (
    <Box
      flex="1"
      bg={playerReady ? 'rgba(72, 187, 120, 0.1)' : 'whiteAlpha.50'}
      border="2px solid"
      borderColor={playerReady ? 'green.400' : 'whiteAlpha.300'}
      borderRadius="lg"
      p={6}
      textAlign="center"
      transition="all 0.3s"
      transform={isMe ? 'scale(1.05)' : 'scale(1)'}
      boxShadow={playerReady ? '0 0 20px rgba(72, 187, 120, 0.3)' : 'none'}
    >
      <VStack spacing={3}>
        <Text
          color={isMe ? 'cyan.300' : 'white'}
          fontSize="lg"
          fontWeight="bold"
        >
          Player {index + 1}
        </Text>
        <Text
          color={isMe ? 'cyan.200' : 'whiteAlpha.500'}
          fontSize="xs"
        >
          {isMe ? '(You)' : ''}
        </Text>
        <Text
          color={playerReady ? 'green.300' : 'whiteAlpha.500'}
          fontSize="md"
          fontWeight="semibold"
        >
          {playerReady ? 'Ready!' : 'Not Ready'}
        </Text>
      </VStack>
    </Box>
  );
}
