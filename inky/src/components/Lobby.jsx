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
  Badge,
  Flex,
  keyframes,
} from '@chakra-ui/react';
import backgroundImage from '../assets/inkybacklobby.png';

const pulseAnimation = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

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
      <Container maxW="container.md" py={8}>
        <Box
          bg="rgba(0, 0, 0, 0.75)"
          borderRadius="xl"
          border="1px solid"
          borderColor="whiteAlpha.200"
          p={8}
          backdropFilter="blur(12px)"
        >
          <VStack spacing={8}>
            <Heading
              color="cyan.300"
              size="2xl"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="bold"
              textShadow="0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.2)"
            >
              Game Lobby
            </Heading>

            <Button
              bg="cyan.500"
              color="black"
              fontWeight="bold"
              size="lg"
              onClick={createGame}
              _hover={{
                bg: 'cyan.400',
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
                transform: 'scale(1.05)',
              }}
              transition="all 0.2s"
            >
              Create Game
            </Button>

            <VStack spacing={4} w="100%">
              {games.map((game, index) => {
                const isCreator = game.creator === socket?.id;
                const isFull = game.players.length >= 2;
                const shortId = game.id.slice(0, 4).toUpperCase();

                return (
                  <Box
                    key={game.id}
                    w="100%"
                    bg="whiteAlpha.100"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="lg"
                    p={5}
                    transition="all 0.2s"
                    _hover={{ borderColor: 'whiteAlpha.400', bg: 'whiteAlpha.150' }}
                  >
                    <Flex justify="space-between" align="center">
                      <VStack align="start" spacing={1}>
                        <Text color="white" fontSize="lg" fontWeight="bold">
                          Game #{shortId}
                        </Text>
                        <HStack spacing={2}>
                          <Badge
                            colorScheme={isFull ? 'green' : 'yellow'}
                            variant="subtle"
                            fontSize="xs"
                          >
                            {game.players.length}/2 Players
                          </Badge>
                          {isCreator && !isFull && (
                            <Text
                              color="whiteAlpha.600"
                              fontSize="sm"
                              fontStyle="italic"
                              animation={`${pulseAnimation} 2s ease-in-out infinite`}
                            >
                              Waiting for opponent...
                            </Text>
                          )}
                        </HStack>
                      </VStack>

                      {isCreator ? (
                        <Button
                          size="sm"
                          bg="whiteAlpha.200"
                          color="red.300"
                          border="1px solid"
                          borderColor="red.400"
                          _hover={{
                            bg: 'red.900',
                            borderColor: 'red.300',
                          }}
                          onClick={() => removeGame(game.id)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          bg="green.500"
                          color="white"
                          fontWeight="bold"
                          _hover={{
                            bg: 'green.400',
                            boxShadow: '0 0 15px rgba(72, 187, 120, 0.4)',
                          }}
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
              <Text color="whiteAlpha.600" fontStyle="italic">
                No games yet — create one to start!
              </Text>
            )}
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}
