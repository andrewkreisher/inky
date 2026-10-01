import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK, MIN_PATH_LENGTH, INITIAL_INK,
    DRAWING_LINE_WIDTH, DRAWING_LINE_COLOR, BOUNDARY_BUFFER, INK_COST_PER_PIXEL,
} from '../constants';

/**
 * Ink drawing.
 *
 * Ink model: `inkPool` is the ink the player actually has (server-owned in
 * multiplayer via `setInkPool`, locally regenerated in single player). The
 * path currently being drawn or held costs `pathLength * INK_COST_PER_PIXEL`
 * and is subtracted for display, so cancelling or discarding a stroke
 * "refunds" it for free. Firing clears the path; whoever owns the pool
 * deducts the cost.
 *
 * `drawPath` is stored relative to the player's position at the time of each
 * sample, so the path follows the player until it is fired.
 */
export class DrawingManager {
    constructor(scene) {
        this.scene = scene;
        this.drawPath = [];
        this.pathLength = 0;
        this.isDrawing = false;
        this.inkPool = INITIAL_INK;
        this.graphics = null;
        /** Optional hook: called with `true`/`false` when a stroke starts/ends. */
        this.onDrawingStateChanged = null;
    }

    init() {
        this.graphics = this.scene.add.graphics();
    }

    get player() {
        return this.scene.playerManager.currentPlayer;
    }

    /** Ink available after accounting for the current stroke. */
    get currentInk() {
        return Math.max(0, this.inkPool - this.pathLength * INK_COST_PER_PIXEL);
    }

    get pathCost() {
        return this.pathLength * INK_COST_PER_PIXEL;
    }

    setInkPool(value) {
        this.inkPool = value;
    }

    // --- Pointer handlers ---

    startDrawing(pointer) {
        if (pointer.button !== 0) return; // left button only
        if (!this.player || this.scene.gameover) return;

        this.clearPath();
        if (this.currentInk <= 0) return;

        this.setDrawing(true);
        this.drawPath = [{ x: pointer.x - this.player.x, y: pointer.y - this.player.y }];
    }

    continueDrawing(pointer) {
        if (!this.isDrawing) return;
        if ((pointer.buttons & 1) === 0) return; // left button released

        const nearBounds = pointer.x < BOUNDARY_BUFFER || pointer.x > GAME_WIDTH - BOUNDARY_BUFFER ||
            pointer.y < BOUNDARY_BUFFER || pointer.y > GAME_HEIGHT - BOUNDARY_BUFFER;
        if (nearBounds) {
            this.stopDrawing(pointer);
            return;
        }
        if (!this.player) return;

        const point = { x: pointer.x - this.player.x, y: pointer.y - this.player.y };
        const last = this.drawPath[this.drawPath.length - 1];
        const segment = Phaser.Math.Distance.Between(last.x, last.y, point.x, point.y);
        if (segment * INK_COST_PER_PIXEL <= this.currentInk) {
            this.drawPath.push(point);
            this.pathLength += segment;
            this.redrawPath();
        }
    }

    /** Finish the stroke. Too-short paths are discarded. */
    stopDrawing(pointer) {
        if (pointer && pointer.button !== undefined && pointer.button !== 0) return;
        if (!this.isDrawing) return;
        this.setDrawing(false);

        if (this.pathLength < MIN_PATH_LENGTH) {
            this.clearPath();
            return;
        }

        // Normalise so the path starts at the player.
        const { x: ox, y: oy } = this.drawPath[0];
        this.drawPath = this.drawPath.map(p => ({ x: p.x - ox, y: p.y - oy }));
        this.redrawPath();
    }

    /** Abort an in-progress stroke (E key / right-click). */
    cancelDrawing() {
        if (!this.isDrawing) return;
        this.setDrawing(false);
        this.clearPath();
    }

    setDrawing(value) {
        if (this.isDrawing === value) return;
        this.isDrawing = value;
        if (this.onDrawingStateChanged) this.onDrawingStateChanged(value);
    }

    // --- State helpers ---

    clearPath() {
        this.drawPath = [];
        this.pathLength = 0;
        if (this.graphics) this.graphics.clear();
    }

    /** New round: drop any path and restore starting ink (single player / fallback). */
    reset() {
        this.setDrawing(false);
        this.clearPath();
        this.inkPool = INITIAL_INK;
    }

    /** Single player: regenerate ink locally (per second, delta in ms). */
    regenerate(ratePerSec, deltaMs) {
        if (this.isDrawing) return;
        this.inkPool = Math.min(MAX_INK, this.inkPool + ratePerSec * (deltaMs / 1000));
    }

    /** Single player: pay for a fired path. */
    spendPathCost() {
        this.inkPool = Math.max(0, this.inkPool - this.pathCost);
    }

    calculatePathDistance(path) {
        let distance = 0;
        for (let i = 1; i < path.length; i++) {
            distance += Phaser.Math.Distance.Between(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
        }
        return distance;
    }

    redrawPath() {
        if (this.drawPath.length < 2 || !this.player) return;
        const { x: px, y: py } = this.player;
        this.graphics.clear().lineStyle(DRAWING_LINE_WIDTH, DRAWING_LINE_COLOR);
        this.graphics.beginPath();
        this.graphics.moveTo(px + this.drawPath[0].x, py + this.drawPath[0].y);
        for (let i = 1; i < this.drawPath.length; i++) {
            this.graphics.lineTo(px + this.drawPath[i].x, py + this.drawPath[i].y);
        }
        this.graphics.strokePath();
    }

    /** Resample a polyline to evenly spaced points `step` apart. */
    resamplePath(path, step) {
        if (!path || path.length < 2) return path;

        const total = this.calculatePathDistance(path);
        const newPath = [path[0]];
        if (total === 0) return newPath;

        const numSteps = Math.floor(total / step);
        let cursor = 0;
        let covered = 0;

        for (let i = 1; i <= numSteps; i++) {
            const target = i * step;
            while (cursor < path.length - 1) {
                const a = path[cursor];
                const b = path[cursor + 1];
                const segment = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
                if (covered + segment >= target) {
                    const t = (target - covered) / segment;
                    newPath.push({
                        x: Phaser.Math.Linear(a.x, b.x, t),
                        y: Phaser.Math.Linear(a.y, b.y, t),
                    });
                    break;
                }
                covered += segment;
                cursor++;
            }
        }
        return newPath;
    }
}
