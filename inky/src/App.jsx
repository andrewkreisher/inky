import { useState, useEffect } from 'react';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { io } from 'socket.io-client';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    return () => newSocket.close();
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
              onGameStart={(data) => {
                setGameData(data);
                setCurrentScreen('game');
              }}
            />
          )}
          {currentScreen === 'game' && (
            <Game 
              socket={socket}
              gameData={gameData}
              onGameEnd={() => setCurrentScreen('lobby')}
            />
          )}
        </div>
      </ChakraProvider>
    </>
  );
}

export default App; 