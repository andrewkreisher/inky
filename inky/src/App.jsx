import { useState, useEffect } from 'react';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { io } from 'socket.io-client';
import Home from './components/Home';
import Lobby from './components/Lobby';
import ReadyRoom from './components/ReadyRoom';
import Game from './components/Game';

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [readyRoomData, setReadyRoomData] = useState(null);

  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const newSocket = io(url, { transports: ['websocket'] });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <>
      <ColorModeScript />
      <ChakraProvider resetCSS>
        <div className="app">
          {currentScreen === 'home' && (
            <Home onJoinClick={() => setCurrentScreen('lobby')} />
          )}
          {currentScreen === 'lobby' && (
            <Lobby
              socket={socket}
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
            />
          )}
        </div>
      </ChakraProvider>
    </>
  );
}

export default App;
