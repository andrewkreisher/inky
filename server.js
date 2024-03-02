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

    // Add the new player to the players object
    players[socket.id] = {
        x: 200 + Object.keys(players).length * 100,
        y: 600,
        lives: 3,
    };

    console.log(players[socket.id]);

    

    // Send the list of players to the newly connected client
    socket.on('getCurrentPlayers', () => {
        socket.emit('currentPlayers', players);
    });

    // Update all other players about the new player
    socket.broadcast.emit('newPlayer', { id: socket.id, data: players[socket.id] });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);

        // Remove the player from the players object
        delete players[socket.id];
        
        delete games[socket.id];

        // Update all players about the disconnected player
        io.emit('playerDisconnected', socket.id);

    });

    socket.on('playerMovement', (movementData) => { 
        if (movementData.position.x) {
            players[movementData.id].x = movementData.position.x;
        }
        if (movementData.position.y) {
            players[movementData.id].y = movementData.position.y;
        }
        // Broadcast updated position to all other players
        socket.broadcast.emit('playerMoved', { id: socket.id, player: players[movementData.id]});
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
        console.log(id);
        if (!players[id]) {
            console.log("player does not exist: " + id)
            return;
        }
        players[id].lives -= 1;
        socket.broadcast.emit('playerHit', id);
        if (players[id].lives <= 0) {
            delete players[id];
            socket.broadcast.emit('playerDisconnected', id);
        }
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
    });

    // Additional handlers for player actions, etc.
});

server.listen(3000, () => console.log(`Server running on port 3000`));

