const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const { GAME_TICK_RATE } = require('./config');
const { registerSocketHandlers } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : "*",
    methods: ["GET", "POST"],
  },
});

const activeGames = new Map();
const lobbyGames = {};

registerSocketHandlers(io, { activeGames, lobbyGames });

// Broadcast loop
setInterval(() => {
  activeGames.forEach((game, gameId) => {
    game.update();
    const gameState = game.getState();
    io.to(gameId).emit('gameState', gameState);
  });
}, 1000 / GAME_TICK_RATE);

server.listen(process.env.PORT || 3000, () => console.log('Server running on port', process.env.PORT || 3000));
