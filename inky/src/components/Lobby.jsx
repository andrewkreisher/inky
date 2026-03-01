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
const buttonBorder = '#6A5890 #2A1840 #2A1840 #6A5890';

export default function Lobby({ socket, onEnterReadyRoom }) {
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
      <Container maxW="560px" py={10}>
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
              color="#5BA8A8"
              fontSize="28px"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="bold"
            >
              Game Lobby
            </Heading>

            <Button
              bg="#5BA8A8"
              color="#0F0A1A"
              fontWeight="bold"
              fontSize="16px"
              size="lg"
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

            <VStack spacing={3} w="100%">
              {games.map((game) => {
                const isCreator = game.creator === socket?.id;
                const isFull = game.players.length >= 2;
                const shortId = game.id.slice(0, 4).toUpperCase();

                return (
                  <Box
                    key={game.id}
                    w="100%"
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

            {games.length === 0 && (
              <Text color="#8878A8" fontSize="13px" fontStyle="italic">
                No games yet — create one to start!
              </Text>
            )}
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}
