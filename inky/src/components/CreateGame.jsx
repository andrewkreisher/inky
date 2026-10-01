import { useState } from 'react';
import { Box, VStack, Heading, Text, Container, Flex } from '@chakra-ui/react';
import { defaultMatchOptions } from '@shared/matchOptions.js';
import { MAP_MODE_CUSTOM } from '@shared/constants.js';
import backgroundImage from '../assets/inkybacklobby.png';
import { panelShadow } from '../theme';
import RetroButton, { GhostButton } from './ui/RetroButton';
import MatchOptions from './MatchOptions';

/** Host screen: pick match options, then create the room. */
export default function CreateGame({ socket, username, onBack }) {
  const [options, setOptions] = useState(defaultMatchOptions);

  // Custom mode with an empty sequence is meaningless; the server would fall back to random anyway.
  const customIncomplete = options.mapMode === MAP_MODE_CUSTOM && options.mapSequence.length === 0;

  const createGame = () => {
    if (customIncomplete) return;
    socket.emit('createGame', { username, options });
    // The server replies with `enterReadyRoom`, which the Lobby listens for.
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
      <Container maxW="680px" py={8}>
        <VStack spacing={5}>
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
              <GhostButton onClick={onBack}>&lt; Back</GhostButton>
              <Heading color="#68A878" fontSize="24px" textTransform="uppercase" letterSpacing="wider" fontWeight="bold">
                Host a Game
              </Heading>
              <Box w="52px" />
            </Flex>
          </Box>

          <Box
            w="100%"
            bg="rgba(26, 18, 48, 0.9)"
            borderRadius="md"
            border="2px solid"
            borderColor="#4A3870"
            boxShadow={panelShadow}
            p={6}
          >
            <VStack spacing={5} align="stretch">
              <MatchOptions value={options} onChange={setOptions} />

              <Box h="1px" bg="#3A2860" />

              <VStack spacing={2}>
                <RetroButton
                  variant="green"
                  fontSize="16px"
                  w="240px"
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
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
