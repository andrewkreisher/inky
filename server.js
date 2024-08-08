const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const GAME_TICK_RATE = 60;
const PLAYER_SPEED = 5;
const MAX_LIVES = 3;

class Game {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.projectiles = new Map();
        this.score = 0;
    }

    addPlayer(id, x, y) {
        this.players.set(id, { id, x, y, lives: MAX_LIVES });
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    movePlayer(id, movement) {
        const player = this.players.get(id);
        if (player) {
            player.x += movement.x * PLAYER_SPEED;
            player.y += movement.y * PLAYER_SPEED;
            player.x = Math.max(0, Math.min(player.x, 1200));
            player.y = Math.max(0, Math.min(player.y, 900));
        }
    }

    addProjectile(id, path) {
        this.projectiles.set(id, { id, path, index: 0 });
    }

    update() {
        this.updateProjectiles();
        this.checkCollisions();
    }

    updateProjectiles() {
        this.projectiles.forEach((proj, id) => {
            if (proj.index < proj.path.length - 1) {
                proj.index++;
                const point = proj.path[proj.index];
                proj.x = point.x;
                proj.y = point.y;
            } else {
                this.projectiles.delete(id);
            }
        });
    }

    checkCollisions() {
        this.players.forEach(player => {
            this.projectiles.forEach((proj, id) => {
                if (this.distance(player, proj) < 30) {
                    player.lives--;
                    this.projectiles.delete(id);
                    if (player.lives <= 0) {
                        this.score++;
                        player.lives = MAX_LIVES;
                        player.x = Math.random() * 1200;
                        player.y = Math.random() * 900;
                    }
                }
            });
        });
    }

    distance(obj1, obj2) {
        return Math.sqrt(Math.pow(obj1.x - obj2.x, 2) + Math.pow(obj1.y - obj2.y, 2));
    }

    getState() {
        return {
            players: Array.from(this.players.values()),
            projectiles: Array.from(this.projectiles.values()),
            score: this.score,
        };
    }
}

const activeGames = new Map();


function generateGameId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

let games = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('setPlayerId', (playerId) => {
        socket.playerId = playerId;
    });

    socket.on('playerMovement', (data) => {
        console.log('player movement, data:', data);
        const gameId = data.gameId;
        const playerId = data.playerId;
        const movement = data.movement;
        const game = activeGames.get(gameId);
        if (game) {
            game.movePlayer(playerId, movement);
             console.log('player location:', game.players.get(playerId));
        }
    });
    
    socket.on('shootProjectile', (data) => {
        const { gameId, playerId, path } = data;
        const game = activeGames.get(gameId);
        if (game) {
            const projectileId = playerId + Date.now();
            game.addProjectile(projectileId, path);
        }
    });

    socket.on('createGame', (playerId) => {
        if (Object.values(games).some(game => game.players.includes(playerId))) return;
        const gameId = generateGameId();
        games[gameId] = {
            id: gameId,
            players: [playerId],
            started: false,
            creator: playerId,
        };
        console.log("Created game:", games[gameId]);
        io.emit('gameCreated', games[gameId]);
    });

    socket.on('currentGames', () => {
        console.log("Sending current games:", games);
        socket.emit('currentGames', games);
    });

    socket.on('removeGame', (data) => {
        const gameId = data.gameId; 
        const playerId = data.playerId;
        console.log("Removing game:", gameId);
        if (!games[gameId]) return;
        const game = games[gameId]; 
        if (game.creator !== playerId) return;
        delete games[gameId];
        console.log("Removed game:", gameId);
        io.emit('gameRemoved', gameId);
    });

    socket.on('joinGame', (data) => {
        const { gameId, playerId } = data;
        if (!games[gameId] || games[gameId].players.length >= 2) return;
        
        games[gameId].players.push(playerId);
        console.log("Player joined game:", gameId, playerId);
        io.emit('gameJoined', games[gameId]);
    
        if (games[gameId].players.length === 2) {
            games[gameId].started = true;
            console.log(`Starting game ${gameId}`);
            
            // Create a new Game instance and add it to activeGames
            const newGame = new Game(gameId);
            var idx = 0; 
            games[gameId].players.forEach(pid => {
                newGame.addPlayer(pid, 600 + 400 * idx, 450);
                idx++;
            });
            activeGames.set(gameId, newGame);
    
            // Emit startGame event to both players individually
            games[gameId].players.forEach(pid => {
                io.to(pid).emit('startGame', games[gameId]);
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove any games created by this user
        Object.keys(games).forEach(gameId => {
            if (games[gameId].creator === socket.id) {
                delete games[gameId];
                activeGames.delete(gameId);
                io.emit('gameRemoved', gameId);
            }
        });
        // Remove player from any active game they're in
        activeGames.forEach((game, gameId) => {
            if (game.players.has(socket.id)) {
                game.removePlayer(socket.id);
                if (game.players.size === 0) {
                    activeGames.delete(gameId);
                    delete games[gameId];
                    io.emit('gameRemoved', gameId);
                }
            }
        });
    });
});


setInterval(() => {
    activeGames.forEach((game, gameId) => {
        game.update();
        const gameState = game.getState();
        games[gameId].players.forEach(playerId => {
            io.to(playerId).emit('gameState', gameState);
        });
    });
}, 1000 / GAME_TICK_RATE);

server.listen(3000, () => console.log('Server running on port 3000'));