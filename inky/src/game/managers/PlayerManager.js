import { stepPlayer, inputFromKeys } from '@shared/simulation.js';
import { Interpolator } from '../net/Interpolator';
import {
    TICK_MS,
    PLAYER_SPRITE_SCALE, PLAYER_DEPTH,
    INVINCIBILITY_FLASH_DURATION, CORRECTION_SMOOTHING,
} from '../constants';

const MAX_STEPS_PER_FRAME = 8; // after a long hitch, drop the backlog rather than teleport

/**
 * Owns player sprites for the multiplayer scene.
 *
 * Local player: client-side prediction. Each simulation tick we read WASD,
 * run the shared `stepPlayer`, send the step (with a seq) to the server and
 * keep it pending. When a snapshot arrives we reset to the server position,
 * re-apply the steps the server hasn't processed yet, and smooth any
 * resulting correction so the sprite never visibly snaps.
 *
 * Remote players: rendered `INTERPOLATION_DELAY_MS` in the past via an
 * `Interpolator` fed by snapshots.
 */
export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.currentPlayer = null;
        this.isSecondPlayer = false;
        this.otherPlayers = new Map();        // id -> { sprite, interp }
        this.invincibilityTweens = new Map();

        // Prediction state
        this.predicted = null;                // { x, y } or null until first snapshot
        this.correction = { x: 0, y: 0 };     // visual offset being smoothed to zero
        this.pendingInputs = [];              // [{ seq, x, y }]
        this.seq = 0;
        this.accumulator = 0;
        this.hasServerState = false;
    }

    // --- Per-frame ---

    update(delta, now) {
        this.predictLocal(delta);
        this.renderLocal(delta);
        this.renderRemote(now);
    }

    readInput() {
        const c = this.scene.cursors;
        if (!c) return { x: 0, y: 0 };
        return inputFromKeys(c.left.isDown, c.right.isDown, c.up.isDown, c.down.isDown);
    }

    predictLocal(delta) {
        if (!this.hasServerState || this.scene.roundTransitioning || this.scene.gameover) {
            this.accumulator = 0;
            return;
        }

        this.accumulator += delta;
        let steps = Math.floor(this.accumulator / TICK_MS);
        this.accumulator -= steps * TICK_MS;
        if (steps > MAX_STEPS_PER_FRAME) steps = MAX_STEPS_PER_FRAME;
        if (steps === 0) return;

        const input = this.readInput();
        if (input.x === 0 && input.y === 0) return; // zero steps are no-ops; nothing to send

        const batch = [];
        for (let i = 0; i < steps; i++) {
            this.seq++;
            this.predicted = stepPlayer(this.predicted, input, this.scene.currentMap || {});
            const step = { seq: this.seq, x: input.x, y: input.y };
            this.pendingInputs.push(step);
            batch.push(step);
        }
        this.scene.socket.emit('playerInput', { gameId: this.scene.gameId, inputs: batch });
    }

    renderLocal(delta) {
        if (!this.currentPlayer || !this.predicted) return;
        // Exponential decay of the correction offset toward zero.
        const k = Math.exp(-CORRECTION_SMOOTHING * (delta / 1000));
        this.correction.x *= k;
        this.correction.y *= k;
        if (Math.abs(this.correction.x) < 0.05) this.correction.x = 0;
        if (Math.abs(this.correction.y) < 0.05) this.correction.y = 0;
        this.currentPlayer.setPosition(this.predicted.x + this.correction.x, this.predicted.y + this.correction.y);
    }

    renderRemote(now) {
        this.otherPlayers.forEach(({ sprite, interp }) => {
            const p = interp.sample(now);
            if (p) sprite.setPosition(p.x, p.y);
        });
    }

    // --- Snapshot reconciliation ---

    applySnapshot(players, now) {
        const stale = new Set(this.otherPlayers.keys());
        players.forEach(info => {
            if (info.id === this.scene.socket.id) {
                this.reconcileLocal(info);
            } else {
                stale.delete(info.id);
                this.updateRemote(info, now);
            }
        });
        stale.forEach(id => this.removeRemote(id));
    }

    reconcileLocal(info) {
        const texture = info.isSecondPlayer ? 'player2' : 'player';
        if (!this.currentPlayer || this.isSecondPlayer !== info.isSecondPlayer) {
            if (this.currentPlayer) this.currentPlayer.destroy();
            this.currentPlayer = this.scene.add.sprite(info.x, info.y, texture)
                .setScale(PLAYER_SPRITE_SCALE)
                .setDepth(PLAYER_DEPTH);
            this.isSecondPlayer = info.isSecondPlayer;
            this.scene.uiManager.updateProjectileSprites();
            this.scene.uiManager.updateLives(info.lives, undefined, true);
        }

        // Drop acknowledged inputs, replay the rest on top of the server position.
        this.pendingInputs = this.pendingInputs.filter(s => s.seq > info.seq);
        let pos = { x: info.x, y: info.y };
        const map = this.scene.currentMap || {};
        for (const step of this.pendingInputs) pos = stepPlayer(pos, step, map);

        if (this.predicted) {
            // Keep the sprite where it was and let the error bleed off smoothly.
            this.correction.x += this.predicted.x - pos.x;
            this.correction.y += this.predicted.y - pos.y;
            // A large error (respawn/teleport) should just snap.
            if (Math.hypot(this.correction.x, this.correction.y) > 150) {
                this.correction.x = 0;
                this.correction.y = 0;
            }
        }
        this.predicted = pos;
        this.hasServerState = true;

        this.updatePlayerInvincibility(this.currentPlayer, info.isInvincible);
    }

    updateRemote(info, now) {
        const texture = info.isSecondPlayer ? 'player2' : 'player';
        let entry = this.otherPlayers.get(info.id);
        if (!entry || entry.sprite.texture.key !== texture) {
            if (entry) this.removeRemote(info.id);
            const sprite = this.scene.add.sprite(info.x, info.y, texture)
                .setScale(PLAYER_SPRITE_SCALE)
                .setDepth(PLAYER_DEPTH);
            entry = { sprite, interp: new Interpolator() };
            this.otherPlayers.set(info.id, entry);
        }
        entry.interp.push(info.x, info.y, now);
        this.updatePlayerInvincibility(entry.sprite, info.isInvincible);
    }

    removeRemote(id) {
        const entry = this.otherPlayers.get(id);
        if (!entry) return;
        this.otherPlayers.delete(id);
        this.stopInvincibilityAnimation(entry.sprite);
        entry.sprite.destroy();
    }

    /** New round: clear pending prediction so we snap cleanly to the respawn. */
    resetPrediction() {
        this.pendingInputs = [];
        this.correction = { x: 0, y: 0 };
        this.accumulator = 0;
        this.otherPlayers.forEach(({ sprite, interp }) => interp.reset(sprite.x, sprite.y, performance.now()));
    }

    // --- Invincibility flash ---

    updatePlayerInvincibility(sprite, isInvincible) {
        const active = this.invincibilityTweens.has(sprite);
        if (isInvincible && !active) {
            this.startInvincibilityAnimation(sprite);
        } else if (!isInvincible && active) {
            this.stopInvincibilityAnimation(sprite);
        }
    }

    startInvincibilityAnimation(sprite) {
        const tween = this.scene.tweens.add({
            targets: sprite,
            alpha: 0.5,
            duration: INVINCIBILITY_FLASH_DURATION,
            yoyo: true,
            repeat: -1,
        });
        this.invincibilityTweens.set(sprite, tween);
    }

    stopInvincibilityAnimation(sprite) {
        const tween = this.invincibilityTweens.get(sprite);
        if (!tween) return;
        tween.stop();
        this.invincibilityTweens.delete(sprite);
        if (sprite.active) sprite.setAlpha(1);
    }

    stopAllInvincibilityAnimations() {
        Array.from(this.invincibilityTweens.keys()).forEach(sprite => this.stopInvincibilityAnimation(sprite));
    }
}
