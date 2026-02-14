const {
  PLAYER_SPEED,
  MAX_LIVES,
  GAME_WIDTH,
  GAME_HEIGHT,
  INVINCIBILITY_DURATION,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  ROUNDS_PER_MATCH,
} = require('./config');

const {
  resolveBarrierCollision,
  checkProjectileBarrierCollision,
  distance,
} = require('./collision');

function getSpawnPosition(map, isSecondPlayer) {
  const idx = isSecondPlayer ? 1 : 0;
  return {
    x: map.playerSpawnScale[idx][0] * GAME_WIDTH,
    y: map.playerSpawnScale[idx][1] * GAME_HEIGHT,
  };
}

class Game {
  constructor(id, io, maps) {
    this.id = id;
    this.io = io;
    this.players = new Map();
    this.projectiles = new Map();
    this.explosions = [];
    this.playerCount = 0;
    this.invinciblePlayers = new Map();

    // Shuffle maps for this game session
    this.maps = maps
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);

    this.currentRound = 1;
    this.currentMapIndex = 0;
  }

  get currentMap() {
    return this.maps[this.currentMapIndex];
  }

  // --- Player management ---

  addPlayer(id) {
    this.playerCount++;
    const isSecondPlayer = this.playerCount === 2;
    const spawn = getSpawnPosition(this.currentMap, isSecondPlayer);
    this.players.set(id, {
      id,
      x: spawn.x,
      y: spawn.y,
      lives: MAX_LIVES,
      score: 0,
      isSecondPlayer,
    });
  }

  removePlayer(id) {
    this.players.delete(id);
    this.playerCount--;
  }

  movePlayer(id, movement) {
    const player = this.players.get(id);
    if (!player) return;

    let newX = player.x + movement.x * PLAYER_SPEED;
    let newY = player.y + movement.y * PLAYER_SPEED;

    newX = Math.max(PLAYER_WIDTH / 2, Math.min(newX, GAME_WIDTH - PLAYER_WIDTH / 2));
    newY = Math.max(PLAYER_HEIGHT / 2, Math.min(newY, GAME_HEIGHT - PLAYER_HEIGHT / 2));

    const barriers = this.currentMap.barriers || [];
    const resolved = resolveBarrierCollision(player.x, player.y, newX, newY, barriers, PLAYER_WIDTH, PLAYER_HEIGHT);
    player.x = resolved.x;
    player.y = resolved.y;
  }

  // --- Projectile management ---

  addProjectile(id, path, playerId) {
    const player = this.players.get(playerId);
    const barriers = this.currentMap.barriers || [];
    let filteredPath = [];
    let hitBarrier = false;

    for (let i = 0; i < path.length; i++) {
      filteredPath.push(path[i]);
      if (i > 0 && checkProjectileBarrierCollision(path[i - 1], path[i], barriers)) {
        hitBarrier = true;
        break;
      }
    }

    const projectile = {
      id,
      path: filteredPath,
      index: 0,
      shooter_id: playerId,
      isSecondPlayer: player ? player.isSecondPlayer : false,
      hitBarrier,
    };

    this.projectiles.set(id, projectile);
    this.io.to(this.id).emit('newProjectile', projectile);
  }

  handleProjectileCollision(projectile1Id, projectile2Id, x, y) {
    this.projectiles.delete(projectile1Id);
    this.projectiles.delete(projectile2Id);
    this.explosions.push({ x, y });
  }

  updateProjectiles() {
    this.projectiles.forEach((proj, id) => {
      if (proj.index < proj.path.length - 1) {
        proj.index++;
        const point = proj.path[proj.index];
        proj.x = point.x;
        proj.y = point.y;

        if (proj.hitBarrier && proj.index === proj.path.length - 1) {
          this.explosions.push({ x: proj.x, y: proj.y });
          this.projectiles.delete(id);
        }
      } else {
        this.explosions.push({ x: proj.x, y: proj.y });
        this.projectiles.delete(id);
      }
    });
  }

  // --- Collision detection ---

  checkCollisions() {
    let pointScored = false;
    this.players.forEach(player => {
      if (this.invinciblePlayers.has(player.id)) return;

      this.projectiles.forEach((proj, id) => {
        if (player.id !== proj.shooter_id && distance(player, proj) < (PLAYER_WIDTH / 2)) {
          player.lives--;
          this.explosions.push({ x: proj.x, y: proj.y });
          this.projectiles.delete(id);
          this.io.to(player.id).emit('playerHit', { playerId: player.id });
          this.invinciblePlayers.set(player.id, Date.now() + INVINCIBILITY_DURATION);

          if (player.lives <= 0) {
            const otherPlayer = Array.from(this.players.values()).find(p => p.id !== player.id);
            if (otherPlayer) {
              otherPlayer.score++;
            }
            this.endRound();
            pointScored = true;
            this.projectiles.clear();
          }
        }
      });
    });

    if (pointScored) {
      this.io.to(this.id).emit('pointScored');
      this.io.to(this.id).emit('gameState', this.getState());
    }
  }

  // --- Invincibility ---

  updateInvincibility() {
    const now = Date.now();
    this.invinciblePlayers.forEach((endTime, playerId) => {
      if (now >= endTime) {
        this.invinciblePlayers.delete(playerId);
        this.io.to(playerId).emit('invincibilityEnded');
      }
    });
  }

  // --- Tick ---

  update() {
    this.updateProjectiles();
    this.checkCollisions();
    this.updateInvincibility();
  }

  // --- Match / round management ---

  endRound() {
    const isMatchOver = this.currentRound >= ROUNDS_PER_MATCH;

    if (!isMatchOver) {
      this.currentRound += 1;
      this.currentMapIndex = (this.currentMapIndex + 1) % this.maps.length;
      this.resetForNextRound();
      this.io.to(this.id).emit('roundEnded', {
        round: this.currentRound - 1,
        nextRound: this.currentRound,
        map: this.currentMap,
      });
      this.io.to(this.id).emit('mapSelected', {
        round: this.currentRound,
        map: this.currentMap,
      });
    } else {
      const players = Array.from(this.players.values());
      const winner = players.reduce((a, b) => (a.score >= b.score ? a : b));
      this.io.to(this.id).emit('matchEnded', {
        totalRounds: ROUNDS_PER_MATCH,
        winnerId: winner ? winner.id : null,
        scores: players.map(p => ({ id: p.id, score: p.score })),
      });
      this.currentRound = 1;
      this.currentMapIndex = 0;
      this.resetForNextRound(true);
      this.io.to(this.id).emit('mapSelected', {
        round: this.currentRound,
        map: this.currentMap,
      });
    }
  }

  resetForNextRound(resetScores = false) {
    this.players.forEach(player => {
      player.lives = MAX_LIVES;
      if (resetScores) player.score = 0;
      const spawn = getSpawnPosition(this.currentMap, player.isSecondPlayer);
      player.x = spawn.x;
      player.y = spawn.y;
    });
    this.projectiles.clear();
    this.invinciblePlayers.clear();
  }

  // --- State serialization ---

  getState() {
    const state = {
      players: Array.from(this.players.values()).map(player => ({
        ...player,
        isInvincible: this.invinciblePlayers.has(player.id),
      })),
      projectiles: Array.from(this.projectiles.values()).map(proj => ({
        id: proj.id,
        x: proj.x,
        y: proj.y,
        shooter_id: proj.shooter_id,
        isSecondPlayer: proj.isSecondPlayer,
      })),
      explosions: this.explosions,
      round: this.currentRound,
      map: this.currentMap,
    };
    this.explosions = [];
    return state;
  }
}

module.exports = Game;
