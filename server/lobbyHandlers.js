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
      ready: {},
    };

    if (socket.id === playerId) {
      socket.join(gameId);
    }
    io.emit('gameCreated', lobbyGames[gameId]);
    socket.emit('enterReadyRoom', lobbyGames[gameId]);
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
      game.ready = {
        [game.players[0]]: false,
        [game.players[1]]: false,
      };
      io.to(data.gameId).emit('enterReadyRoom', game);
    }
  });

  socket.on('playerReady', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started) return;
    if (!game.players.includes(data.playerId)) return;

    game.ready[data.playerId] = true;
    io.to(data.gameId).emit('readyStateUpdated', game.ready);

    if (Object.values(game.ready).every(Boolean)) {
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

  socket.on('playerUnready', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started) return;
    if (!game.players.includes(data.playerId)) return;

    game.ready[data.playerId] = false;
    io.to(data.gameId).emit('readyStateUpdated', game.ready);
  });

  socket.on('leaveReadyRoom', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started) return;

    socket.leave(data.gameId);
    io.to(data.gameId).emit('readyRoomAborted');

    // Remove the leaving player from the game
    game.players = game.players.filter(pid => pid !== data.playerId);
    game.ready = {};

    if (game.players.length === 0) {
      delete lobbyGames[data.gameId];
      io.emit('gameRemoved', data.gameId);
    } else {
      // If the creator left, the remaining player's game is cleaned up
      if (game.creator === data.playerId) {
        delete lobbyGames[data.gameId];
        io.emit('gameRemoved', data.gameId);
      } else {
        // Non-creator left, revert to 1-player lobby game
        io.emit('gameJoined', game);
      }
    }
  });
}

function handleLobbyDisconnect(io, socket, deps) {
  const { lobbyGames } = deps;

  Object.keys(lobbyGames).forEach(gameId => {
    const game = lobbyGames[gameId];
    if (!game) return;

    // If this player is in the game
    if (game.players.includes(socket.id)) {
      if (!game.started && game.players.length === 2) {
        // In ready room — abort for the other player
        socket.leave(gameId);
        io.to(gameId).emit('readyRoomAborted');

        game.players = game.players.filter(pid => pid !== socket.id);
        game.ready = {};

        if (game.creator === socket.id) {
          // Creator disconnected, remove the game entirely
          delete lobbyGames[gameId];
          io.emit('gameRemoved', gameId);
        } else {
          // Non-creator disconnected, revert to 1-player lobby
          io.emit('gameJoined', game);
        }
      } else if (game.creator === socket.id && !game.started) {
        // Solo creator disconnected from their unstarted game
        delete lobbyGames[gameId];
        io.emit('gameRemoved', gameId);
      }
    }
  });
}

module.exports = { registerLobbyHandlers, handleLobbyDisconnect };
