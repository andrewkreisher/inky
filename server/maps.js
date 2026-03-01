// Game: 1280×720
// Barriers block players AND projectiles
// Nets block players only (projectiles pass through)
// playerSpawnScale: [x%, y%] of game dimensions

const W = 1280;
const H = 720;

module.exports = [
  {
    id: 'the-wall',
    name: 'The Wall',
    // Full vertical divider: barrier in center, nets filling top/bottom gaps
    barriers: [
      { x: W / 2, y: H / 2, width: 100, height: 300 },
    ],
    nets: [
      // Top: map top (y=0) to barrier top (y=210)
      { x: W / 2, y: 105, width: 100, height: 210 },
      // Bottom: barrier bottom (y=510) to map bottom (y=720)
      { x: W / 2, y: 615, width: 100, height: 210 },
    ],
    playerSpawnScale: [
      [0.25, 0.5],
      [0.75, 0.5],
    ],
  },
  {
    id: 'open-field',
    name: 'Open Field',
    // No obstacles — pure aim and dodge
    barriers: [],
    nets: [],
    playerSpawnScale: [
      [0.15, 0.5],
      [0.85, 0.5],
    ],
  },
  {
    id: 'four-pillars',
    name: 'Four Pillars',
    // Four barriers in a diamond — partial cover, no nets
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
    // Horizontal version of The Wall — players spawn top/bottom
    barriers: [
      { x: W / 2, y: H / 2, width: 300, height: 100 },
    ],
    nets: [
      // Left: map left (x=0) to barrier left (x=490)
      { x: 245, y: H / 2, width: 490, height: 100 },
      // Right: barrier right (x=790) to map right (x=1280)
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
    // Each player has a personal barrier near their spawn
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
