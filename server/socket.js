const Game = require('./Game');

function registerSocketHandlers(io, deps) {
  const { activeGames, games } = deps;

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('playerMovement', (data) => {
      const game = activeGames.get(data.gameId);
      if (game) {
        game.movePlayer(data.playerId, data.movement);
      }
    });

    socket.on('shootProjectile', (data) => {
      const game = activeGames.get(data.gameId);
      if (game) {
        const projectileId = data.playerId + Date.now();
        game.addProjectile(projectileId, data.path, data.playerId);
        // Emission handled by Game.addProjectile via room broadcast
      }
    });

    socket.on('projectileCollision', (data) => {
      const game = activeGames.get(data.gameId);
      if (game) {
        game.projectiles.delete(data.projectile1Id);
        game.projectiles.delete(data.projectile2Id);
        game.explosions.push({ x: data.x, y: data.y });
      }
    });

    socket.on('createGame', (playerId) => {
      if (Object.values(games).some(game => game.players.includes(playerId))) return;
      const gameId = Math.random().toString(36).substring(2, 15) +
                     Math.random().toString(36).substring(2, 15);
      games[gameId] = {
        id: gameId,
        players: [playerId],
        started: false,
        creator: playerId,
      };
      // join creator's socket to the game room if this socket owns the playerId
      if (socket.id === playerId) {
        socket.join(gameId);
      }
      io.emit('gameCreated', games[gameId]);
    });

    socket.on('currentGames', () => {
      socket.emit('currentGames', games);
    });

    socket.on('removeGame', (data) => {
      const game = games[data.gameId];
      if (game && game.creator === data.playerId) {
        delete games[data.gameId];
        io.emit('gameRemoved', data.gameId);
      }
    });

    socket.on('joinGame', (data) => {
      const game = games[data.gameId];
      if (!game || game.players.length >= 2) return;

      game.players.push(data.playerId);
      io.emit('gameJoined', game);

      // join this socket to the room
      socket.join(data.gameId);

      if (game.players.length === 2) {
        game.started = true;
        const newGame = new Game(data.gameId, io);
        game.players.forEach((pid, idx) => {
          newGame.addPlayer(pid, 250 + 600 * idx, 450);
        });
        activeGames.set(data.gameId, newGame);
        // Notify both players via the game room
        io.to(data.gameId).emit('startGame', game);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      Object.keys(games).forEach(gameId => {
        if (games[gameId] && games[gameId].creator === socket.id) {
          delete games[gameId];
          if (activeGames.has(gameId)) {
            activeGames.delete(gameId);
          }
          io.emit('gameRemoved', gameId);
        }
      });
      activeGames.forEach((game, gameId) => {
        if (game.players.has(socket.id)) {
          game.removePlayer(socket.id);
          const remainingPlayer = game.players.keys().next().value;
          if (remainingPlayer) {
            io.to(remainingPlayer).emit('playerDisconnected', socket.id);
          }
          if (game.playerCount === 0) {
            activeGames.delete(gameId);
            if (games[gameId]) {
              delete games[gameId];
            }
            io.emit('gameRemoved', gameId);
          }
        }
      });
    });
  });
}

module.exports = { registerSocketHandlers }; 