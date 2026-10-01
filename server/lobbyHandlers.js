/**
 * Lobby socket handlers: room create/join/remove/list and the ready room.
 * Player identity is always `socket.id`; client-supplied playerId fields are ignored.
 */
import { Game } from './Game.js';
import { MAPS as maps } from '../shared/maps.js';
import { normalizeMatchOptions } from '../shared/matchOptions.js';

function generateGameId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

function displayName(username, socketId) {
  return username || socketId.slice(0, 8);
}

/** Drop a player from a lobby room and notify everyone appropriately. */
function removePlayerFromLobbyGame(io, socket, game, deps) {
  const { lobbyGames } = deps;
  const wasFull = game.players.length === 2;

  socket.leave(game.id);
  if (wasFull) {
    io.to(game.id).emit('readyRoomAborted');
  }

  game.players = game.players.filter(pid => pid !== socket.id);
  delete game.usernames[socket.id];
  game.ready = {};

  if (game.players.length === 0 || game.creator === socket.id) {
    // Empty room, or the host left: the room is gone.
    delete lobbyGames[game.id];
    io.emit('gameRemoved', game.id);
  } else {
    // Guest left: room reverts to a 1-player lobby entry.
    io.emit('gameJoined', game);
  }
}

function startGame(io, game, deps) {
  const { activeGames } = deps;
  game.started = true;

  const newGame = new Game(game.id, io, maps, game.options);
  newGame.setUsernames(game.usernames);
  game.players.forEach(pid => newGame.addPlayer(pid));
  activeGames.set(game.id, newGame);

  io.to(game.id).emit('startGame', game);
  io.to(game.id).emit('mapSelected', { round: newGame.currentRound, map: newGame.currentMap });
  io.to(game.id).emit('gameState', newGame.getState());
  newGame.startCountdown();

  // Started rooms are no longer joinable; drop them from lobby lists.
  io.emit('gameRemoved', game.id);
}

export function registerLobbyHandlers(io, socket, deps) {
  const { lobbyGames } = deps;
  const playerId = socket.id;

  socket.on('createGame', (data = {}) => {
    if (Object.values(lobbyGames).some(game => game.players.includes(playerId))) return;

    const gameId = generateGameId();
    const game = {
      id: gameId,
      players: [playerId],
      started: false,
      creator: playerId,
      ready: {},
      usernames: { [playerId]: displayName(data.username, playerId) },
      options: normalizeMatchOptions(data.options),
    };
    lobbyGames[gameId] = game;

    socket.join(gameId);
    io.emit('gameCreated', game);
    socket.emit('enterReadyRoom', game);
  });

  socket.on('currentGames', () => {
    const openGames = {};
    Object.values(lobbyGames).forEach(game => {
      if (!game.started) openGames[game.id] = game;
    });
    socket.emit('currentGames', openGames);
  });

  socket.on('removeGame', (data) => {
    const game = lobbyGames[data.gameId];
    if (game && game.creator === playerId && !game.started) {
      delete lobbyGames[data.gameId];
      io.emit('gameRemoved', data.gameId);
    }
  });

  socket.on('joinGame', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started || game.players.length >= 2) return;
    if (game.players.includes(playerId)) return;

    game.players.push(playerId);
    game.usernames[playerId] = displayName(data.username, playerId);
    socket.join(data.gameId);
    io.emit('gameJoined', game);

    if (game.players.length === 2) {
      game.ready = Object.fromEntries(game.players.map(pid => [pid, false]));
      io.to(data.gameId).emit('enterReadyRoom', game);
    }
  });

  socket.on('playerReady', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started || !game.players.includes(playerId)) return;

    game.ready[playerId] = true;
    io.to(data.gameId).emit('readyStateUpdated', game.ready);

    const everyoneReady = game.players.length === 2 && game.players.every(pid => game.ready[pid]);
    if (everyoneReady) {
      startGame(io, game, deps);
    }
  });

  socket.on('playerUnready', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started || !game.players.includes(playerId)) return;

    game.ready[playerId] = false;
    io.to(data.gameId).emit('readyStateUpdated', game.ready);
  });

  socket.on('leaveReadyRoom', (data) => {
    const game = lobbyGames[data.gameId];
    if (!game || game.started || !game.players.includes(playerId)) return;
    removePlayerFromLobbyGame(io, socket, game, deps);
  });
}

export function handleLobbyDisconnect(io, socket, deps) {
  Object.values(deps.lobbyGames).forEach(game => {
    if (!game.started && game.players.includes(socket.id)) {
      removePlayerFromLobbyGame(io, socket, game, deps);
    }
  });
}

/** Keep lobby room name lists in sync when a player renames themselves. */
export function updateLobbyUsername(io, socket, deps, newUsername) {
  Object.values(deps.lobbyGames).forEach(game => {
    if (game.players.includes(socket.id)) {
      game.usernames[socket.id] = newUsername;
      io.emit('gameJoined', game);
    }
  });
}


