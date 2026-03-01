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
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
`;

const panelShadow = 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.03)';
const buttonBorder = '#6A5890 #2A1840 #2A1840 #6A5890';

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
      <Container maxW="540px">
        <Box
          bg="rgba(26, 18, 48, 0.9)"
          borderRadius="md"
          border="2px solid"
          borderColor="#4A3870"
          boxShadow={panelShadow}
          p={8}
        >
          <VStack spacing={7}>
            <Heading
              color="#B068A8"
              fontSize="26px"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="bold"
            >
              Ready Room
            </Heading>

            <HStack spacing={5} w="100%" justify="center">
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
                  bg="#0D0818"
                  border="2px dashed"
                  borderColor="#3A2860"
                  borderRadius="sm"
                  p={5}
                  textAlign="center"
                >
                  <VStack spacing={2}>
                    <Text color="#8878A8" fontSize="14px" fontWeight="bold">
                      Player 2
                    </Text>
                    <Text
                      color="#685888"
                      fontSize="11px"
                      fontStyle="italic"
                      animation={`${pulseAnimation} 2s ease-in-out infinite`}
                    >
                      Waiting...
                    </Text>
                  </VStack>
                </Box>
              )}
            </HStack>

            <Button
              size="lg"
              w="220px"
              bg={isReady ? '#68A878' : '#1A1230'}
              color={isReady ? '#0F0A1A' : '#8878A8'}
              border="3px solid"
              sx={{
                borderColor: isReady
                  ? '#88C898 #387848 #387848 #88C898'
                  : buttonBorder,
              }}
              fontWeight="bold"
              fontSize="16px"
              boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
              _hover={{
                bg: isReady ? '#78B888' : '#221845',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                transform: 'translate(-1px, -1px)',
              }}
              _active={{
                boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                transform: 'translate(1px, 1px)',
              }}
              transition="all 0.1s"
              onClick={toggleReady}
              isDisabled={!hasBothPlayers}
            >
              {isReady ? 'READY' : 'READY UP'}
            </Button>

            <Button
              size="sm"
              bg="transparent"
              color="#8878A8"
              fontSize="13px"
              border="none"
              _hover={{ color: '#B068A8' }}
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
      bg={playerReady ? 'rgba(104,168,120,0.1)' : '#140E25'}
      border="2px solid"
      borderColor={playerReady ? '#68A878' : '#3A2860'}
      borderRadius="sm"
      boxShadow={
        playerReady
          ? 'inset 1px 1px 4px rgba(0,0,0,0.4), 0 0 8px rgba(104,168,120,0.15)'
          : 'inset 1px 1px 4px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.02)'
      }
      p={5}
      textAlign="center"
      transition="all 0.2s"
      transform={isMe ? 'scale(1.03)' : 'scale(1)'}
    >
      <VStack spacing={2}>
        <Text
          color={isMe ? '#5BA8A8' : '#E8DCC8'}
          fontSize="14px"
          fontWeight="bold"
        >
          Player {index + 1}
        </Text>
        <Text
          color={isMe ? '#5BA8A8' : '#8878A8'}
          fontSize="11px"
        >
          {isMe ? '(You)' : ''}
        </Text>
        <Text
          color={playerReady ? '#68A878' : '#8878A8'}
          fontSize="13px"
          fontWeight="bold"
        >
          {playerReady ? 'Ready!' : 'Not Ready'}
        </Text>
      </VStack>
    </Box>
  );
}
