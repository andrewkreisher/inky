import { Button } from '@chakra-ui/react';

/**
 * Chunky bevelled button used across every screen.
 *
 * `variant` picks the colour scheme; `size` ("sm" | "lg") picks the bevel
 * depth. Any other Chakra `Button` prop is passed through, so callers can
 * still tweak width/padding or override `_hover` for special cases.
 */
const VARIANTS = {
  // Bright fills
  magenta: { bg: '#B068A8', color: '#E8DCC8', border: '#6A5890 #2A1840 #2A1840 #6A5890', hoverBg: '#C078B8' },
  teal:    { bg: '#5BA8A8', color: '#0F0A1A', border: '#7CC8C8 #3A7878 #3A7878 #7CC8C8', hoverBg: '#6BB8B8' },
  green:   { bg: '#68A878', color: '#0F0A1A', border: '#88C898 #387848 #387848 #88C898', hoverBg: '#78B888' },
  // Dark panel fills
  tealOutline: { bg: '#1A1230', color: '#5BA8A8', border: '#7CC8C8 #3A7878 #3A7878 #7CC8C8', hoverBg: '#221845' },
  dark:        { bg: '#1A1230', color: '#8878A8', border: '#6A5890 #2A1840 #2A1840 #6A5890', hoverBg: '#221845' },
  danger:      { bg: '#2A1830', color: '#C87068', border: '#A05858 #401818 #401818 #A05858', hoverBg: '#3A2040' },
};

const SIZES = {
  lg: { borderWidth: '3px', shadow: 3, fontSize: '15px', chakraSize: 'lg' },
  sm: { borderWidth: '2px', shadow: 2, fontSize: '13px', chakraSize: 'sm' },
};

const shadow = (px, alpha) => `${px}px ${px}px 0px rgba(0,0,0,${alpha})`;

export default function RetroButton({ variant = 'teal', size = 'lg', isDisabled, children, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.teal;
  const s = SIZES[size] || SIZES.lg;
  const alpha = size === 'sm' ? 0.4 : 0.5;

  return (
    <Button
      size={s.chakraSize}
      bg={v.bg}
      color={v.color}
      fontWeight="bold"
      fontSize={s.fontSize}
      border={`${s.borderWidth} solid`}
      sx={{ borderColor: v.border }}
      boxShadow={shadow(s.shadow, alpha)}
      transition="all 0.1s"
      isDisabled={isDisabled}
      _hover={isDisabled ? {} : {
        bg: v.hoverBg,
        boxShadow: shadow(s.shadow + 1, alpha),
        transform: 'translate(-1px, -1px)',
      }}
      _active={isDisabled ? {} : {
        boxShadow: size === 'sm' ? 'inset 1px 1px 2px rgba(0,0,0,0.5)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)',
        transform: 'translate(1px, 1px)',
      }}
      _disabled={{ opacity: 1, cursor: 'default', bg: v.bg }}
      {...rest}
    >
      {children}
    </Button>
  );
}

/** Text-only link-style button ("< Back", "Leave"). */
export function GhostButton({ children, ...rest }) {
  return (
    <Button
      bg="transparent"
      color="#8878A8"
      fontSize="13px"
      fontWeight="bold"
      border="none"
      p={0}
      minW="auto"
      h="auto"
      _hover={{ color: '#B068A8', bg: 'transparent' }}
      _active={{ bg: 'transparent' }}
      {...rest}
    >
      {children}
    </Button>
  );
}
