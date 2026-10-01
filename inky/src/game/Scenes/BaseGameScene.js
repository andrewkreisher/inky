import Phaser from 'phaser';
import playerImage from '../../assets/player.png';
import player2Image from '../../assets/player2.png';
import darkBackgroundImage from '../../assets/inkybackground.png';
import barrierImage from '../../assets/woodbarrier.png';
import netImage from '../../assets/net.png';
import projectileImage from '../../assets/projectile.png';
import projectile2Image from '../../assets/projectile2.png';
import playerShootImage from '../../assets/playershoot.png';
import player2ShootImage from '../../assets/player2shoot.png';
import projectileExplosion from '../../assets/projectileexplosion.png';

import { getSpawnPosition } from '@shared/maps.js';
import {
    GAME_WIDTH, GAME_HEIGHT,
    EXPLOSION_SIZE, EXPLOSION_DURATION, EXPLOSION_DEPTH,
    MAP_OBJECT_DEPTH, FONT_FAMILY, OVERLAY_TEXT_DEPTH,
} from '../constants';

/**
 * Shared behaviour for the multiplayer and single-player scenes:
 * asset preloading, background, map (barrier/net) construction, explosions,
 * and a real shutdown hook.
 *
 * Subclasses must create `this.drawingManager`, `this.uiManager`,
 * `this.projectileManager` (with `projectileCount`) and `this.playerManager`
 * (with `currentPlayer`) in `create()`, and should call `super.create()` first.
 */
export class BaseGameScene extends Phaser.Scene {
    constructor(key) {
        super({ key });
        this.gameover = false;
        this.currentMap = null;
        this.barriers = null;
        this.nets = null;
    }

    preload() {
        this.load.image('player', playerImage);
        this.load.image('player2', player2Image);
        this.load.image('dark_background', darkBackgroundImage);
        this.load.image('barrier', barrierImage);
        this.load.image('net', netImage);
        this.load.image('projectile', projectileImage);
        this.load.image('projectile2', projectile2Image);
        this.load.image('playershoot', playerShootImage);
        this.load.image('player2shoot', player2ShootImage);
        this.load.image('projectileExplosion', projectileExplosion);
    }

    create() {
        this.gameover = false;
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'dark_background').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
        this.barriers = this.physics.add.staticGroup();
        this.nets = this.physics.add.staticGroup();

        // Phaser does not call a `shutdown()` method on scenes; it emits an event.
        // `destroy` can fire without a preceding `shutdown` (game.destroy), so hook both.
        this._cleanedUp = false;
        const cleanup = () => {
            if (this._cleanedUp) return;
            this._cleanedUp = true;
            this.onShutdown();
        };
        this.events.once('shutdown', cleanup);
        this.events.once('destroy', cleanup);
    }

    // --- Map ---

    /** Rebuild barrier and net static bodies from `this.currentMap`. */
    rebuildMap() {
        this.barriers.clear(true, true);
        this.nets.clear(true, true);
        if (!this.currentMap) return;

        const addStatic = (group, texture, rect) => {
            group.create(rect.x, rect.y, texture)
                .setSize(rect.width, rect.height)
                .setDisplaySize(rect.width, rect.height)
                .setDepth(MAP_OBJECT_DEPTH)
                .refreshBody();
        };
        (this.currentMap.barriers || []).forEach(b => addStatic(this.barriers, 'barrier', b));
        (this.currentMap.nets || []).forEach(n => addStatic(this.nets, 'net', n));
    }

    /** World position for spawn `index` (0 = player 1, 1 = player 2). */
    getSpawnPosition(index) {
        return getSpawnPosition(this.currentMap, index);
    }

    // --- Effects ---

    spawnExplosion(x, y) {
        const explosion = this.add.image(x, y, 'projectileExplosion')
            .setDisplaySize(EXPLOSION_SIZE, EXPLOSION_SIZE)
            .setDepth(EXPLOSION_DEPTH);
        this.time.delayedCall(EXPLOSION_DURATION, () => explosion.destroy());
    }

    /** Centered overlay text that destroys itself after `duration` ms. */
    showTimedText(message, { y = GAME_HEIGHT / 2, fontSize = '48px', color = '#e8dcc8', duration }) {
        const text = this.add.text(GAME_WIDTH / 2, y, message, {
            fontFamily: FONT_FAMILY,
            fontSize,
            color,
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5).setDepth(OVERLAY_TEXT_DEPTH);
        this.time.delayedCall(duration, () => text.destroy());
        return text;
    }

    // --- Lifecycle ---

    /** Override to release listeners/timers. Game objects are destroyed by Phaser. */
    onShutdown() {
        if (this.inputManager) this.inputManager.destroy();
    }
}
