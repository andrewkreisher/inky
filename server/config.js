module.exports = {
  GAME_TICK_RATE: 120,
  PLAYER_SPEED: 5,
  MAX_LIVES: 1,
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  INVINCIBILITY_DURATION: 2000,
  PLAYER_WIDTH: 80,
  PLAYER_HEIGHT: 80,
  // Central static barrier in the middle of the arena (legacy; map system overrides)
  BARRIER: {
    x: 1280 / 2,
    y: 720 / 2,
    width: 100,
    height: 300,
  },
  // New match system
  ROUNDS_PER_MATCH: 5,
}; 