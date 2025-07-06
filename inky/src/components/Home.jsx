import { Box, Button, Heading, VStack, Container } from '@chakra-ui/react';
import backgroundImage from '../assets/inkybackground.png';
import titleImage from '../assets/inkytitle.png';

export default function Home({ onJoinClick }) {
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
      right="0"
      bottom="0"
      overflowY="auto"
      width="100vw"
      height="100vh"
    >
      <Container maxW="container.md" py={8}>
        <VStack spacing={8}>
          <Heading 
            size="sm" 
            color="white"
            textShadow="2px 2px 4px rgba(0,0,0,0.4)"
            fontSize="120px"
          >
             <img src={titleImage} alt="Inky" />
          </Heading>
          <Button 
            size="lg" 
            colorScheme="red"
            fontSize="32px"
            py={8}
            px={12}
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
      </Container>
    </Box>
  );
}