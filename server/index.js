const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const { GAME_TICK_RATE } = require('./config');
const { registerSocketHandlers } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Shared state
const activeGames = new Map();
let games = {};

// Wire sockets
registerSocketHandlers(io, { activeGames, games });

// Broadcast loop
setInterval(() => {
  activeGames.forEach((game, gameId) => {
    game.update();
    const gameState = game.getState();
    if (games[gameId]) {
      games[gameId].players.forEach(playerId => {
        io.to(playerId).emit('gameState', gameState);
      });
    }
  });
}, 1000 / GAME_TICK_RATE);

server.listen(process.env.PORT || 3000, () => console.log('Server on', process.env.PORT || 3000));
