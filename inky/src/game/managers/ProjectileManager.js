import { Interpolator } from '../net/Interpolator';
import {
    PROJECTILE_SPRITE_SCALE, PROJECTILE_DEPTH,
    RESAMPLE_STEP, SHOOT_ANIMATION_DURATION,
} from '../constants';

/**
 * Owns projectile sprites for the multiplayer scene. Everything about
 * projectiles is server-authoritative (movement, barrier truncation, hits,
 * projectile-vs-projectile); this class reconciles sprites by ID against
 * each snapshot and renders them through an `Interpolator`.
 *
 * Ammo is also server-owned: `projectileCount` mirrors the last snapshot.
 */
export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = new Map(); // id -> { sprite, interp }
        this.projectileCount = 0;      // server ammo (float), read by UIManager
    }

    // --- Firing ---

    get canShoot() {
        return this.projectileCount >= 1 && !this.scene.roundTransitioning && !this.scene.gameover;
    }

    shootProjectile() {
        const { drawingManager, playerManager, socket, gameId } = this.scene;
        const player = playerManager.currentPlayer;
        if (!this.canShoot || !player || drawingManager.drawPath.length < 2) return;

        // Paths are stored relative to the player; convert using the predicted position.
        const origin = playerManager.predicted || player;
        const worldPath = drawingManager.drawPath.map(p => ({ x: origin.x + p.x, y: origin.y + p.y }));
        const path = drawingManager.resamplePath(worldPath, RESAMPLE_STEP);
        if (path.length < 2) return;

        this.playShootAnimation(player);
        socket.emit('shootProjectile', { gameId, path });
        drawingManager.clearPath();
        // Ammo/ink are deducted by the server; the HUD updates on the next snapshot.
    }

    playShootAnimation(player) {
        const second = this.scene.playerManager.isSecondPlayer;
        player.setTexture(second ? 'player2shoot' : 'playershoot');
        this.scene.time.delayedCall(SHOOT_ANIMATION_DURATION, () => {
            const current = this.scene.playerManager.currentPlayer;
            if (current && current.active) current.setTexture(second ? 'player2' : 'player');
        });
    }

    setServerAmmo(ammo) {
        const changed = Math.floor(ammo) !== Math.floor(this.projectileCount);
        this.projectileCount = ammo;
        if (changed) this.scene.uiManager.updateProjectileSprites();
    }

    // --- Sprites ---

    createEntry(info, x, y, now) {
        const sprite = this.scene.add.image(x, y, info.isSecondPlayer ? 'projectile2' : 'projectile')
            .setScale(PROJECTILE_SPRITE_SCALE)
            .setDepth(PROJECTILE_DEPTH);
        const entry = { sprite, interp: new Interpolator() };
        entry.interp.push(x, y, now);
        this.projectiles.set(info.id, entry);
        return entry;
    }

    remove(id) {
        const entry = this.projectiles.get(id);
        if (!entry) return;
        this.projectiles.delete(id);
        entry.sprite.destroy();
    }

    clearAll() {
        this.projectiles.forEach(({ sprite }) => sprite.destroy());
        this.projectiles.clear();
    }

    /** Incremental: a projectile was just fired (arrives before its first snapshot). */
    handleNewProjectile(info, now) {
        if (!info.path || info.path.length === 0 || this.projectiles.has(info.id)) return;
        this.createEntry(info, info.path[0].x, info.path[0].y, now);
    }

    /** Reconcile against a snapshot: update known, create unknown, remove missing. */
    applySnapshot(list, now) {
        if (!list) return;
        const seen = new Set();
        list.forEach(info => {
            seen.add(info.id);
            const entry = this.projectiles.get(info.id) || this.createEntry(info, info.x, info.y, now);
            entry.interp.push(info.x, info.y, now);
        });
        for (const id of Array.from(this.projectiles.keys())) {
            if (!seen.has(id)) this.remove(id);
        }
    }

    // --- Per-frame ---

    update(now) {
        this.projectiles.forEach(({ sprite, interp }) => {
            const p = interp.sample(now);
            if (p) sprite.setPosition(p.x, p.y);
        });
    }
}
