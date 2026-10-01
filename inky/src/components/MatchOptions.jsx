import { Box, HStack, Text, VStack, Wrap, WrapItem, Flex } from '@chakra-ui/react';
import {
  LIVES_OPTIONS, ROUNDS_OPTIONS,
  MAP_MODE_RANDOM, MAP_MODE_CUSTOM, MAX_CUSTOM_MAP_SEQUENCE,
} from '@shared/constants.js';
import { MAPS, getMapById } from '@shared/maps.js';
import RetroButton, { GhostButton } from './ui/RetroButton';

const LABEL = { color: '#6a6a8a', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 'wider' };

/** Row of mutually exclusive choices rendered as small retro buttons. */
function Segmented({ options, value, onChange, render = String }) {
  return (
    <HStack spacing={2}>
      {options.map(opt => (
        <RetroButton
          key={String(opt)}
          size="sm"
          variant={opt === value ? 'teal' : 'dark'}
          minW="44px"
          onClick={() => onChange(opt)}
        >
          {render(opt)}
        </RetroButton>
      ))}
    </HStack>
  );
}

function OptionRow({ label, children }) {
  return (
    <Flex w="100%" justify="space-between" align="center" gap={4} wrap="wrap">
      <Text {...LABEL}>{label}</Text>
      {children}
    </Flex>
  );
}

/**
 * Host-side match settings shown in the lobby's "Host a Game" panel.
 * `value` has the shape of `defaultMatchOptions()`; `onChange` receives a new object.
 */
export default function MatchOptions({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const isCustom = value.mapMode === MAP_MODE_CUSTOM;
  const sequence = value.mapSequence;

  const addMap = (id) => {
    if (sequence.length >= MAX_CUSTOM_MAP_SEQUENCE) return;
    set({ mapSequence: [...sequence, id] });
  };
  const removeAt = (i) => set({ mapSequence: sequence.filter((_, idx) => idx !== i) });

  return (
    <VStack spacing={3} w="100%" align="stretch">
      <OptionRow label="Lives per round">
        <Segmented options={LIVES_OPTIONS} value={value.lives} onChange={lives => set({ lives })} />
      </OptionRow>

      <OptionRow label="Rounds">
        <Segmented options={ROUNDS_OPTIONS} value={value.rounds} onChange={rounds => set({ rounds })} />
      </OptionRow>

      <OptionRow label="Maps">
        <HStack spacing={2}>
          <RetroButton
            size="sm"
            variant={!isCustom ? 'teal' : 'dark'}
            onClick={() => set({ mapMode: MAP_MODE_RANDOM })}
          >
            Random
          </RetroButton>
          <RetroButton
            size="sm"
            variant={isCustom ? 'teal' : 'dark'}
            onClick={() => set({ mapMode: MAP_MODE_CUSTOM })}
          >
            Configure Custom
          </RetroButton>
        </HStack>
      </OptionRow>

      {isCustom && (
        <Box
          bg="#140E25"
          border="2px solid"
          borderColor="#3A2860"
          borderRadius="sm"
          boxShadow="inset 1px 1px 4px rgba(0,0,0,0.5)"
          p={3}
        >
          <VStack spacing={3} align="stretch">
            <Flex justify="space-between" align="center">
              <Text {...LABEL}>Sequence ({sequence.length}/{value.rounds})</Text>
              {sequence.length > 0 && (
                <GhostButton fontSize="11px" onClick={() => set({ mapSequence: [] })}>
                  Clear
                </GhostButton>
              )}
            </Flex>

            {/* Chosen order: click a chip to remove it */}
            <Wrap spacing={2} minH="28px">
              {sequence.length === 0 ? (
                <Text color="#685888" fontSize="12px" fontStyle="italic">
                  Pick maps below to build the round order (repeats allowed).
                </Text>
              ) : sequence.map((id, i) => (
                <WrapItem key={`${id}-${i}`}>
                  <GhostButton
                    fontSize="12px"
                    px={2}
                    py={1}
                    h="auto"
                    color="#E8DCC8"
                    border="1px solid"
                    borderColor="#5BA8A8"
                    bg="rgba(91,168,168,0.15)"
                    _hover={{ color: '#C87068', borderColor: '#C87068', bg: 'rgba(200,112,104,0.15)' }}
                    title="Remove"
                    onClick={() => removeAt(i)}
                  >
                    {i + 1}. {getMapById(id)?.name} ×
                  </GhostButton>
                </WrapItem>
              ))}
            </Wrap>

            <Box h="1px" bg="#3A2860" />

            {/* Palette */}
            <Wrap spacing={2}>
              {MAPS.map(map => (
                <WrapItem key={map.id}>
                  <RetroButton
                    size="sm"
                    variant="green"
                    onClick={() => addMap(map.id)}
                    isDisabled={sequence.length >= MAX_CUSTOM_MAP_SEQUENCE}
                    _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                  >
                    + {map.name}
                  </RetroButton>
                </WrapItem>
              ))}
            </Wrap>

            {sequence.length > 0 && sequence.length < value.rounds && (
              <Text color="#C8A868" fontSize="11px">
                Fewer maps than rounds: the sequence loops.
              </Text>
            )}
            {sequence.length > value.rounds && (
              <Text color="#C8A868" fontSize="11px">
                More maps than rounds: only the first {value.rounds} are played.
              </Text>
            )}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
