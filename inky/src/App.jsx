import { useState, useEffect } from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { io } from 'socket.io-client';
import Home from './components/Home';
import Lobby from './components/Lobby';
import ReadyRoom from './components/ReadyRoom';
import Game from './components/Game';
import LevelSelect from './components/LevelSelect';
import SinglePlayerGame from './components/SinglePlayerGame';

const theme = extendTheme({
  fonts: {
    heading: '"Silkscreen", monospace',
    body: '"Silkscreen", monospace',
  },
  styles: {
    global: {
      body: {
        bg: '#0F0A1A',
        color: '#E8DCC8',
      },
    },
  },
  colors: {
    retro: {
      bg: '#0F0A1A',
      panel: '#1A1230',
      panelHover: '#221845',
      border: '#4A3870',
      borderDark: '#0A0612',
      text: '#E8DCC8',
      muted: '#8878A8',
      teal: '#5BA8A8',
      magenta: '#B068A8',
      green: '#68A878',
      coral: '#C87068',
      amber: '#C8A868',
    },
  },
});

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [readyRoomData, setReadyRoomData] = useState(null);
  const [username, setUsername] = useState(() => Math.random().toString(16).slice(2, 10));
  const [levelData, setLevelData] = useState(null);

  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const newSocket = io(url, { transports: ['websocket'] });
    newSocket.on('connect', () => {
      newSocket.emit('registerUsername', username);
    });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <ChakraProvider theme={theme} resetCSS>
      <div className="app">
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
            username={username}
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
            username={username}
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
      </div>
    </ChakraProvider>
  );
}

export default App;
