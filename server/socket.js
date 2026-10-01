import { registerLobbyHandlers, handleLobbyDisconnect, updateLobbyUsername } from './lobbyHandlers.js';
import { registerGameHandlers, handleGameDisconnect } from './gameHandlers.js';

export function registerSocketHandlers(io, deps) {
  const { connectedUsernames } = deps;

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    registerLobbyHandlers(io, socket, deps);
    registerGameHandlers(io, socket, deps);

    socket.on('registerUsername', (username) => {
      if (typeof username === 'string' && username.trim()) {
        connectedUsernames.set(socket.id, username.trim());
      }
    });

    socket.on('changeUsername', ({ newUsername } = {}, callback = () => {}) => {
      const trimmed = typeof newUsername === 'string' ? newUsername.trim() : '';
      if (!trimmed) {
        return callback({ success: false, error: 'Username cannot be empty' });
      }
      const taken = Array.from(connectedUsernames.entries()).some(
        ([id, name]) => id !== socket.id && name === trimmed
      );
      if (taken) {
        return callback({ success: false, error: 'Username already taken' });
      }
      connectedUsernames.set(socket.id, trimmed);
      updateLobbyUsername(io, socket, deps, trimmed);
      callback({ success: true });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      connectedUsernames.delete(socket.id);
      handleLobbyDisconnect(io, socket, deps);
      handleGameDisconnect(io, socket, deps);
    });
  });
}


