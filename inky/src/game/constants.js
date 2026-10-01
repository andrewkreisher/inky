// Gameplay constants shared with the server live in /shared/constants.js and
// are re-exported here so game code has a single import path.
export * from '@shared/constants.js';

// --- Client-only (presentation) constants ---

// Drawing
export const DRAWING_LINE_WIDTH = 2;
export const DRAWING_LINE_COLOR = 0xff0000;
export const BOUNDARY_BUFFER = 1;

// Player
export const PLAYER_SPRITE_SCALE = 0.2;
export const PLAYER_DEPTH = 1;
export const CORRECTION_SMOOTHING = 12; // 1/s decay rate of prediction-correction offset

// Projectiles
export const PROJECTILE_SPRITE_SCALE = 0.07;
export const PROJECTILE_DEPTH = 2;

// Map
export const MAP_OBJECT_DEPTH = 0.5;

// Animations
export const SHOOT_ANIMATION_DURATION = 320;
export const EXPLOSION_SIZE = 80;
export const EXPLOSION_DURATION = 200;
export const EXPLOSION_DEPTH = 100;
export const ROUND_TEXT_DURATION = 1500;
export const INVINCIBILITY_FLASH_DURATION = 200;
export const SCORED_TEXT_DURATION = 1500;
export const OVERLAY_TEXT_DEPTH = 200;

// UI layout - HUD
export const HUD_HEIGHT = 54;
export const HUD_DEPTH = 90;

// UI layout - Scoreboard (top centre)
export const SCOREBOARD_Y = 10;
export const SCOREBOARD_WIDTH = 420;
export const SCOREBOARD_HEIGHT = 58;
export const SCOREBOARD_ICON_SCALE = 0.07;
export const SCOREBOARD_SCORE_SIZE = '34px';
export const SCOREBOARD_NAME_SIZE = '11px';
export const SCOREBOARD_NAME_MAX_CHARS = 12;

// UI layout - Ink bar
export const INK_BAR_X = 460;
export const INK_BAR_WIDTH = 360;
export const INK_BAR_HEIGHT = 18;
export const INK_BAR_RADIUS = 5;
export const INK_BAR_LOW_THRESHOLD = 0.25;

// UI layout - Projectiles
export const PROJECTILE_UI_SCALE = 0.04;
export const PROJECTILE_UI_SPACING = 26;
/** Alpha of the ammo icon that is still refilling, at the start of a charge. */
export const AMMO_CHARGE_MIN_ALPHA = 0.22;

// UI layout - Lives
export const LIFE_UI_SCALE = 0.055;
export const LIFE_UI_SPACING = 38;
export const LIFE_UI_LOST_ALPHA = 0.2;

// Text styles
export const FONT_FAMILY = 'Silkscreen';
