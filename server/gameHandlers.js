function registerGameHandlers(io, socket, deps) {
  const { activeGames, lobbyGames } = deps;

  socket.on('playerMovement', (data) => {
    const game = activeGames.get(data.gameId);
    if (game) {
      game.setPlayerInput(data.playerId, data.movement);
    }
  });

  socket.on('shootProjectile', (data) => {
    const game = activeGames.get(data.gameId);
    if (game) {
      const projectileId = data.playerId + Date.now();
      game.addProjectile(projectileId, data.path, data.playerId);
    }
  });

  socket.on('projectileCollision', (data) => {
    const game = activeGames.get(data.gameId);
    if (game) {
      game.handleProjectileCollision(data.projectile1Id, data.projectile2Id, data.x, data.y);
    }
  });

  socket.on('requestGameState', (gameId) => {
    const game = activeGames.get(gameId);
    if (game) {
      io.to(gameId).emit('mapSelected', { round: game.currentRound, map: game.currentMap });
      io.to(gameId).emit('gameState', game.getState());
    }
  });

  socket.on('requestRematch', (data) => {
    const game = activeGames.get(data.gameId);
    if (!game || !game.matchOver) return;

    const accepted = game.requestRematch(data.playerId);
    io.to(data.gameId).emit('rematchUpdate', { accepted, required: 2 });

    if (accepted >= 2) {
      game.startRematch();
      io.to(data.gameId).emit('rematchStarted', {
        round: game.currentRound,
        map: game.currentMap,
      });
      io.to(data.gameId).emit('gameState', game.getState());
    }
  });

  socket.on('leaveGame', (data) => {
    const game = activeGames.get(data.gameId);
    if (!game) return;

    socket.leave(data.gameId);
    game.removePlayer(socket.id);

    const remainingPlayer = game.players.keys().next().value;
    if (remainingPlayer) {
      io.to(remainingPlayer).emit('playerDisconnected', socket.id);
    }

    activeGames.delete(data.gameId);
    if (lobbyGames[data.gameId]) {
      delete lobbyGames[data.gameId];
    }
    io.emit('gameRemoved', data.gameId);
  });
}

function handleGameDisconnect(io, socket, deps) {
  const { activeGames, lobbyGames } = deps;

  activeGames.forEach((game, gameId) => {
    if (game.players.has(socket.id)) {
      game.removePlayer(socket.id);
      const remainingPlayer = game.players.keys().next().value;
      if (remainingPlayer) {
        io.to(remainingPlayer).emit('playerDisconnected', socket.id);
      }
      // Game can't continue with fewer than 2 players — clean up
      activeGames.delete(gameId);
      if (lobbyGames[gameId]) {
        delete lobbyGames[gameId];
      }
      io.emit('gameRemoved', gameId);
    }
  });
}

module.exports = { registerGameHandlers, handleGameDisconnect };
