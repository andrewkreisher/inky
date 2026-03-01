const { registerLobbyHandlers, handleLobbyDisconnect } = require('./lobbyHandlers');
const { registerGameHandlers, handleGameDisconnect } = require('./gameHandlers');

function registerSocketHandlers(io, deps) {
  const { connectedUsernames } = deps;

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    registerLobbyHandlers(io, socket, deps);
    registerGameHandlers(io, socket, deps);

    socket.on('registerUsername', (username) => {
      connectedUsernames.set(socket.id, username);
    });

    socket.on('changeUsername', ({ newUsername }, callback) => {
      const taken = Array.from(connectedUsernames.entries()).some(
        ([id, name]) => id !== socket.id && name === newUsername
      );
      if (taken) {
        callback({ success: false, error: 'Username already taken' });
      } else {
        connectedUsernames.set(socket.id, newUsername);
        callback({ success: true });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      connectedUsernames.delete(socket.id);
      handleLobbyDisconnect(io, socket, deps);
      handleGameDisconnect(io, socket, deps);
    });
  });
}

module.exports = { registerSocketHandlers };
