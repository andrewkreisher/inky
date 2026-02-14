const Game = require('./Game');
const maps = require('./maps');

function registerLobbyHandlers(io, socket, deps) {
  const { activeGames, lobbyGames } = deps;

  socket.on('createGame', (playerId) => {
    if (Object.values(lobbyGames).some(game => game.players.includes(playerId))) return;

    const gameId = Math.random().toString(36).substring(2, 15) +
                   Math.random().toString(36).substring(2, 15);
    lobbyGames[gameId] = {
      id: gameId,
      players: [playerId],
      started: false,
      creator: playerId,
    };

    if (socket.id === playerId) {
      socket.join(gameId);
    }
    io.emit('gameCreated', lobbyGames[gameId]);
  });

  socket.on('currentGames', () => {
    socket.emit('currentGames', lobbyGames);
  });

  socket.on('removeGame', (data) => {
    const game = lobbyGames[data.gameId];
    if (game && game.creator === data.playerId) {
      delete lobbyGames[data.gameId];
      io.emit('gameRemoved', data.gameId);
    }
  });

  socket.on('joinGame', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.players.length >= 2) return;

    game.players.push(data.playerId);
    io.emit('gameJoined', game);

    socket.join(data.gameId);

    if (game.players.length === 2) {
      game.started = true;
      const newGame = new Game(data.gameId, io, maps);
      game.players.forEach((pid) => {
        newGame.addPlayer(pid);
      });
      activeGames.set(data.gameId, newGame);
      io.to(data.gameId).emit('startGame', game);
      io.to(data.gameId).emit('mapSelected', { round: newGame.currentRound, map: newGame.currentMap });
      io.to(data.gameId).emit('gameState', newGame.getState());
    }
  });
}

function handleLobbyDisconnect(io, socket, deps) {
  const { lobbyGames } = deps;

  // Only clean up unstarted lobby rooms created by this player.
  // Started games are handled by handleGameDisconnect.
  Object.keys(lobbyGames).forEach(gameId => {
    const game = lobbyGames[gameId];
    if (game && game.creator === socket.id && !game.started) {
      delete lobbyGames[gameId];
      io.emit('gameRemoved', gameId);
    }
  });
}

module.exports = { registerLobbyHandlers, handleLobbyDisconnect };
