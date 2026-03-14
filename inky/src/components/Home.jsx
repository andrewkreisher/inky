import { Box, Button, VStack, Container } from '@chakra-ui/react';
import backgroundImage from '../assets/inkybackmain.png';
import titleImage from '../assets/inkytitle.png';

const panelShadow = 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.03)';
const buttonBorder = '#6A5890 #2A1840 #2A1840 #6A5890';

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
              <Button
                size="lg"
                bg="#B068A8"
                color="#E8DCC8"
                fontWeight="bold"
                fontSize="20px"
                py={7}
                px={12}
                w="260px"
                border="3px solid"
                sx={{ borderColor: buttonBorder }}
                boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
                _hover={{
                  bg: '#C078B8',
                  boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
                  transform: 'translate(-1px, -1px)',
                }}
                _active={{
                  bg: '#905888',
                  boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                  transform: 'translate(1px, 1px)',
                }}
                transition="all 0.1s"
                onClick={onMultiplayerClick}
              >
                Multiplayer
              </Button>
              <Button
                size="lg"
                bg="#5BA8A8"
                color="#0F0A1A"
                fontWeight="bold"
                fontSize="20px"
                py={7}
                px={12}
                w="260px"
                border="3px solid"
                sx={{ borderColor: '#7CC8C8 #3A7878 #3A7878 #7CC8C8' }}
                boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
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
                onClick={onSinglePlayerClick}
              >
                Single Player
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
