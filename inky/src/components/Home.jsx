import { Box, VStack, Container } from '@chakra-ui/react';
import backgroundImage from '../assets/inkybackmain.png';
import titleImage from '../assets/inkytitle.png';
import { panelShadow } from '../theme';
import RetroButton from './ui/RetroButton';

export default function Home({ onMultiplayerClick, onSinglePlayerClick }) {
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
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Container maxW="container.md">
        <VStack spacing={10}>
          <Box>
            <img src={titleImage} alt="Inky" style={{ maxWidth: '400px', width: '100%', imageRendering: 'pixelated' }} />
          </Box>
          <Box
            bg="rgba(26, 18, 48, 0.85)"
            border="2px solid"
            borderColor="#4A3870"
            boxShadow={panelShadow}
            borderRadius="md"
            p={6}
            textAlign="center"
          >
            <VStack spacing={4}>
              <RetroButton variant="magenta" fontSize="20px" py={7} px={12} w="260px" onClick={onMultiplayerClick}>
                Multiplayer
              </RetroButton>
              <RetroButton variant="teal" fontSize="20px" py={7} px={12} w="260px" onClick={onSinglePlayerClick}>
                Single Player
              </RetroButton>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
