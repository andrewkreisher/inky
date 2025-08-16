const {
  GAME_TICK_RATE,
  PLAYER_SPEED,
  MAX_LIVES,
  GAME_WIDTH,
  GAME_HEIGHT,
  INVINCIBILITY_DURATION,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  BARRIER,
  ROUNDS_PER_MATCH,
} = require('./config');

class Game {
  constructor(id, io, maps) {
    this.id = id;
    this.io = io;
    this.players = new Map();
    this.projectiles = new Map();
    this.explosions = [];
    this.playerCount = 0;
    this.invinciblePlayers = new Map();

    // Match / maps
    this.maps = maps.map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
    console.log("randomized maps", this.maps)
    this.maps = this.maps.length > 0 ? this.maps : [
      { id: 'legacy', name: 'Legacy', barriers: [BARRIER] },
    ];
    this.currentRound = 1;
    this.currentMapIndex = 0;
    console.log(`[game ${this.id}] init: rounds=${ROUNDS_PER_MATCH}, maps=${this.maps.length}, currentMap=${this.currentMap.id}`);
  }

  get currentMap() {
    // Guard: if maps were somehow emptied at runtime
    if (!this.maps || this.maps.length === 0) {
      return { id: 'legacy', name: 'Legacy', barriers: [BARRIER] };
    }
    return this.maps[this.currentMapIndex];
  }

  addPlayer(id) {
    this.playerCount++;
    const isSecondPlayer = this.playerCount === 2;
    this.players.set(id, { id, x: this.currentMap.playerSpawnScale[isSecondPlayer ? 1 : 0][0] * GAME_WIDTH, y: this.currentMap.playerSpawnScale[isSecondPlayer ? 1 : 0][1] * GAME_HEIGHT, lives: MAX_LIVES, score: 0, isSecondPlayer });
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

    const barrierCollision = this.resolveBarrierCollision(player.x, player.y, newX, newY);
    player.x = barrierCollision.x;
    player.y = barrierCollision.y;
  }

  resolveBarrierCollision(currentX, currentY, desiredX, desiredY) {
    // Iterate over all obstacles on current map (barriers + nets block players)
    const obstacles = [
      ...(this.currentMap.barriers || []),
      ...(this.currentMap.nets || []),
    ];

    let adjustedX = desiredX;
    let adjustedY = desiredY;

    for (const barrier of obstacles) {
      const barrierLeft = barrier.x - barrier.width / 2;
      const barrierRight = barrier.x + barrier.width / 2;
      const barrierTop = barrier.y - barrier.height / 2;
      const barrierBottom = barrier.y + barrier.height / 2;

      const playerLeft = adjustedX - PLAYER_WIDTH / 2;
      const playerRight = adjustedX + PLAYER_WIDTH / 2;
      const playerTop = adjustedY - PLAYER_HEIGHT / 2;
      const playerBottom = adjustedY + PLAYER_HEIGHT / 2;

      const colliding = !(
        playerRight <= barrierLeft ||
        playerLeft >= barrierRight ||
        playerBottom <= barrierTop ||
        playerTop >= barrierBottom
      );

      if (!colliding) {
        continue;
      }

      let overlapX = 0;
      const penetrationRight = playerRight - barrierLeft;
      const penetrationLeft = barrierRight - playerLeft;
      if (penetrationRight > 0 && penetrationLeft > 0) {
        overlapX = (penetrationRight < penetrationLeft) ? -penetrationRight : penetrationLeft;
      }

      let overlapY = 0;
      const penetrationBottom = playerBottom - barrierTop;
      const penetrationTop = barrierBottom - playerTop;
      if (penetrationBottom > 0 && penetrationTop > 0) {
        overlapY = (penetrationBottom < penetrationTop) ? -penetrationBottom : penetrationTop;
      }

      if (overlapX === 0 && overlapY === 0) {
        adjustedX = currentX;
        adjustedY = currentY;
        continue;
      }

      if (Math.abs(overlapX) < Math.abs(overlapY)) {
        adjustedX += overlapX;
      } else if (Math.abs(overlapY) < Math.abs(overlapX)) {
        adjustedY += overlapY;
      } else {
        adjustedX += overlapX;
        adjustedY += overlapY;
      }

      // Re-check after adjustment for this barrier only; continue to next barrier
      const finalPlayerLeft = adjustedX - PLAYER_WIDTH / 2;
      const finalPlayerRight = adjustedX + PLAYER_WIDTH / 2;
      const finalPlayerTop = adjustedY - PLAYER_HEIGHT / 2;
      const finalPlayerBottom = adjustedY + PLAYER_HEIGHT / 2;

      const stillColliding = !(
        finalPlayerRight <= barrierLeft ||
        finalPlayerLeft >= barrierRight ||
        finalPlayerBottom <= barrierTop ||
        finalPlayerTop >= barrierBottom
      );

      if (stillColliding) {
        adjustedX = currentX;
        adjustedY = currentY;
      }
    }

    return { x: adjustedX, y: adjustedY };
  }

  addProjectile(id, path, playerId) {
    const player = this.players.get(playerId);
    let filteredPath = [];
    let hitBarrier = false;

    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      filteredPath.push(point);

      if (i > 0) {
        const prevPoint = path[i - 1];
        if (this.checkProjectileBarrierCollision(prevPoint, point)) {
          hitBarrier = true;
          break;
        }
      }
    }

    const projectile = {
      id,
      path: filteredPath,
      index: 0,
      shooter_id: playerId,
      isSecondPlayer: player ? player.isSecondPlayer : false,
      hitBarrier: hitBarrier,
    };

    this.projectiles.set(id, projectile);
    // Single source of truth: notify room when a projectile is added
    this.io.to(this.id).emit('newProjectile', projectile);
  }

  checkProjectileBarrierCollision(point1, point2) {
    // Iterate against each barrier of the current map
    const barriers = this.currentMap.barriers || [];

    const outcode = (x, y, barrier) => {
      const barrierLeft = barrier.x - barrier.width / 2;
      const barrierRight = barrier.x + barrier.width / 2;
      const barrierTop = barrier.y - barrier.height / 2;
      const barrierBottom = barrier.y + barrier.height / 2;

      let code = 0;
      if (x < barrierLeft) code |= 1;
      else if (x > barrierRight) code |= 2;
      if (y < barrierTop) code |= 4;
      else if (y > barrierBottom) code |= 8;
      return code;
    };

    const intersectsLine = (x1, y1, x2, y2, x3, y3, x4, y4) => {
      const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (denominator === 0) return false;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    };

    for (const barrier of barriers) {
      const barrierLeft = barrier.x - barrier.width / 2;
      const barrierRight = barrier.x + barrier.width / 2;
      const barrierTop = barrier.y - barrier.height / 2;
      const barrierBottom = barrier.y + barrier.height / 2;

      let code1 = outcode(point1.x, point1.y, barrier);
      let code2 = outcode(point2.x, point2.y, barrier);

      if ((code1 & code2) !== 0) continue; // both outside same side
      if (code1 === 0 && code2 === 0) return true; // both inside → intersects

      const hit = (
        intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierLeft, barrierTop, barrierRight, barrierTop) ||
        intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierRight, barrierTop, barrierRight, barrierBottom) ||
        intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierRight, barrierBottom, barrierLeft, barrierBottom) ||
        intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierLeft, barrierBottom, barrierLeft, barrierTop)
      );
      if (hit) return true;
    }

    return false;
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

  update() {
    this.updateProjectiles();
    this.checkCollisions();
    this.updateInvincibility();
  }

  checkCollisions() {
    let pointScored = false;
    this.players.forEach(player => {
      if (this.invinciblePlayers.has(player.id)) return;

      this.projectiles.forEach((proj, id) => {
        if (player.id !== proj.shooter_id && this.distance(player, proj) < (PLAYER_WIDTH / 2)) {
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
      const gameState = this.getState();
      this.io.to(this.id).emit('gameState', gameState);
    }
  }

  endRound() {
    // Reset players for next round or end match
    const isMatchOver = this.currentRound >= ROUNDS_PER_MATCH;

    if (!isMatchOver) {
      this.currentRound += 1;
      this.currentMapIndex = (this.currentMapIndex + 1) % (this.maps.length || 1);
      console.log(`[game ${this.id}] round ended; nextRound=${this.currentRound}; nextMap=${this.currentMap.id}`);
      this.resetForNextRound();
      this.io.to(this.id).emit('roundEnded', {
        round: this.currentRound - 1,
        nextRound: this.currentRound,
        map: this.currentMap,
      });
      // Inform clients to load map
      this.io.to(this.id).emit('mapSelected', {
        round: this.currentRound,
        map: this.currentMap,
      });
    } else {
      // Match over
      const players = Array.from(this.players.values());
      const winner = players.reduce((a, b) => (a.score >= b.score ? a : b));
      console.log(`[game ${this.id}] match ended; winner=${winner ? winner.id : 'none'}`);
      this.io.to(this.id).emit('matchEnded', {
        totalRounds: ROUNDS_PER_MATCH,
        winnerId: winner ? winner.id : null,
        scores: players.map(p => ({ id: p.id, score: p.score })),
      });
      // Prepare for new match after a brief reset
      this.currentRound = 1;
      this.currentMapIndex = 0;
      console.log(`[game ${this.id}] reset to round=1 map=${this.currentMap.id}`);
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
      player.x = player.isSecondPlayer ? GAME_WIDTH * this.currentMap.playerSpawnScale[1][0] : GAME_WIDTH * this.currentMap.playerSpawnScale[0][0];
      player.y = player.isSecondPlayer ? GAME_HEIGHT * this.currentMap.playerSpawnScale[1][1] : GAME_HEIGHT * this.currentMap.playerSpawnScale[0][1];
    });
    this.projectiles.clear();
    this.invinciblePlayers.clear();
  }

  resetGame() {
    // Kept for backward compatibility if referenced elsewhere
    this.resetForNextRound();
  }

  updateInvincibility() {
    const now = Date.now();
    this.invinciblePlayers.forEach((endTime, playerId) => {
      if (now >= endTime) {
        this.invinciblePlayers.delete(playerId);
        this.io.to(playerId).emit('invincibilityEnded');
      }
    });
  }

  distance(obj1, obj2) {
    return Math.sqrt(Math.pow(obj1.x - obj2.x, 2) + Math.pow(obj1.y - obj2.y, 2));
  }

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