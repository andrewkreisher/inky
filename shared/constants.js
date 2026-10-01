/**
 * Constants shared by the server (authoritative simulation) and the client
 * (prediction, interpolation, HUD). Anything that affects gameplay outcomes
 * lives here so both sides agree by construction.
 *
 * Rates are expressed per second; per-tick values are derived.
 */

// --- World ---
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// --- Simulation / networking ---
export const GAME_TICK_RATE = 120;                     // authoritative ticks per second
export const TICK_MS = 1000 / GAME_TICK_RATE;
export const SNAPSHOT_RATE = 60;                       // gameState broadcasts per second
export const TICKS_PER_SNAPSHOT = GAME_TICK_RATE / SNAPSHOT_RATE;
export const MAX_INPUTS_PER_TICK = 4;                  // burst catch-up cap after a client hitch
export const INPUT_TOKENS_PER_TICK = 1.1;              // sustained input rate allowance (10% headroom)
export const INPUT_TOKEN_MAX = 12;
export const INPUT_QUEUE_MAX = 64;
export const INTERPOLATION_DELAY_MS = 50;              // client render delay for remote entities

// --- Players ---
export const PLAYER_SPEED = 900;                       // px per second at full input
export const PLAYER_STEP = PLAYER_SPEED / GAME_TICK_RATE; // px per tick
export const PLAYER_WIDTH = 80;                        // hitbox
export const PLAYER_HEIGHT = 80;
export const INVINCIBILITY_DURATION = 2000;            // ms after being hit

// --- Ink ---
export const MAX_INK = 400;
export const INITIAL_INK = 200;                        // ink at the start of every round
export const INK_REGEN_PER_SEC = 48;                   // paused while drawing
export const INK_COST_PER_PIXEL = 0.1;
export const MIN_PATH_LENGTH = 200;                    // shorter strokes are discarded

// --- Projectiles ---
export const RESAMPLE_STEP = 5;                        // px between path points
export const PROJECTILE_SPEED = RESAMPLE_STEP * GAME_TICK_RATE; // px per second (one point per tick)
export const PROJECTILE_RADIUS = 20;                   // collision radius
export const INITIAL_PROJECTILE_COUNT = 5;             // ammo at the start of every round
export const MAX_PROJECTILE_COUNT = 10;
export const PROJECTILE_REGEN_PER_SEC = 0.36;          // ≈ one shot every 2.8 s
export const MAX_PATH_POINTS = Math.ceil(MAX_INK / INK_COST_PER_PIXEL / RESAMPLE_STEP) + 2;
export const SHOT_ORIGIN_TOLERANCE = 160;              // px the path start may be from the server position (prediction slack)

// --- Match options (chosen by the host when creating a game) ---
export const LIVES_OPTIONS = [3, 4, 5];                // lives per round
export const DEFAULT_LIVES = 3;
export const ROUNDS_OPTIONS = [3, 5, 7];               // rounds per match
export const DEFAULT_ROUNDS = 5;
export const MAP_MODE_RANDOM = 'random';               // shuffled, no back-to-back repeats
export const MAP_MODE_CUSTOM = 'custom';               // host-defined sequence (repeats allowed)
export const MAX_CUSTOM_MAP_SEQUENCE = 20;

// --- Match timing ---
export const ROUND_END_DELAY = 2000;                   // ms between a point and the next map
export const COUNTDOWN_DURATION = 3000;                // ms pre-round countdown
