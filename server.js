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

let players = {}; // Object to store player data

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Add the new player to the players object
    players[socket.id] = {
        x: 200 + Object.keys(players).length * 100,
        y: 600,
        lives: 3,
    };

    

    // Send the list of players to the newly connected client
    socket.emit('currentPlayers', players);

    // Update all other players about the new player
    socket.broadcast.emit('newPlayer', { id: socket.id, data: players[socket.id] });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);

        // Remove the player from the players object
        delete players[socket.id];

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
        console.log(data);s
        socket.broadcast.emit('createProjectile', data);
    });

    // Additional handlers for player actions, etc.
});

server.listen(3000, () => console.log(`Server running on port 3000`));

