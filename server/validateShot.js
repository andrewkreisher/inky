/**
 * Server-side validation of a client-submitted projectile path.
 * The client resamples its stroke to RESAMPLE_STEP-spaced points before
 * sending; anything that doesn't look like that is rejected.
 */
import {
  GAME_WIDTH, GAME_HEIGHT, RESAMPLE_STEP, MAX_PATH_POINTS,
  SHOT_ORIGIN_TOLERANCE, MIN_PATH_LENGTH, INK_COST_PER_PIXEL,
} from '../shared/constants.js';
import { distance } from '../shared/collision.js';

const BOUNDS_MARGIN = 50;
const MAX_SEGMENT = RESAMPLE_STEP * 1.5;
const MIN_LENGTH_SLACK = 0.9; // client enforces MIN_PATH_LENGTH exactly; allow float drift

function isValidPoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= -BOUNDS_MARGIN && p.x <= GAME_WIDTH + BOUNDS_MARGIN &&
    p.y >= -BOUNDS_MARGIN && p.y <= GAME_HEIGHT + BOUNDS_MARGIN;
}

/**
 * @returns {{ ok: true, length: number, cost: number } | { ok: false, reason: string }}
 */
export function validateShotPath(path, shooterPos) {
  if (!Array.isArray(path) || path.length < 2) return { ok: false, reason: 'path too short' };
  if (path.length > MAX_PATH_POINTS) return { ok: false, reason: 'too many points' };
  if (!path.every(isValidPoint)) return { ok: false, reason: 'invalid point' };
  if (distance(path[0], shooterPos) > SHOT_ORIGIN_TOLERANCE) return { ok: false, reason: 'origin too far from player' };

  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = distance(path[i - 1], path[i]);
    if (seg > MAX_SEGMENT) return { ok: false, reason: 'segment too long' };
    length += seg;
  }
  if (length < MIN_PATH_LENGTH * MIN_LENGTH_SLACK) return { ok: false, reason: 'path below minimum length' };

  return { ok: true, length, cost: length * INK_COST_PER_PIXEL };
}
