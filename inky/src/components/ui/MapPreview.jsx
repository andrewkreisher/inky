import { Box } from '@chakra-ui/react';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/constants.js';
import { getSpawnPosition } from '@shared/maps.js';

const COLORS = {
  water: '#173E4A',
  grid: 'rgba(255,255,255,0.05)',
  barrier: '#8B5A2B',
  barrierEdge: '#5A3A18',
  net: 'rgba(200,168,104,0.35)',
  netEdge: '#C8A868',
  p1: '#5BA8A8',
  p2: '#B068A8',
};

/**
 * Scaled-down schematic of a map: barriers (wood), nets (hatched), and the two
 * spawn points. Pure SVG, sized by the parent via `w`.
 */
export default function MapPreview({ map, w = '160px', showSpawns = true, ...rest }) {
  if (!map) return null;
  const rect = (r, fill, stroke) => (
    <rect
      key={`${r.x}-${r.y}-${r.width}-${r.height}`}
      x={r.x - r.width / 2}
      y={r.y - r.height / 2}
      width={r.width}
      height={r.height}
      fill={fill}
      stroke={stroke}
      strokeWidth={6}
    />
  );
  const spawnR = 34;

  return (
    <Box w={w} lineHeight={0} {...rest}>
      <svg
        viewBox={`0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`}
        width="100%"
        style={{ display: 'block', borderRadius: 3, imageRendering: 'pixelated' }}
        aria-label={`${map.name} layout`}
      >
        <defs>
          <pattern id="map-preview-net" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M0 40 L40 0 M-10 10 L10 -10 M30 50 L50 30" stroke={COLORS.netEdge} strokeWidth="5" opacity="0.6" />
          </pattern>
        </defs>
        <rect width={GAME_WIDTH} height={GAME_HEIGHT} fill={COLORS.water} />
        {/* faint grid for scale */}
        {[1, 2, 3].map(i => (
          <line key={`v${i}`} x1={(GAME_WIDTH / 4) * i} y1={0} x2={(GAME_WIDTH / 4) * i} y2={GAME_HEIGHT} stroke={COLORS.grid} strokeWidth={4} />
        ))}
        <line x1={0} y1={GAME_HEIGHT / 2} x2={GAME_WIDTH} y2={GAME_HEIGHT / 2} stroke={COLORS.grid} strokeWidth={4} />

        {(map.nets || []).map(n => rect(n, 'url(#map-preview-net)', COLORS.netEdge))}
        {(map.nets || []).map(n => rect({ ...n }, COLORS.net, 'none'))}
        {(map.barriers || []).map(b => rect(b, COLORS.barrier, COLORS.barrierEdge))}

        {showSpawns && [0, 1].map(i => {
          const p = getSpawnPosition(map, i);
          return (
            <circle key={i} cx={p.x} cy={p.y} r={spawnR} fill={i === 0 ? COLORS.p1 : COLORS.p2} stroke="#0F0A1A" strokeWidth={8} />
          );
        })}
      </svg>
    </Box>
  );
}
