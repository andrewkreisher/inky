import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  HStack,
  Container,
  Flex,
  Input,
} from '@chakra-ui/react';
import { defaultMatchOptions, describeMatchOptions } from '@shared/matchOptions.js';
import { MAP_MODE_CUSTOM } from '@shared/constants.js';
import backgroundImage from '../assets/inkybacklobby.png';
import { panelShadow, pulseAnimation } from '../theme';
import RetroButton, { GhostButton } from './ui/RetroButton';
import MatchOptions from './MatchOptions';

export default function Lobby({ socket, username, onUsernameChange, onBack, onEnterReadyRoom }) {
  const [games, setGames] = useState([]);
  const [options, setOptions] = useState(defaultMatchOptions);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(username);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!socket) return;

    const handleCurrentGames = (gamesData) => {
      setGames(Object.values(gamesData));
    };

    const handleGameCreated = (game) => {
      setGames(prev => [...prev.filter(g => g.id !== game.id), game]);
    };

    const handleGameRemoved = (gameId) => {
      setGames(prev => prev.filter(game => game.id !== gameId));
    };

    const handleGameJoined = (game) => {
      setGames(prev => prev.map(g => g.id === game.id ? game : g));
    };

    socket.on('currentGames', handleCurrentGames);
    socket.on('gameCreated', handleGameCreated);
    socket.on('gameRemoved', handleGameRemoved);
    socket.on('gameJoined', handleGameJoined);
    socket.on('enterReadyRoom', onEnterReadyRoom);

    socket.emit('currentGames');

    return () => {
      socket.off('currentGames', handleCurrentGames);
      socket.off('gameCreated', handleGameCreated);
      socket.off('gameRemoved', handleGameRemoved);
      socket.off('gameJoined', handleGameJoined);
      socket.off('enterReadyRoom', onEnterReadyRoom);
    };
  }, [socket, onEnterReadyRoom]);

  // A custom mode with an empty sequence is meaningless; the server would fall back to random anyway.
  const customIncomplete = options.mapMode === MAP_MODE_CUSTOM && options.mapSequence.length === 0;

  const createGame = () => {
    if (customIncomplete) return;
    socket.emit('createGame', { username, options });
  };

  const joinGame = (gameId) => {
    socket.emit('joinGame', { gameId, username });
  };

  const removeGame = (gameId) => {
    socket.emit('removeGame', { gameId });
  };

  const submitNameChange = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === username) {
      setNameInput(username);
      setIsEditingName(false);
      setNameError('');
      return;
    }
    socket.emit('changeUsername', { newUsername: trimmed }, (res) => {
      if (res.success) {
        onUsernameChange(trimmed);
        setIsEditingName(false);
        setNameError('');
      } else {
        setNameError(res.error || 'Name taken');
      }
    });
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
    >
      <Container maxW="640px" py={8}>
        <VStack spacing={5}>

          {/* ── Header Bar ── */}
          <Box
            w="100%"
            bg="rgba(34, 24, 60, 0.9)"
            border="2px solid"
            borderColor="#4A3870"
            borderRadius="md"
            px={5}
            py={3}
          >
            <Flex justify="space-between" align="center">
              <GhostButton onClick={onBack}>
                &lt; Back
              </GhostButton>
              <Heading
                color="#5BA8A8"
                fontSize="24px"
                textTransform="uppercase"
                letterSpacing="wider"
                fontWeight="bold"
              >
                Game Lobby
              </Heading>
              {/* Spacer to center the title */}
              <Box w="52px" />
            </Flex>
          </Box>

          {/* ── Username Bar ── */}
          <Box
            w="100%"
            bg="rgba(26, 18, 48, 0.9)"
            borderRadius="md"
            border="2px solid"
            borderColor="#4A3870"
            boxShadow={panelShadow}
            px={5}
            py={3}
          >
            <Flex align="center" justify="space-between">
              <Text color="#6a6a8a" fontSize="12px" fontWeight="bold" textTransform="uppercase" mr={3}>
                Username
              </Text>
              {isEditingName ? (
                <HStack spacing={2} flex="1" justify="flex-end">
                  <Input
                    size="sm"
                    maxW="180px"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setNameError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitNameChange();
                      if (e.key === 'Escape') {
                        setNameInput(username);
                        setIsEditingName(false);
                        setNameError('');
                      }
                    }}
                    maxLength={16}
                    autoFocus
                    bg="#0D0818"
                    color="#E8DCC8"
                    border="1px solid"
                    borderColor={nameError ? '#C87068' : '#4A3870'}
                    fontSize="14px"
                    fontWeight="bold"
                    _focus={{ borderColor: nameError ? '#C87068' : '#5BA8A8' }}
                  />
                  <RetroButton variant="green" size="sm" fontSize="12px" onClick={submitNameChange}>
                    Save
                  </RetroButton>
                  {nameError && (
                    <Text color="#C87068" fontSize="11px" fontWeight="bold" whiteSpace="nowrap">
                      {nameError}
                    </Text>
                  )}
                </HStack>
              ) : (
                <HStack spacing={3}>
                  <Text color="#5BA8A8" fontSize="14px" fontWeight="bold">
                    {username}
                  </Text>
                  <GhostButton
                    size="xs"
                    fontSize="11px"
                    px={2}
                    h="auto"
                    py={1}
                    border="1px solid"
                    borderColor="#4A3870"
                    _hover={{ color: '#B068A8', borderColor: '#6A5890', bg: 'transparent' }}
                    onClick={() => {
                      setNameInput(username);
                      setIsEditingName(true);
                      setNameError('');
                    }}
                  >
                    Edit
                  </GhostButton>
                </HStack>
              )}
            </Flex>
          </Box>

          {/* ── Host Game Panel ── */}
          <Box
            w="100%"
            bg="rgba(26, 18, 48, 0.9)"
            borderRadius="md"
            border="2px solid"
            borderColor="#4A3870"
            boxShadow={panelShadow}
            p={6}
          >
            <VStack spacing={4}>
              <Text
                color="#B068A8"
                fontSize="14px"
                textTransform="uppercase"
                letterSpacing="widest"
                fontWeight="bold"
              >
                Host a Game
              </Text>

              <MatchOptions value={options} onChange={setOptions} />

              <Box h="1px" bg="#3A2860" w="100%" />

              <RetroButton
                variant="teal"
                fontSize="16px"
                w="200px"
                onClick={createGame}
                isDisabled={customIncomplete}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                Create Game
              </RetroButton>
              {customIncomplete && (
                <Text color="#C8A868" fontSize="11px">Add at least one map to the sequence.</Text>
              )}
            </VStack>
          </Box>

          {/* ── Open Games Panel ── */}
          <Box
            w="100%"
            bg="rgba(26, 18, 48, 0.9)"
            borderRadius="md"
            border="2px solid"
            borderColor="#4A3870"
            boxShadow={panelShadow}
            p={6}
          >
            <VStack spacing={4} align="stretch">
              <Flex justify="space-between" align="center">
                <Text
                  color="#B068A8"
                  fontSize="14px"
                  textTransform="uppercase"
                  letterSpacing="widest"
                  fontWeight="bold"
                >
                  Open Games
                </Text>
                <Box
                  bg="rgba(91, 168, 168, 0.15)"
                  border="1px solid"
                  borderColor="#5BA8A8"
                  borderRadius="sm"
                  px={2}
                  py={0.5}
                >
                  <Text color="#5BA8A8" fontSize="11px" fontWeight="bold">
                    {games.length} room{games.length !== 1 ? 's' : ''}
                  </Text>
                </Box>
              </Flex>

              {/* Divider line */}
              <Box h="1px" bg="#3A2860" />

              {/* Game list */}
              <Box
                maxH="320px"
                overflowY="auto"
                sx={{
                  '&::-webkit-scrollbar': { width: '6px' },
                  '&::-webkit-scrollbar-track': { bg: '#0D0818' },
                  '&::-webkit-scrollbar-thumb': {
                    bg: '#4A3870',
                    borderRadius: '3px',
                  },
                }}
              >
                <VStack spacing={3} align="stretch">
                  {games.map((game) => {
                    const isCreator = game.creator === socket?.id;
                    const isFull = game.players.length >= 2;
                    const creatorName = game.usernames?.[game.creator] || game.id.slice(0, 4).toUpperCase();

                    return (
                      <Box
                        key={game.id}
                        bg="#140E25"
                        border="2px solid"
                        borderColor="#3A2860"
                        borderRadius="sm"
                        boxShadow="inset 1px 1px 4px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.02)"
                        p={4}
                        transition="all 0.1s"
                        _hover={{ borderColor: '#5A4880' }}
                      >
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={1}>
                            <Text color="#E8DCC8" fontSize="15px" fontWeight="bold">
                              {`${creatorName}'s game`}
                            </Text>
                            <Text color="#8878A8" fontSize="11px">
                              {describeMatchOptions(game.options)}
                            </Text>
                            <HStack spacing={3}>
                              <Box
                                bg={isFull ? 'rgba(104,168,120,0.2)' : 'rgba(200,168,104,0.2)'}
                                border="1px solid"
                                borderColor={isFull ? '#68A878' : '#C8A868'}
                                borderRadius="sm"
                                px={2}
                                py={0.5}
                              >
                                <Text
                                  color={isFull ? '#68A878' : '#C8A868'}
                                  fontSize="11px"
                                  fontWeight="bold"
                                >
                                  {game.players.length}/2
                                </Text>
                              </Box>
                              {isCreator && !isFull && (
                                <Text
                                  color="#8878A8"
                                  fontSize="12px"
                                  fontStyle="italic"
                                  animation={`${pulseAnimation} 2s ease-in-out infinite`}
                                >
                                  Waiting...
                                </Text>
                              )}
                            </HStack>
                          </VStack>

                          {isCreator ? (
                            <RetroButton variant="danger" size="sm" onClick={() => removeGame(game.id)}>
                              Remove
                            </RetroButton>
                          ) : (
                            <RetroButton
                              variant="green"
                              size="sm"
                              onClick={() => joinGame(game.id)}
                              isDisabled={isFull}
                              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                            >
                              Join
                            </RetroButton>
                          )}
                        </Flex>
                      </Box>
                    );
                  })}
                </VStack>
              </Box>

              {games.length === 0 && (
                <Box
                  bg="#0D0818"
                  border="2px dashed"
                  borderColor="#3A2860"
                  borderRadius="sm"
                  py={8}
                  textAlign="center"
                >
                  <VStack spacing={2}>
                    <Text color="#8878A8" fontSize="14px" fontWeight="bold">
                      No open games
                    </Text>
                    <Text color="#685888" fontSize="12px">
                      Host one to get started!
                    </Text>
                  </VStack>
                </Box>
              )}
            </VStack>
          </Box>

        </VStack>
      </Container>
    </Box>
  );
}
