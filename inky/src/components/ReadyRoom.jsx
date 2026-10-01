import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  HStack,
  Container,
  useToast,
} from '@chakra-ui/react';
import { normalizeMatchOptions } from '@shared/matchOptions.js';
import { MAP_MODE_CUSTOM } from '@shared/constants.js';
import { getMapById } from '@shared/maps.js';
import backgroundImage from '../assets/inkybacklobby.png';
import { panelShadow, pulseAnimation } from '../theme';
import RetroButton, { GhostButton } from './ui/RetroButton';

export default function ReadyRoom({ socket, readyRoomData, onGameStart, onAbort }) {
  const [gameData, setGameData] = useState(readyRoomData);
  const [readyState, setReadyState] = useState(readyRoomData?.ready || {});
  const [isReady, setIsReady] = useState(false);
  const toast = useToast();

  const players = gameData?.players || [];
  const myId = socket?.id;
  const hasBothPlayers = players.length === 2;
  const options = normalizeMatchOptions(gameData?.options);

  useEffect(() => {
    if (!socket) return;

    const handleEnterReadyRoom = (data) => {
      setGameData(data);
      setReadyState(data.ready || {});
    };

    const handleReadyStateUpdated = (ready) => {
      setReadyState(ready);
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
    socket.on('startGame', onGameStart);
    socket.on('readyRoomAborted', handleReadyRoomAborted);

    return () => {
      socket.off('enterReadyRoom', handleEnterReadyRoom);
      socket.off('readyStateUpdated', handleReadyStateUpdated);
      socket.off('startGame', onGameStart);
      socket.off('readyRoomAborted', handleReadyRoomAborted);
    };
  }, [socket, onGameStart, onAbort, toast]);

  const toggleReady = () => {
    socket.emit(isReady ? 'playerUnready' : 'playerReady', { gameId: gameData.id });
    setIsReady(!isReady);
  };

  const leaveRoom = () => {
    socket.emit('leaveReadyRoom', { gameId: gameData.id });
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

            <MatchSummary options={options} />

            <HStack spacing={5} w="100%" justify="center">
              {/* Player 1 card */}
              {players.length > 0 ? (
                <PlayerCard
                  index={0}
                  isMe={players[0] === myId}
                  playerReady={readyState[players[0]] || false}
                  username={gameData?.usernames?.[players[0]]}
                />
              ) : null}

              {/* Player 2 card — or waiting placeholder */}
              {players.length > 1 ? (
                <PlayerCard
                  index={1}
                  isMe={players[1] === myId}
                  playerReady={readyState[players[1]] || false}
                  username={gameData?.usernames?.[players[1]]}
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

            <RetroButton
              variant={isReady ? 'green' : 'dark'}
              w="220px"
              fontSize="16px"
              onClick={toggleReady}
              isDisabled={!hasBothPlayers}
              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              {isReady ? 'READY' : 'READY UP'}
            </RetroButton>

            <GhostButton size="sm" onClick={leaveRoom}>
              Leave
            </GhostButton>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}

function Stat({ label, value }) {
  return (
    <VStack spacing={0}>
      <Text color="#E8DCC8" fontSize="18px" fontWeight="bold">{value}</Text>
      <Text color="#6a6a8a" fontSize="10px" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
    </VStack>
  );
}

/** Lives / rounds / map order chosen by the host. */
function MatchSummary({ options }) {
  const isCustom = options.mapMode === MAP_MODE_CUSTOM;
  const order = isCustom
    ? Array.from({ length: options.rounds }, (_, i) => options.mapSequence[i % options.mapSequence.length])
    : [];

  return (
    <Box
      w="100%"
      bg="#140E25"
      border="2px solid"
      borderColor="#3A2860"
      borderRadius="sm"
      boxShadow="inset 1px 1px 4px rgba(0,0,0,0.5)"
      px={4}
      py={3}
    >
      <VStack spacing={2}>
        <HStack spacing={8} justify="center">
          <Stat label="Lives" value={options.lives} />
          <Stat label="Rounds" value={options.rounds} />
          <Stat label="Maps" value={isCustom ? 'Custom' : 'Random'} />
        </HStack>
        {isCustom && (
          <Text color="#8878A8" fontSize="11px" textAlign="center">
            {order.map((id, i) => `${i + 1}. ${getMapById(id)?.name}`).join('  ·  ')}
          </Text>
        )}
      </VStack>
    </Box>
  );
}

function PlayerCard({ index, isMe, playerReady, username }) {
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
          {username || `Player ${index + 1}`}
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
