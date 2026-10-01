/**
 * Deterministic movement step shared by the server (authoritative) and the
 * client (prediction + reconciliation). Both sides MUST produce identical
 * results for the same (position, input, map), so keep this pure and avoid
 * anything platform-specific.
 */
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_STEP, PLAYER_WIDTH, PLAYER_HEIGHT } from './constants.js';
import { resolveBarrierCollision } from './collision.js';

/** Clamp a movement input to a unit-length-or-shorter vector of finite numbers. */
export function sanitizeInput(input) {
  const x = Number.isFinite(input?.x) ? input.x : 0;
  const y = Number.isFinite(input?.y) ? input.y : 0;
  const len = Math.hypot(x, y);
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
}

/** Build a normalised input vector from four booleans (WASD). */
export function inputFromKeys(left, right, up, down) {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    return { x: x * inv, y: y * inv };
  }
  return { x, y };
}

/**
 * Advance a player one simulation tick.
 * @param {{x:number,y:number}} pos  current position
 * @param {{x:number,y:number}} input unit-or-shorter direction
 * @param {{barriers?:[], nets?:[]}} map
 * @returns {{x:number,y:number}} new position
 */
export function stepPlayer(pos, input, map) {
  if (input.x === 0 && input.y === 0) return { x: pos.x, y: pos.y };

  let newX = pos.x + input.x * PLAYER_STEP;
  let newY = pos.y + input.y * PLAYER_STEP;

  newX = Math.max(PLAYER_WIDTH / 2, Math.min(newX, GAME_WIDTH - PLAYER_WIDTH / 2));
  newY = Math.max(PLAYER_HEIGHT / 2, Math.min(newY, GAME_HEIGHT - PLAYER_HEIGHT / 2));

  const blockers = (map.barriers || []).concat(map.nets || []);
  return resolveBarrierCollision(pos.x, pos.y, newX, newY, blockers, PLAYER_WIDTH, PLAYER_HEIGHT);
}
