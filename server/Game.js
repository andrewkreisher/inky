import {
  GAME_TICK_RATE,
  INVINCIBILITY_DURATION,
  PLAYER_WIDTH,
  PROJECTILE_RADIUS,
  ROUND_END_DELAY,
  COUNTDOWN_DURATION,
  MAX_INPUTS_PER_TICK,
  INPUT_TOKENS_PER_TICK,
  INPUT_TOKEN_MAX,
  INPUT_QUEUE_MAX,
  MAX_INK,
  INITIAL_INK,
  INK_REGEN_PER_SEC,
  INITIAL_PROJECTILE_COUNT,
  MAX_PROJECTILE_COUNT,
  PROJECTILE_REGEN_PER_SEC,
} from '../shared/constants.js';
import { checkProjectileBarrierCollision, distance } from '../shared/collision.js';
import { getSpawnPosition } from '../shared/maps.js';
import { stepPlayer, sanitizeInput } from '../shared/simulation.js';
import { normalizeMatchOptions, buildMapOrder } from '../shared/matchOptions.js';
import { validateShotPath } from './validateShot.js';

const INK_REGEN_PER_TICK = INK_REGEN_PER_SEC / GAME_TICK_RATE;
const AMMO_REGEN_PER_TICK = PROJECTILE_REGEN_PER_SEC / GAME_TICK_RATE;
const PROJECTILE_HIT_DISTANCE = PLAYER_WIDTH / 2 + PROJECTILE_RADIUS;
const PROJECTILE_PAIR_DISTANCE = PROJECTILE_RADIUS * 2;

/**
 * Authoritative match state for one room.
 *
 * Movement model: clients run the same `stepPlayer` and send each non-zero
 * input step with a sequence number. The server applies queued steps (rate
 * limited) and echoes the last processed seq so clients can reconcile.
 */
export class Game {
  /**
   * @param {string} id room id
   * @param {import('socket.io').Server} io
   * @param {object[]} maps available map pool
   * @param {object} [options] host-selected match options (normalised here)
   */
  constructor(id, io, maps, options) {
    this.id = id;
    this.io = io;
    this.players = new Map();
    this.projectiles = new Map();
    this.explosions = [];
    this.invinciblePlayers = new Map();
    this.usernames = {};

    this.options = normalizeMatchOptions(options);
    this.mapPool = maps;
    this.mapOrder = buildMapOrder(this.options, maps); // one entry per round
    this.currentRound = 1;
    this.matchOver = false;
    this.roundTransitioning = false;
    this.rematchRequests = new Set();

    this._timers = new Set();
    this._projectileSeq = 0;
  }

  setUsernames(usernames) {
    this.usernames = { ...usernames };
  }

  get currentMap() {
    return this.mapOrder[this.currentRound - 1];
  }

  get totalRounds() {
    return this.options.rounds;
  }

  /** True while gameplay (movement/shooting) is frozen. */
  get isPaused() {
    return this.matchOver || this.roundTransitioning;
  }

  // --- Timers ---

  _schedule(fn, delay) {
    const handle = setTimeout(() => {
      this._timers.delete(handle);
      fn();
    }, delay);
    this._timers.add(handle);
    return handle;
  }

  /** Cancel pending timers so a torn-down game never emits into its room. */
  destroy() {
    this._timers.forEach(clearTimeout);
    this._timers.clear();
  }

  // --- Players ---

  addPlayer(id) {
    const isSecondPlayer = this.players.size === 1;
    const spawn = getSpawnPosition(this.currentMap, isSecondPlayer ? 1 : 0);
    this.players.set(id, {
      id,
      x: spawn.x,
      y: spawn.y,
      lives: this.options.lives,
      score: 0,
      isSecondPlayer,
      ink: INITIAL_INK,
      ammo: INITIAL_PROJECTILE_COUNT,
      isDrawing: false,
      inputQueue: [],
      inputTokens: INPUT_TOKEN_MAX,
      lastSeq: 0,
    });
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  /** Enqueue client input steps `[{ seq, x, y }]`. Out-of-order/duplicate seqs are dropped. */
  queueInputs(id, inputs) {
    const player = this.players.get(id);
    if (!player || !Array.isArray(inputs)) return;

    for (const raw of inputs) {
      if (!raw || !Number.isInteger(raw.seq)) continue;
      const lastQueued = player.inputQueue.length
        ? player.inputQueue[player.inputQueue.length - 1].seq
        : player.lastSeq;
      if (raw.seq <= lastQueued) continue;
      if (player.inputQueue.length >= INPUT_QUEUE_MAX) player.inputQueue.shift();
      const { x, y } = sanitizeInput(raw);
      player.inputQueue.push({ seq: raw.seq, x, y });
    }
  }

  setDrawing(id, isDrawing) {
    const player = this.players.get(id);
    if (player) player.isDrawing = Boolean(isDrawing);
  }

  /**
   * Apply queued input steps. A token bucket bounds the sustained rate to
   * ~1 step per tick (prevents speed hacks) while allowing short bursts so a
   * client that hitched can catch up. When `applyMovement` is false the
   * inputs are consumed (acked) but don't move the player.
   */
  processInputs(player, applyMovement) {
    player.inputTokens = Math.min(player.inputTokens + INPUT_TOKENS_PER_TICK, INPUT_TOKEN_MAX);

    let processed = 0;
    while (player.inputQueue.length && processed < MAX_INPUTS_PER_TICK && player.inputTokens >= 1) {
      const input = player.inputQueue.shift();
      player.inputTokens -= 1;
      processed++;
      player.lastSeq = input.seq;
      if (applyMovement) {
        const next = stepPlayer(player, input, this.currentMap);
        player.x = next.x;
        player.y = next.y;
      }
    }
  }

  regenerateResources(player) {
    if (!player.isDrawing) {
      player.ink = Math.min(MAX_INK, player.ink + INK_REGEN_PER_TICK);
    }
    player.ammo = Math.min(MAX_PROJECTILE_COUNT, player.ammo + AMMO_REGEN_PER_TICK);
  }

  // --- Projectiles ---

  /** Validate and fire. Returns a rejection reason string, or null on success. */
  addProjectile(path, playerId) {
    const player = this.players.get(playerId);
    if (!player) return 'unknown player';
    if (this.isPaused) return 'round paused';

    const check = validateShotPath(path, player);
    if (!check.ok) return check.reason;
    if (player.ammo < 1) return 'no ammo';
    if (player.ink + 1e-6 < check.cost) return 'not enough ink';

    player.ammo -= 1;
    player.ink -= check.cost;

    // Truncate the path at the first segment that crosses a barrier.
    const { barriers = [] } = this.currentMap;
    const filteredPath = [path[0]];
    for (let i = 1; i < path.length; i++) {
      filteredPath.push(path[i]);
      if (checkProjectileBarrierCollision(path[i - 1], path[i], barriers, PROJECTILE_RADIUS)) break;
    }

    const id = `${playerId}-${this._projectileSeq++}`;
    const projectile = {
      id,
      path: filteredPath,
      index: 0,
      x: filteredPath[0].x,
      y: filteredPath[0].y,
      shooter_id: playerId,
      isSecondPlayer: player.isSecondPlayer,
    };
    this.projectiles.set(id, projectile);
    this.io.to(this.id).emit('newProjectile', projectile);
    return null;
  }

  updateProjectiles() {
    this.projectiles.forEach((proj, id) => {
      if (proj.index >= proj.path.length - 1) {
        this.explosions.push({ x: proj.x, y: proj.y });
        this.projectiles.delete(id);
        return;
      }
      proj.index++;
      proj.x = proj.path[proj.index].x;
      proj.y = proj.path[proj.index].y;
    });
  }

  /** Opposing projectiles that touch destroy each other. */
  resolveProjectileCollisions() {
    const list = Array.from(this.projectiles.values());
    const removed = new Set();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (removed.has(a.id)) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (removed.has(b.id) || a.shooter_id === b.shooter_id) continue;
        if (distance(a, b) < PROJECTILE_PAIR_DISTANCE) {
          removed.add(a.id);
          removed.add(b.id);
          this.explosions.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          break;
        }
      }
    }
    removed.forEach(id => this.projectiles.delete(id));
  }

  // --- Hits ---

  checkCollisions() {
    for (const player of this.players.values()) {
      if (this.invinciblePlayers.has(player.id)) continue;

      for (const [id, proj] of this.projectiles) {
        if (proj.shooter_id === player.id) continue;
        if (distance(player, proj) >= PROJECTILE_HIT_DISTANCE) continue;

        player.lives--;
        this.explosions.push({ x: proj.x, y: proj.y });
        this.projectiles.delete(id);
        this.invinciblePlayers.set(player.id, Date.now() + INVINCIBILITY_DURATION);

        if (player.lives <= 0) {
          this.onPlayerEliminated(player);
          return; // one round end per tick
        }
      }
    }
  }

  onPlayerEliminated(loser) {
    const scorer = Array.from(this.players.values()).find(p => p.id !== loser.id);
    if (scorer) scorer.score++;

    this.projectiles.clear();
    this.endRound(scorer);

    const scorerName = scorer ? (this.usernames[scorer.id] || 'Unknown') : 'Unknown';
    this.io.to(this.id).emit('pointScored', { scorerName });
    this.io.to(this.id).emit('gameState', this.getState());
  }

  updateInvincibility() {
    const now = Date.now();
    this.invinciblePlayers.forEach((endTime, playerId) => {
      if (now >= endTime) this.invinciblePlayers.delete(playerId);
    });
  }

  // --- Tick ---

  update() {
    if (this.matchOver) return;

    // Inputs are always consumed so clients' pending queues get acked, even
    // while frozen (otherwise prediction would replay stale steps forever).
    const moving = !this.roundTransitioning;
    this.players.forEach(player => this.processInputs(player, moving));
    if (!moving) return;

    this.players.forEach(player => this.regenerateResources(player));
    this.updateProjectiles();
    this.resolveProjectileCollisions();
    this.checkCollisions();
    this.updateInvincibility();
  }

  // --- Match / round flow ---

  endRound(scorer) {
    if (this.currentRound >= this.totalRounds) {
      this.endMatch();
      return;
    }

    this.roundTransitioning = true;
    this.io.to(this.id).emit('roundEnded', {
      round: this.currentRound,
      nextRound: this.currentRound + 1,
      scorerId: scorer ? scorer.id : null,
    });

    this._schedule(() => {
      this.currentRound += 1;
      this.resetForNextRound();
      this.io.to(this.id).emit('mapSelected', { round: this.currentRound, map: this.currentMap });
      this.startCountdown();
    }, ROUND_END_DELAY);
  }

  endMatch() {
    this.matchOver = true;
    const players = Array.from(this.players.values());
    const winner = players.reduce((a, b) => (a.score >= b.score ? a : b), players[0]);
    this.io.to(this.id).emit('matchEnded', {
      totalRounds: this.totalRounds,
      winnerId: winner ? winner.id : null,
      scores: players.map(p => ({
        id: p.id,
        score: p.score,
        username: this.usernames[p.id] || p.id.slice(0, 8),
      })),
    });
  }

  startCountdown() {
    this.roundTransitioning = true;
    this.io.to(this.id).emit('countdownStart');
    this._schedule(() => {
      this.roundTransitioning = false;
      this.io.to(this.id).emit('countdownEnd');
    }, COUNTDOWN_DURATION);
  }

  requestRematch(playerId) {
    this.rematchRequests.add(playerId);
    return this.rematchRequests.size;
  }

  startRematch() {
    this.matchOver = false;
    this.rematchRequests.clear();
    this.currentRound = 1;
    this.mapOrder = buildMapOrder(this.options, this.mapPool); // random mode reshuffles
    this.resetForNextRound(true);
    this.startCountdown();
  }

  resetForNextRound(resetScores = false) {
    this.players.forEach(player => {
      player.lives = this.options.lives;
      if (resetScores) player.score = 0;
      const spawn = getSpawnPosition(this.currentMap, player.isSecondPlayer ? 1 : 0);
      player.x = spawn.x;
      player.y = spawn.y;
      player.ink = INITIAL_INK;
      player.ammo = INITIAL_PROJECTILE_COUNT;
      player.isDrawing = false;
      // Ack (without applying) anything still queued so clients drop their pending steps.
      if (player.inputQueue.length) {
        player.lastSeq = player.inputQueue[player.inputQueue.length - 1].seq;
        player.inputQueue.length = 0;
      }
    });
    this.projectiles.clear();
    this.invinciblePlayers.clear();
  }

  // --- Snapshot ---

  getState() {
    const state = {
      t: Date.now(),
      round: this.currentRound,
      totalRounds: this.totalRounds,
      maxLives: this.options.lives,
      mapId: this.currentMap.id,
      paused: this.isPaused,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        seq: p.lastSeq,
        lives: p.lives,
        score: p.score,
        ink: p.ink,
        ammo: p.ammo,
        isSecondPlayer: p.isSecondPlayer,
        isInvincible: this.invinciblePlayers.has(p.id),
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
