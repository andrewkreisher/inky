import { useState, useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { io } from 'socket.io-client';
import { theme } from './theme';
import Home from './components/Home';
import Lobby from './components/Lobby';
import ReadyRoom from './components/ReadyRoom';
import Game from './components/Game';
import LevelSelect from './components/LevelSelect';
import SinglePlayerGame from './components/SinglePlayerGame';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

function randomUsername() {
  return Math.random().toString(16).slice(2, 10);
}

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [readyRoomData, setReadyRoomData] = useState(null);
  const [username, setUsername] = useState(randomUsername);
  const [levelData, setLevelData] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    newSocket.on('connect', () => {
      newSocket.emit('registerUsername', username);
    });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
    // The socket lives for the whole session; username changes go through `changeUsername`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ChakraProvider theme={theme} resetCSS>
      {currentScreen === 'home' && (
        <Home
          onMultiplayerClick={() => setCurrentScreen('lobby')}
          onSinglePlayerClick={() => setCurrentScreen('levelSelect')}
        />
      )}
      {currentScreen === 'lobby' && (
        <Lobby
          socket={socket}
          username={username}
          onUsernameChange={setUsername}
          onBack={() => setCurrentScreen('home')}
          onEnterReadyRoom={(data) => {
            setReadyRoomData(data);
            setCurrentScreen('readyRoom');
          }}
        />
      )}
      {currentScreen === 'readyRoom' && (
        <ReadyRoom
          socket={socket}
          readyRoomData={readyRoomData}
          onGameStart={(data) => {
            setGameData(data);
            setCurrentScreen('game');
          }}
          onAbort={() => {
            setReadyRoomData(null);
            setCurrentScreen('lobby');
          }}
        />
      )}
      {currentScreen === 'game' && (
        <Game
          socket={socket}
          gameData={gameData}
          onReturnToLobby={() => {
            setGameData(null);
            setCurrentScreen('lobby');
          }}
        />
      )}
      {currentScreen === 'levelSelect' && (
        <LevelSelect
          onSelectLevel={(level) => {
            setLevelData(level);
            setCurrentScreen('singlePlayerGame');
          }}
          onBack={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'singlePlayerGame' && (
        <SinglePlayerGame
          levelData={levelData}
          onReturnHome={() => {
            setLevelData(null);
            setCurrentScreen('levelSelect');
          }}
        />
      )}
    </ChakraProvider>
  );
}

export default App;
