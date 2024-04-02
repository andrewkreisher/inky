const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",  // Adjust this to be more restrictive as needed
        methods: ["GET", "POST"]
    }
});

let games = {}; // Object to store game data
let players = {}; // Object to store player data

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);


    // Update all other players about the new player
    // socket.broadcast.emit('newPlayer', { id: socket.id, data: players[socket.id] });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);

        // Remove the player from the players object
        delete players[socket.id];
        
        delete games[socket.id];

        // Update all players about the disconnected player
        io.emit('playerDisconnected', socket.id);

    });

    socket.on('playerMovement', (movementData) => { 
        const gameId = getGameIdForPlayer(movementData.id);
        const game = games[gameId];
        const playerData = game.playerData.find(player => player.id === movementData.id);
        if (movementData.position.x) {
           playerData.x = movementData.position.x;
        }
        if (movementData.position.y) {
            playerData.y = movementData.position.y;
        }
        // Broadcast updated position to all other players
        socket.broadcast.emit('playerMoved', { id: movementData.id, player: playerData});
    });

    socket.on('projectileShot', (data) => {
        socket.broadcast.emit('createProjectile', data);
    });

    socket.on('createGame', (id) => {
        if (games[id]) {
            console.log("game already exists: " + games[id].id)
            return;
        }
        games[id] = {
            players: [id],
            started: false,
            id: id, 
        };
        console.log("created game: " + games[id].id)
        socket.emit('gameCreated', games[id]);
        socket.broadcast.emit('gameCreated', games[id]);
    });

    socket.on('currentGames', () => {
        console.log(games);
        socket.emit('currentGames', games);
    });

    socket.on('removeGame', (id) => {
        if (!games[id]) {
            console.log("game does not exist: " + id)
            return;
        }
        console.log("removed game: " + games[id].id)
        delete games[id];
        // socket.emit('gameRemoved', id);
        socket.broadcast.emit('gameRemoved', id);
    });


    socket.on('playerHit', (id) => {
        console.log(games.si)
        console.log(getGameIdForPlayer(id))
        console.log(id);
        const player = games[getGameIdForPlayer(id)].playerData.find(player => player.id === id);
        if (!player) {
            console.log("player does not exist: " + id)
            return;
        }
        player.lives -= 1;
        socket.broadcast.emit('playerHit', id);
        socket.emit('playerHit', id);
    });

    socket.on('joinGame', (idData) => {
        if (!games[idData.gameId]) {
            console.log("game does not exist: " + idData.gameId)
            return;
        }
        if (games[idData.gameId].players.length >= 2) {
            console.log("game is full: " + idData.gameId)
            return;
        }
        console.log("player:" + idData.id +  " joined game: " + idData.gameId)
        games[idData.gameId].players.push(idData.id);
        socket.emit('gameJoined', games[idData.gameId]);
        socket.broadcast.emit('gameJoined', games[idData.gameId]);

        games[idData.gameId].started = true;
        let playerData = []; 
        for (let i = 0; i < games[idData.gameId].players.length; i++) {
            playerData.push({
                x: 200 + 400 * i,
                y: 600,
                lives: 3,
                id: games[idData.gameId].players[i],
            });
        }
        games[idData.gameId].playerData = playerData;

        socket.emit('startGame', games[idData.gameId]);
        socket.broadcast.emit('startGame', games[idData.gameId]);

    });

    socket.on('getCurrentGame', (playerId) => {
        console.log(playerId, games)
        let id = Object.keys(games).find(key => games[key].players.includes(playerId));
        if (!id) {
            console.log("game does not exist: " + id)
            return;
        }
        socket.emit('currentGame', games[id]);
    });

    // Additional handlers for player actions, etc.
});

// Get game id that player id is in
function getGameIdForPlayer(playerId) {
    console.log(Object.keys(games));
    return Object.keys(games).find(key => games[key].players.includes(playerId));
}

server.listen(3000, () => console.log(`Server running on port 3000`));

