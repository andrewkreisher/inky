import { Box, Button, VStack, Container, Heading, SimpleGrid, Text } from '@chakra-ui/react';
import backgroundImage from '../assets/inkybacklobby.png';
import { LEVELS, MAPS } from '../game/maps';

const panelShadow = 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.03)';
const buttonBorder = '#6A5890 #2A1840 #2A1840 #6A5890';

export default function LevelSelect({ onSelectLevel, onBack }) {
  const handleSelect = (level) => {
    const map = MAPS.find(m => m.id === level.mapId);
    onSelectLevel({ ...level, map });
  };

  return (
    <Box
      minH="100vh"
      bgImage={`url(${backgroundImage})`}
      bgSize="100% 100%"
      bgPosition="center"
      bgRepeat="no-repeat"
      position="fixed"
      top="0"
      right="0"
      bottom="0"
      width="100vw"
      height="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflowY="auto"
    >
      <Container maxW="container.md">
        <VStack spacing={6}>
          <Heading
            fontSize="28px"
            color="#E8DCC8"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Single Player
          </Heading>

          <Box
            bg="rgba(26, 18, 48, 0.85)"
            border="2px solid"
            borderColor="#4A3870"
            boxShadow={panelShadow}
            borderRadius="md"
            p={6}
            w="100%"
          >
            <SimpleGrid columns={2} spacing={4}>
              {LEVELS.map(level => (
                <Button
                  key={level.id}
                  bg="#1A1230"
                  color="#E8DCC8"
                  border="2px solid"
                  borderColor="#4A3870"
                  borderRadius="md"
                  p={6}
                  h="auto"
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{
                    bg: '#221845',
                    borderColor: '#6A5890',
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '3px 3px 0px rgba(0,0,0,0.5)',
                  }}
                  _active={{
                    bg: '#140E25',
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                    transform: 'translate(1px, 1px)',
                  }}
                  transition="all 0.1s"
                  onClick={() => handleSelect(level)}
                >
                  <Text fontSize="14px" color="#8878A8" fontWeight="bold">
                    Level {level.id}
                  </Text>
                  <Text fontSize="16px" fontWeight="bold">
                    {level.name}
                  </Text>
                </Button>
              ))}
            </SimpleGrid>
          </Box>

          <Button
            bg="#1A1230"
            color="#5BA8A8"
            fontWeight="bold"
            fontSize="15px"
            size="lg"
            border="3px solid"
            sx={{ borderColor: buttonBorder }}
            boxShadow="3px 3px 0px rgba(0,0,0,0.5)"
            _hover={{
              bg: '#221845',
              boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
              transform: 'translate(-1px, -1px)',
            }}
            _active={{
              boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
              transform: 'translate(1px, 1px)',
            }}
            transition="all 0.1s"
            onClick={onBack}
          >
            Back
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}
