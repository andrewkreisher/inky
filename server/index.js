import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { TICK_MS, TICKS_PER_SNAPSHOT } from '../shared/constants.js';
import { registerSocketHandlers } from './socket.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST'],
  },
});

const activeGames = new Map();
const lobbyGames = {};
const connectedUsernames = new Map(); // socketId → username

registerSocketHandlers(io, { activeGames, lobbyGames, connectedUsernames });

// Fixed-timestep simulation loop. Node timers drift, so we accumulate real
// elapsed time and run however many ticks are owed (capped to avoid a spiral
// after a long stall). Snapshots go out every TICKS_PER_SNAPSHOT ticks.
const MAX_TICKS_PER_WAKE = 8;
let last = performance.now();
let accumulator = 0;
let tickCounter = 0;

setInterval(() => {
  const now = performance.now();
  accumulator += now - last;
  last = now;

  let ticks = 0;
  while (accumulator >= TICK_MS && ticks < MAX_TICKS_PER_WAKE) {
    accumulator -= TICK_MS;
    ticks++;
    tickCounter++;
    const snapshot = tickCounter % TICKS_PER_SNAPSHOT === 0;
    activeGames.forEach((game, gameId) => {
      game.update();
      if (snapshot) io.to(gameId).emit('gameState', game.getState());
    });
  }
  if (ticks === MAX_TICKS_PER_WAKE) accumulator = 0;
}, Math.max(1, Math.floor(TICK_MS / 2)));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port', PORT));
