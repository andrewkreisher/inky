/**
 * Gameplay socket handlers. Player identity is always `socket.id` —
 * client-supplied playerId fields are ignored so they can't be spoofed.
 */

function teardownGame(io, gameId, deps) {
  const { activeGames, lobbyGames } = deps;
  const game = activeGames.get(gameId);
  if (game) game.destroy();
  activeGames.delete(gameId);
  delete lobbyGames[gameId];
  io.emit('gameRemoved', gameId);
}

/** Remove a player from a live game; the opponent is notified and the game is torn down. */
function removePlayerFromGame(io, socket, game, deps) {
  game.removePlayer(socket.id);
  socket.leave(game.id);

  const remainingPlayer = game.players.keys().next().value;
  if (remainingPlayer) {
    io.to(remainingPlayer).emit('playerDisconnected', socket.id);
  }

  teardownGame(io, game.id, deps);
}

export function registerGameHandlers(io, socket, deps) {
  const { activeGames } = deps;

  const gameFor = (data) => (data && activeGames.get(data.gameId)) || null;

  /** Batched movement steps: `{ gameId, inputs: [{ seq, x, y }, ...] }`. */
  socket.on('playerInput', (data) => {
    const game = gameFor(data);
    if (game) game.queueInputs(socket.id, data.inputs);
  });

  /** Ink regen pauses while the player is drawing. */
  socket.on('drawingState', (data) => {
    const game = gameFor(data);
    if (game) game.setDrawing(socket.id, data.drawing);
  });

  socket.on('shootProjectile', (data) => {
    const game = gameFor(data);
    if (!game) return;
    const rejection = game.addProjectile(data.path, socket.id);
    if (rejection) socket.emit('shotRejected', { reason: rejection });
  });

  socket.on('requestGameState', (gameId) => {
    const game = activeGames.get(gameId);
    if (game) {
      socket.emit('mapSelected', { round: game.currentRound, map: game.currentMap });
      socket.emit('gameState', game.getState());
    }
  });

  socket.on('requestRematch', (data) => {
    const game = gameFor(data);
    if (!game || !game.matchOver) return;

    const accepted = game.requestRematch(socket.id);
    io.to(game.id).emit('rematchUpdate', { accepted, required: 2 });

    if (accepted >= 2) {
      game.startRematch();
      io.to(game.id).emit('rematchStarted', { round: game.currentRound, map: game.currentMap });
      io.to(game.id).emit('gameState', game.getState());
    }
  });

  socket.on('leaveGame', (data) => {
    const game = gameFor(data);
    if (!game || !game.players.has(socket.id)) return;
    removePlayerFromGame(io, socket, game, deps);
  });
}

export function handleGameDisconnect(io, socket, deps) {
  deps.activeGames.forEach((game) => {
    if (game.players.has(socket.id)) {
      removePlayerFromGame(io, socket, game, deps);
    }
  });
}
