const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const GAME_TICK_RATE = 120;
const PLAYER_SPEED = 5;
const MAX_LIVES = 3;
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const INVINCIBILITY_DURATION = 2000; // 2 seconds of invincibility

const BARRIER = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    width: 100,
    height: 300
};

// Updated player dimensions for accurate collision
const PLAYER_WIDTH = 80;  
const PLAYER_HEIGHT = 80; 

class Game {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.projectiles = new Map();
        this.playerCount = 0;
        this.invinciblePlayers = new Map();
    }

    addPlayer(id, x, y) {
        this.playerCount++;
        const isSecondPlayer = this.playerCount === 2;
        this.players.set(id, { id, x, y, lives: MAX_LIVES, score: 0, isSecondPlayer: isSecondPlayer });
    }

    removePlayer(id) {
        this.players.delete(id);
        this.playerCount--;
    }

    movePlayer(id, movement) {
        const player = this.players.get(id);
        if (!player) return;

        // Calculate new position
        let newX = player.x + movement.x * PLAYER_SPEED;
        let newY = player.y + movement.y * PLAYER_SPEED;

        // First, clamp to game boundaries
        newX = Math.max(PLAYER_WIDTH/2, Math.min(newX, GAME_WIDTH - PLAYER_WIDTH/2));
        newY = Math.max(PLAYER_HEIGHT/2, Math.min(newY, GAME_HEIGHT - PLAYER_HEIGHT/2));

        // Check barrier collision and adjust position
        const barrierCollision = this.resolveBarrierCollision(
            player.x, player.y,  // Current position
            newX, newY,         // Desired position
            movement            // Movement direction
        );

        // Update player position with collision-adjusted coordinates
        player.x = barrierCollision.x;
        player.y = barrierCollision.y;
    }

    resolveBarrierCollision(currentX, currentY, desiredX, desiredY, movement) {
        // Define barrier edges
        const barrierLeft = BARRIER.x - BARRIER.width/2;
        const barrierRight = BARRIER.x + BARRIER.width/2;
        const barrierTop = BARRIER.y - BARRIER.height/2;
        const barrierBottom = BARRIER.y + BARRIER.height/2;

        // Define player edges at desired position
        const playerLeft = desiredX - PLAYER_WIDTH/2;
        const playerRight = desiredX + PLAYER_WIDTH/2;
        const playerTop = desiredY - PLAYER_HEIGHT/2;
        const playerBottom = desiredY + PLAYER_HEIGHT/2;

        // Check if the desired position would result in a collision
        const wouldCollide = !(
            playerRight < barrierLeft ||
            playerLeft > barrierRight ||
            playerBottom < barrierTop ||
            playerTop > barrierBottom
        );

        if (!wouldCollide) {
            // No collision, return desired position
            return { x: desiredX, y: desiredY };
        }

        // If there would be a collision, determine the appropriate position
        let adjustedX = currentX;
        let adjustedY = currentY;

        // Handle horizontal movement
        if (movement.x !== 0) {
            if (movement.x > 0) { // Moving right
                adjustedX = barrierLeft - PLAYER_WIDTH/2;
            } else { // Moving left
                adjustedX = barrierRight + PLAYER_WIDTH/2;
            }
            // Keep vertical position if only moving horizontally
            adjustedY = desiredY;
        }

        // Handle vertical movement
        if (movement.y !== 0) {
            if (movement.y > 0) { // Moving down
                adjustedY = barrierTop - PLAYER_HEIGHT/2;
            } else { // Moving up
                adjustedY = barrierBottom + PLAYER_HEIGHT/2;
            }
            // Keep horizontal position if only moving vertically
            adjustedX = desiredX;
        }

        // If moving diagonally, we need to check if the adjusted position is valid
        if (movement.x !== 0 && movement.y !== 0) {
            const adjustedPosition = this.checkDiagonalCollision(
                currentX, currentY,
                adjustedX, adjustedY,
                barrierLeft, barrierRight,
                barrierTop, barrierBottom
            );
            adjustedX = adjustedPosition.x;
            adjustedY = adjustedPosition.y;
        }

        return { x: adjustedX, y: adjustedY };
    }

    checkDiagonalCollision(currentX, currentY, adjustedX, adjustedY, barrierLeft, barrierRight, barrierTop, barrierBottom) {
        // Try horizontal movement first
        const horizontalAdjusted = {
            x: adjustedX,
            y: currentY
        };

        // Try vertical movement first
        const verticalAdjusted = {
            x: currentX,
            y: adjustedY
        };

        // Check which adjustment results in a valid position
        const horizontalValid = !this.checkBarrierCollision(horizontalAdjusted.x, horizontalAdjusted.y);
        const verticalValid = !this.checkBarrierCollision(verticalAdjusted.x, verticalAdjusted.y);

        if (horizontalValid) {
            return horizontalAdjusted;
        } else if (verticalValid) {
            return verticalAdjusted;
        }

        // If neither is valid, return current position
        return { x: currentX, y: currentY };
    }

    checkBarrierCollision(x, y) {
        const playerLeft = x - PLAYER_WIDTH/2;
        const playerRight = x + PLAYER_WIDTH/2;
        const playerTop = y - PLAYER_HEIGHT/2;
        const playerBottom = y + PLAYER_HEIGHT/2;

        const barrierLeft = BARRIER.x - BARRIER.width/2;
        const barrierRight = BARRIER.x + BARRIER.width/2;
        const barrierTop = BARRIER.y - BARRIER.height/2;
        const barrierBottom = BARRIER.y + BARRIER.height/2;

        return !(
            playerRight < barrierLeft ||
            playerLeft > barrierRight ||
            playerBottom < barrierTop ||
            playerTop > barrierBottom
        );
    }

    addProjectile(id, path, playerId) {
        const player = this.players.get(playerId);
        let filteredPath = [];
        let hitBarrier = false;

        // Process path points sequentially
        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            filteredPath.push(point);

            if (i > 0) {
                const prevPoint = path[i - 1];
                // Check if line segment intersects barrier
                if (this.checkProjectileBarrierCollision(prevPoint, point)) {
                    hitBarrier = true;
                    break;
                }
            }
        }

        this.projectiles.set(id, { 
            id, 
            path: filteredPath, 
            index: 0, 
            shooter_id: playerId,
            isSecondPlayer: player ? player.isSecondPlayer : false,
            hitBarrier: hitBarrier
        });
    }

    checkProjectileBarrierCollision(point1, point2) {
        const barrierLeft = BARRIER.x - BARRIER.width/2;
        const barrierRight = BARRIER.x + BARRIER.width/2;
        const barrierTop = BARRIER.y - BARRIER.height/2;
        const barrierBottom = BARRIER.y + BARRIER.height/2;

        // Line segment intersection with rectangle using Cohen-Sutherland algorithm
        const outcode = (x, y) => {
            let code = 0;
            if (x < barrierLeft) code |= 1;     // Left
            else if (x > barrierRight) code |= 2;  // Right
            if (y < barrierTop) code |= 4;      // Top
            else if (y > barrierBottom) code |= 8;   // Bottom
            return code;
        };

        let code1 = outcode(point1.x, point1.y);
        let code2 = outcode(point2.x, point2.y);

        // If both points are outside the same region, no intersection
        if ((code1 & code2) !== 0) return false;

        // If both points are inside, potential intersection
        if (code1 === 0 && code2 === 0) {
            return true;
        }

        // Check if line intersects with any of the barrier edges
        const intersectsLine = (x1, y1, x2, y2, x3, y3, x4, y4) => {
            const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
            if (denominator === 0) return false;

            const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
            const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

            return t >= 0 && t <= 1 && u >= 0 && u <= 1;
        };

        // Check intersection with all four edges of the barrier
        return (
            intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierLeft, barrierTop, barrierRight, barrierTop) ||    // Top
            intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierRight, barrierTop, barrierRight, barrierBottom) || // Right
            intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierRight, barrierBottom, barrierLeft, barrierBottom) || // Bottom
            intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierLeft, barrierBottom, barrierLeft, barrierTop)    // Left
        );
    }

    updateProjectiles() {
        this.projectiles.forEach((proj, id) => {
            if (proj.index < proj.path.length - 1) {
                proj.index++;
                const point = proj.path[proj.index];
                proj.x = point.x;
                proj.y = point.y;

                // If projectile has hit the barrier, remove it
                if (proj.hitBarrier && proj.index === proj.path.length - 1) {
                    this.projectiles.delete(id);
                }
            } else {
                this.projectiles.delete(id);
            }
        });
    }

    update() {
        this.updateProjectiles();
        this.checkCollisions();
        this.updateInvincibility();
    }

    checkCollisions() {
        let pointScored = false;
        this.players.forEach(player => {
            if (this.invinciblePlayers.has(player.id)) return; // Skip invincible players

            this.projectiles.forEach((proj, id) => {
                if (player.id !== proj.shooter_id && this.distance(player, proj) < (PLAYER_WIDTH / 2)) { // Adjust collision radius as needed
                    player.lives--;
                    this.projectiles.delete(id);
                    io.to(player.id).emit('playerHit', { playerId: player.id });
                    
                    // Set player as invincible
                    this.invinciblePlayers.set(player.id, Date.now() + INVINCIBILITY_DURATION);

                    if (player.lives <= 0) {
                        const otherPlayer = Array.from(this.players.values()).find(p => p.id !== player.id);
                        if (otherPlayer) {
                            otherPlayer.score++;
                        }
                        this.resetGame();
                        pointScored = true;
                        // Clear all projectiles when a point is scored
                        this.projectiles.clear();
                    }
                }
            });
        });

        if (pointScored) {
            this.players.forEach(p => {
                io.to(p.id).emit('pointScored');
                const gameState = this.getState();
                io.to(this.id).emit('gameState', gameState);
            });
        }
    }

    resetGame() {
        this.players.forEach(player => {
            player.lives = MAX_LIVES;
            player.x = player.isSecondPlayer ? GAME_WIDTH * 0.75 : GAME_WIDTH * 0.25;
            player.y = GAME_HEIGHT * 0.5;
        });
        this.projectiles.clear();
        this.invinciblePlayers.clear(); // Clear invincibility status
    }

    updateInvincibility() {
        const now = Date.now();
        this.invinciblePlayers.forEach((endTime, playerId) => {
            if (now >= endTime) {
                this.invinciblePlayers.delete(playerId);
                io.to(playerId).emit('invincibilityEnded');
            }
        });
    }

    distance(obj1, obj2) {
        return Math.sqrt(Math.pow(obj1.x - obj2.x, 2) + Math.pow(obj1.y - obj2.y, 2));
    }

    getState() {
        return {
            players: Array.from(this.players.values()).map(player => ({
                ...player,
                isInvincible: this.invinciblePlayers.has(player.id)
            })),
            projectiles: Array.from(this.projectiles.values()).map(proj => ({
                id: proj.id,
                x: proj.x,
                y: proj.y,
                shooter_id: proj.shooter_id,
                isSecondPlayer: proj.isSecondPlayer
            })),
            score: this.players // You might want to adjust this based on your scoring system
        };
    }
}

const activeGames = new Map();

function generateGameId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

let games = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('setPlayerId', (playerId) => {
        socket.playerId = playerId;
    });

    socket.on('setGameDimensions', (data) => {
        const { gameId, width, height } = data;
        const game = activeGames.get(gameId);
        if (game) {
            game.setDimensions(width, height);
        }
    });

    socket.on('playerMovement', (data) => {
        const gameId = data.gameId;
        const playerId = data.playerId;
        const movement = data.movement;
        const game = activeGames.get(gameId);
        if (game) {
            game.movePlayer(playerId, movement);
        }
    });
    
    socket.on('shootProjectile', (data) => {
        const gameId = data.gameId;
        const playerId = data.playerId;
        const path = data.path;
        const game = activeGames.get(gameId);

        if (game) {
            console.log('shooting projectile:', playerId, path);
            const projectileId = playerId + Date.now();
            game.addProjectile(projectileId, path, playerId);
            
            // Emit the new projectile to all players
            const projectile = game.projectiles.get(projectileId);
            io.to(gameId).emit('newProjectile', projectile);
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
            let idx = 0; 
            games[gameId].players.forEach(pid => {
                newGame.addPlayer(pid, 250 + 600 * idx, 450);
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