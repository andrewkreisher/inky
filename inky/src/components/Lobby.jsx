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
  Flex,
  keyframes,
} from '@chakra-ui/react';
import backgroundImage from '../assets/inkybacklobby.png';

const pulseAnimation = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

const panelShadow = 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.03)';

export default function Lobby({ socket, onBack, onEnterReadyRoom }) {
  const [games, setGames] = useState([]);
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;

    const handleCurrentGames = (gamesData) => {
      setGames(Object.values(gamesData));
    };

    const handleGameCreated = (game) => {
      setGames(prev => [...prev, game]);
      toast({
        title: "Game Created",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    };

    const handleGameRemoved = (gameId) => {
      setGames(prev => prev.filter(game => game.id !== gameId));
    };

    const handleGameJoined = (game) => {
      setGames(prev => prev.map(g => g.id === game.id ? game : g));
    };

    const handleEnterReadyRoom = (data) => {
      onEnterReadyRoom(data);
    };

    socket.on('currentGames', handleCurrentGames);
    socket.on('gameCreated', handleGameCreated);
    socket.on('gameRemoved', handleGameRemoved);
    socket.on('gameJoined', handleGameJoined);
    socket.on('enterReadyRoom', handleEnterReadyRoom);

    socket.emit('currentGames');

    return () => {
      socket.off('currentGames', handleCurrentGames);
      socket.off('gameCreated', handleGameCreated);
      socket.off('gameRemoved', handleGameRemoved);
      socket.off('gameJoined', handleGameJoined);
      socket.off('enterReadyRoom', handleEnterReadyRoom);
    };
  }, [socket]);

  const createGame = () => {
    socket.emit('createGame', socket.id);
  };

  const joinGame = (gameId) => {
    socket.emit('joinGame', { gameId, playerId: socket.id });
  };

  const removeGame = (gameId) => {
    socket.emit('removeGame', { gameId, playerId: socket.id });
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
              <Button
                bg="transparent"
                color="#8878A8"
                fontSize="13px"
                fontWeight="bold"
                border="none"
                p={0}
                minW="auto"
                h="auto"
                _hover={{ color: '#B068A8' }}
                onClick={onBack}
              >
                &lt; Back
              </Button>
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
              <Button
                bg="#5BA8A8"
                color="#0F0A1A"
                fontWeight="bold"
                fontSize="16px"
                size="lg"
                w="200px"
                border="3px solid"
                sx={{ borderColor: '#7CC8C8 #3A7878 #3A7878 #7CC8C8' }}
                boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
                onClick={createGame}
                _hover={{
                  bg: '#6BB8B8',
                  boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                  transform: 'translate(-1px, -1px)',
                }}
                _active={{
                  bg: '#4A9898',
                  boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                  transform: 'translate(1px, 1px)',
                }}
                transition="all 0.1s"
              >
                Create Game
              </Button>
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
                    const shortId = game.id.slice(0, 4).toUpperCase();

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
                              Game #{shortId}
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
                            <Button
                              size="sm"
                              bg="#2A1830"
                              color="#C87068"
                              fontSize="13px"
                              border="2px solid"
                              sx={{ borderColor: '#A05858 #401818 #401818 #A05858' }}
                              boxShadow="2px 2px 0px rgba(0,0,0,0.4)"
                              _hover={{
                                bg: '#3A2040',
                                boxShadow: '3px 3px 0px rgba(0,0,0,0.4)',
                                transform: 'translate(-1px, -1px)',
                              }}
                              _active={{
                                boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
                                transform: 'translate(1px, 1px)',
                              }}
                              transition="all 0.1s"
                              onClick={() => removeGame(game.id)}
                            >
                              Remove
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              bg="#68A878"
                              color="#0F0A1A"
                              fontSize="13px"
                              fontWeight="bold"
                              border="2px solid"
                              sx={{ borderColor: '#88C898 #387848 #387848 #88C898' }}
                              boxShadow="2px 2px 0px rgba(0,0,0,0.4)"
                              _hover={{
                                bg: '#78B888',
                                boxShadow: '3px 3px 0px rgba(0,0,0,0.4)',
                                transform: 'translate(-1px, -1px)',
                              }}
                              _active={{
                                boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
                                transform: 'translate(1px, 1px)',
                              }}
                              transition="all 0.1s"
                              onClick={() => joinGame(game.id)}
                              isDisabled={isFull}
                            >
                              Join
                            </Button>
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
