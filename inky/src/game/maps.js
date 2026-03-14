// Client-side map data (mirrored from server/maps.js for single player mode)

const W = 1280;
const H = 720;

export const MAPS = [
  {
    id: 'open-field',
    name: 'Open Field',
    barriers: [],
    nets: [],
    playerSpawnScale: [
      [0.15, 0.5],
      [0.85, 0.5],
    ],
  },
  {
    id: 'the-wall',
    name: 'The Wall',
    barriers: [
      { x: W / 2, y: H / 2, width: 100, height: 300 },
    ],
    nets: [
      { x: W / 2, y: 105, width: 100, height: 210 },
      { x: W / 2, y: 615, width: 100, height: 210 },
    ],
    playerSpawnScale: [
      [0.25, 0.5],
      [0.75, 0.5],
    ],
  },
  {
    id: 'four-pillars',
    name: 'Four Pillars',
    barriers: [
      { x: 480, y: 260, width: 80, height: 80 },
      { x: 800, y: 260, width: 80, height: 80 },
      { x: 480, y: 460, width: 80, height: 80 },
      { x: 800, y: 460, width: 80, height: 80 },
    ],
    nets: [],
    playerSpawnScale: [
      [0.15, 0.5],
      [0.85, 0.5],
    ],
  },
  {
    id: 'the-trench',
    name: 'The Trench',
    barriers: [
      { x: W / 2, y: H / 2, width: 300, height: 100 },
    ],
    nets: [
      { x: 245, y: H / 2, width: 490, height: 100 },
      { x: 1035, y: H / 2, width: 490, height: 100 },
    ],
    playerSpawnScale: [
      [0.5, 0.2],
      [0.5, 0.8],
    ],
  },
  {
    id: 'fortress',
    name: 'Fortress',
    barriers: [
      { x: 300, y: H / 2, width: 80, height: 180 },
      { x: 980, y: H / 2, width: 80, height: 180 },
    ],
    nets: [],
    playerSpawnScale: [
      [0.12, 0.5],
      [0.88, 0.5],
    ],
  },
];

export const LEVELS = [
  { id: 1, name: 'Open Field', mapId: 'open-field' },
  { id: 2, name: 'The Wall', mapId: 'the-wall' },
  { id: 3, name: 'Four Pillars', mapId: 'four-pillars' },
  { id: 4, name: 'The Trench', mapId: 'the-trench' },
  { id: 5, name: 'Fortress', mapId: 'fortress' },
];
