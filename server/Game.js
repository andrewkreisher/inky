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
} = require('./config');

class Game {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.players = new Map();
    this.projectiles = new Map();
    this.explosions = [];
    this.playerCount = 0;
    this.invinciblePlayers = new Map();
  }

  addPlayer(id, x, y) {
    this.playerCount++;
    const isSecondPlayer = this.playerCount === 2;
    this.players.set(id, { id, x, y, lives: MAX_LIVES, score: 0, isSecondPlayer });
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
    const barrierLeft = BARRIER.x - BARRIER.width / 2;
    const barrierRight = BARRIER.x + BARRIER.width / 2;
    const barrierTop = BARRIER.y - BARRIER.height / 2;
    const barrierBottom = BARRIER.y + BARRIER.height / 2;

    const playerLeft = desiredX - PLAYER_WIDTH / 2;
    const playerRight = desiredX + PLAYER_WIDTH / 2;
    const playerTop = desiredY - PLAYER_HEIGHT / 2;
    const playerBottom = desiredY + PLAYER_HEIGHT / 2;

    const colliding = !(
      playerRight <= barrierLeft ||
      playerLeft >= barrierRight ||
      playerBottom <= barrierTop ||
      playerTop >= barrierBottom
    );

    if (!colliding) {
      return { x: desiredX, y: desiredY };
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

    let adjustedX = desiredX;
    let adjustedY = desiredY;

    if (overlapX === 0 && overlapY === 0) {
      return { x: currentX, y: currentY };
    }

    if (Math.abs(overlapX) < Math.abs(overlapY)) {
      adjustedX += overlapX;
    } else if (Math.abs(overlapY) < Math.abs(overlapX)) {
      adjustedY += overlapY;
    } else {
      adjustedX += overlapX;
      adjustedY += overlapY;
    }

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
      return { x: currentX, y: currentY };
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
    this.io.to(this.id).emit('newProjectile', projectile);
  }

  checkProjectileBarrierCollision(point1, point2) {
    const barrierLeft = BARRIER.x - BARRIER.width / 2;
    const barrierRight = BARRIER.x + BARRIER.width / 2;
    const barrierTop = BARRIER.y - BARRIER.height / 2;
    const barrierBottom = BARRIER.y + BARRIER.height / 2;

    const outcode = (x, y) => {
      let code = 0;
      if (x < barrierLeft) code |= 1;
      else if (x > barrierRight) code |= 2;
      if (y < barrierTop) code |= 4;
      else if (y > barrierBottom) code |= 8;
      return code;
    };

    let code1 = outcode(point1.x, point1.y);
    let code2 = outcode(point2.x, point2.y);

    if ((code1 & code2) !== 0) return false;
    if (code1 === 0 && code2 === 0) return true;

    const intersectsLine = (x1, y1, x2, y2, x3, y3, x4, y4) => {
      const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (denominator === 0) return false;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    };

    return (
      intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierLeft, barrierTop, barrierRight, barrierTop) ||
      intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierRight, barrierTop, barrierRight, barrierBottom) ||
      intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierRight, barrierBottom, barrierLeft, barrierBottom) ||
      intersectsLine(point1.x, point1.y, point2.x, point2.y, barrierLeft, barrierBottom, barrierLeft, barrierTop)
    );
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
            this.resetGame();
            pointScored = true;
            this.projectiles.clear();
          }
        }
      });
    });

    if (pointScored) {
      this.players.forEach(p => {
        this.io.to(p.id).emit('pointScored');
        const gameState = this.getState();
        this.io.to(this.id).emit('gameState', gameState);
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
    this.invinciblePlayers.clear();
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
    };
    this.explosions = [];
    return state;
  }
}

module.exports = Game; 