import { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  VStack, 
  Heading, 
  List, 
  ListItem,
  Text,
  HStack,
  Container,
  useToast
} from '@chakra-ui/react';
import backgroundImage from '../assets/dark_background.png';

export default function Lobby({ socket, onGameStart }) {
  const [games, setGames] = useState([]);
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;

    socket.on('currentGames', (gamesData) => {
      setGames(Object.values(gamesData));
    });
    
    socket.on('gameCreated', (game) => {
      setGames(prev => [...prev, game]);
      toast({
        title: "Game Created",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    });

    socket.on('gameRemoved', (gameId) => {
      setGames(prev => prev.filter(game => game.id !== gameId));
    });

    socket.on('gameJoined', (game) => {
      setGames(prev => prev.map(g => g.id === game.id ? game : g));
    });

    socket.on('startGame', onGameStart);

    socket.emit('currentGames');

    return () => {
      socket.off('currentGames');
      socket.off('gameCreated');
      socket.off('gameRemoved');
      socket.off('gameJoined');
      socket.off('startGame');
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
        <VStack spacing={8}>
          <Heading 
            color="white" 
            size="2xl"
            textShadow="2px 2px 4px rgba(0,0,0,0.4)"
          >
            Game Lobby
          </Heading>
          
          <Button
            colorScheme="blue"
            size="lg"
            onClick={createGame}
            _hover={{ transform: 'scale(1.05)' }}
            transition="all 0.2s"
          >
            Create Game
          </Button>

          <List spacing={3} w="100%">
            {games.map(game => (
              <ListItem 
                key={game.id}
                bg="whiteAlpha.200"
                p={6}
                borderRadius="md"
                backdropFilter="blur(8px)"
              >
                <HStack justify="space-between">
                  <Text 
                    color="white"
                    fontSize="xl"
                  >
                    Game: {game.id} ({game.players.length}/2)
                  </Text>
                  {game.creator === socket?.id ? (
                    <Button
                      colorScheme="red"
                      size="md"
                      onClick={() => removeGame(game.id)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      colorScheme="green"
                      size="md"
                      onClick={() => joinGame(game.id)}
                      isDisabled={game.players.length >= 2}
                    >
                      Join
                    </Button>
                  )}
                </HStack>
              </ListItem>
            ))}
          </List>

          {games.length === 0 && (
            <Text color="whiteAlpha.700">
              No games available. Create one to get started!
            </Text>
          )}
        </VStack>
      </Container>
    </Box>
  );
}