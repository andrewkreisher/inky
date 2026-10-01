import { extendTheme, keyframes } from '@chakra-ui/react';

export const theme = extendTheme({
  fonts: {
    heading: '"Silkscreen", monospace',
    body: '"Silkscreen", monospace',
  },
  styles: {
    global: {
      body: {
        bg: '#0F0A1A',
        color: '#E8DCC8',
      },
    },
  },
  colors: {
    retro: {
      bg: '#0F0A1A',
      panel: '#1A1230',
      panelHover: '#221845',
      border: '#4A3870',
      borderDark: '#0A0612',
      text: '#E8DCC8',
      muted: '#8878A8',
      teal: '#5BA8A8',
      magenta: '#B068A8',
      green: '#68A878',
      coral: '#C87068',
      amber: '#C8A868',
    },
  },
});

// Shared "retro panel" styling token used across screens.
// Button bevels live in components/ui/RetroButton.jsx.
export const panelShadow = 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.03)';

export const pulseAnimation = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;
