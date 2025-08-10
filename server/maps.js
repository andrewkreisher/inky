module.exports = [
  {
    id: 'map-1',
    name: 'Map 1',
    barriers: [
      // Legacy center vertical barrier
      { x: 1280 / 2, y: 720 / 2, width: 100, height: 300 },
    ],
  },
  {
    id: 'map-2',
    name: 'Map 2',
    barriers: [
      // Two smaller vertical barriers offset left/right
      { x: 1280 * 0.35, y: 720 * 0.5, width: 80, height: 260 },
      { x: 1280 * 0.65, y: 720 * 0.5, width: 80, height: 260 },
    ],
  },
  {
    id: 'map-3',
    name: 'Map 3',
    barriers: [
      // Horizontal mid barrier
      { x: 1280 / 2, y: 720 / 2, width: 400, height: 80 },
    ],
  },
  {
    id: 'map-4',
    name: 'Map 4',
    barriers: [
      // Four pillars in corners-ish
      { x: 1280 * 0.25, y: 720 * 0.25, width: 90, height: 90 },
      { x: 1280 * 0.75, y: 720 * 0.25, width: 90, height: 90 },
      { x: 1280 * 0.25, y: 720 * 0.75, width: 90, height: 90 },
      { x: 1280 * 0.75, y: 720 * 0.75, width: 90, height: 90 },
    ],
  },
]; 