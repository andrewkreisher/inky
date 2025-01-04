import { Box, Button, Heading, VStack } from '@chakra-ui/react';
import backgroundImage from '../assets/background.png';

export default function Home({ onJoinClick }) {
  return (
    <Box 
      height="100vh" 
      display="flex" 
      alignItems="center" 
      justifyContent="center"
      bgImage={`url(${backgroundImage})`}
      bgSize="cover"
    >
      <VStack spacing={8}>
        <Heading 
          size="4xl" 
          color="white"
          textShadow="2px 2px 4px rgba(0,0,0,0.4)"
        >
          Inky
        </Heading>
        <Button 
          size="lg" 
          colorScheme="red"
          _hover={{ 
            bg: 'pink.500',
            transform: 'scale(1.05)'
          }}
          transition="all 0.2s"
          onClick={onJoinClick}
        >
          Join Game
        </Button>
      </VStack>
    </Box>
  );
}