/**
 * Host-selected match options: lives per round, rounds per match, and how
 * maps are chosen. The server normalises whatever the client sends through
 * `normalizeMatchOptions` so malformed/hostile payloads fall back to defaults.
 */
import {
  LIVES_OPTIONS, DEFAULT_LIVES,
  ROUNDS_OPTIONS, DEFAULT_ROUNDS,
  MAP_MODE_RANDOM, MAP_MODE_CUSTOM, MAX_CUSTOM_MAP_SEQUENCE,
} from './constants.js';
import { MAPS, getMapById } from './maps.js';

export function defaultMatchOptions() {
  return {
    lives: DEFAULT_LIVES,
    rounds: DEFAULT_ROUNDS,
    mapMode: MAP_MODE_RANDOM,
    mapSequence: [],
  };
}

/** Coerce arbitrary input into a valid options object. */
export function normalizeMatchOptions(raw) {
  const base = defaultMatchOptions();
  if (!raw || typeof raw !== 'object') return base;

  const lives = Number(raw.lives);
  if (LIVES_OPTIONS.includes(lives)) base.lives = lives;

  const rounds = Number(raw.rounds);
  if (ROUNDS_OPTIONS.includes(rounds)) base.rounds = rounds;

  const sequence = Array.isArray(raw.mapSequence)
    ? raw.mapSequence.filter(id => typeof id === 'string' && getMapById(id)).slice(0, MAX_CUSTOM_MAP_SEQUENCE)
    : [];

  if (raw.mapMode === MAP_MODE_CUSTOM && sequence.length > 0) {
    base.mapMode = MAP_MODE_CUSTOM;
    base.mapSequence = sequence;
  }
  return base;
}

function shuffle(array, rng) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Build the ordered list of maps for a match (one entry per round).
 *
 * - random: concatenated shuffles so maps don't repeat until every map has
 *   been played, and never the same map twice in a row across the seam.
 * - custom: the host's sequence, cycled if it is shorter than `rounds`.
 */
export function buildMapOrder(options, maps = MAPS, rng = Math.random) {
  const { rounds, mapMode, mapSequence } = normalizeMatchOptions(options);

  if (mapMode === MAP_MODE_CUSTOM) {
    return Array.from({ length: rounds }, (_, i) => getMapById(mapSequence[i % mapSequence.length]));
  }

  const order = [];
  while (order.length < rounds) {
    let batch = shuffle(maps, rng);
    const last = order[order.length - 1];
    if (last && maps.length > 1 && batch[0].id === last.id) {
      // Avoid a back-to-back repeat at the seam between shuffles.
      batch.push(batch.shift());
    }
    order.push(...batch);
  }
  return order.slice(0, rounds);
}

/** Short human-readable summary, e.g. "3 lives · 5 rounds · Random maps". */
export function describeMatchOptions(options) {
  const o = normalizeMatchOptions(options);
  const maps = o.mapMode === MAP_MODE_CUSTOM ? `${o.mapSequence.length}-map sequence` : 'Random maps';
  return `${o.lives} lives · ${o.rounds} rounds · ${maps}`;
}
