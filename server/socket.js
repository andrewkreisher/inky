const { registerLobbyHandlers, handleLobbyDisconnect } = require('./lobbyHandlers');
const { registerGameHandlers, handleGameDisconnect } = require('./gameHandlers');

function registerSocketHandlers(io, deps) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    registerLobbyHandlers(io, socket, deps);
    registerGameHandlers(io, socket, deps);

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      handleLobbyDisconnect(io, socket, deps);
      handleGameDisconnect(io, socket, deps);
    });
  });
}

module.exports = { registerSocketHandlers };
