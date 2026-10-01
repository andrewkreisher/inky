import { inputFromKeys } from '@shared/simulation.js';
import { BaseGameScene } from './BaseGameScene';
import { DrawingManager } from '../managers/DrawingManager';
import { UIManager } from '../managers/UIManager';
import { InputManager } from '../managers/InputManager';
import {
    GAME_WIDTH, GAME_HEIGHT,
    PLAYER_SPRITE_SCALE, PLAYER_DEPTH, PLAYER_SPEED, DEFAULT_LIVES,
    PROJECTILE_SPRITE_SCALE, PROJECTILE_DEPTH, PROJECTILE_SPEED,
    RESAMPLE_STEP, SHOOT_ANIMATION_DURATION,
    INITIAL_PROJECTILE_COUNT, MAX_PROJECTILE_COUNT, PROJECTILE_REGEN_PER_SEC, INK_REGEN_PER_SEC,
    HUD_HEIGHT, HUD_DEPTH, FONT_FAMILY,
} from '../constants';

/**
 * Local projectile simulation for single player. Mirrors the subset of
 * `ProjectileManager` that `UIManager`/`InputManager` depend on
 * (`projectileCount`, `shootProjectile`). Movement is delta-time based so
 * projectiles travel at `PROJECTILE_SPEED` px/s, the same as multiplayer.
 */
class SPProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectileCount = INITIAL_PROJECTILE_COUNT;
        this.projectiles = new Map();
        this.group = null;
        this._nextId = 0;
    }

    createGroups() {
        this.group = this.scene.physics.add.group();
    }

    shootProjectile() {
        const { drawingManager, playerManager, uiManager } = this.scene;
        const player = playerManager.currentPlayer;
        if (this.projectileCount < 1 || !player || drawingManager.drawPath.length < 2) return;

        const worldPath = drawingManager.drawPath.map(p => ({ x: player.x + p.x, y: player.y + p.y }));
        const path = drawingManager.resamplePath(worldPath, RESAMPLE_STEP);
        if (path.length < 2) return;

        player.setTexture('playershoot');
        this.scene.time.delayedCall(SHOOT_ANIMATION_DURATION, () => {
            if (player.active) player.setTexture('player');
        });

        const id = this._nextId++;
        const sprite = this.scene.physics.add.image(path[0].x, path[0].y, 'projectile')
            .setScale(PROJECTILE_SPRITE_SCALE)
            .setDepth(PROJECTILE_DEPTH);
        sprite.path = path;
        sprite.pathIndex = 0;
        sprite.projectileId = id;
        this.projectiles.set(id, sprite);
        this.group.add(sprite);

        this.projectileCount--;
        uiManager.updateProjectileSprites();
        drawingManager.spendPathCost();
        drawingManager.clearPath();
    }

    removeSprite(sprite) {
        this.projectiles.delete(sprite.projectileId);
        this.group.remove(sprite);
        sprite.destroy();
    }

    /** Advance every projectile `PROJECTILE_SPEED * dt` pixels along its path. */
    moveProjectiles(deltaMs) {
        let budget = PROJECTILE_SPEED * (deltaMs / 1000);
        this.projectiles.forEach((sprite) => {
            if (!sprite.active) {
                this.projectiles.delete(sprite.projectileId);
                return;
            }
            let remaining = budget;
            while (remaining > 0 && sprite.pathIndex < sprite.path.length - 1) {
                const target = sprite.path[sprite.pathIndex + 1];
                const dx = target.x - sprite.x;
                const dy = target.y - sprite.y;
                const dist = Math.hypot(dx, dy);
                if (dist <= remaining) {
                    sprite.setPosition(target.x, target.y);
                    sprite.pathIndex++;
                    remaining -= dist;
                } else {
                    sprite.setPosition(sprite.x + (dx / dist) * remaining, sprite.y + (dy / dist) * remaining);
                    remaining = 0;
                }
            }
            if (sprite.pathIndex >= sprite.path.length - 1) {
                this.scene.spawnExplosion(sprite.x, sprite.y);
                this.removeSprite(sprite);
            }
        });
    }

    regenerate(deltaMs) {
        const before = Math.floor(this.projectileCount);
        this.projectileCount = Math.min(
            MAX_PROJECTILE_COUNT,
            this.projectileCount + PROJECTILE_REGEN_PER_SEC * (deltaMs / 1000),
        );
        if (Math.floor(this.projectileCount) !== before) {
            this.scene.uiManager.updateProjectileSprites();
        }
    }
}

/**
 * Single player practice scene: local physics, a static target at the
 * opponent's spawn, no networking.
 *
 * init data: `{ level, onReturnHome }`
 */
export class SinglePlayerScene extends BaseGameScene {
    constructor() {
        super('SinglePlayerScene');
        this.levelData = null;
        this.onReturnHome = null;
        this.enemy = null;
        this.score = 0;
    }

    init(data = {}) {
        this.levelData = data.level ?? this.levelData;
        this.onReturnHome = data.onReturnHome ?? this.onReturnHome;
        this.score = 0;
    }

    create() {
        if (!this.levelData) return;
        super.create();
        this.currentMap = this.levelData.map;

        // Minimal stand-in for PlayerManager: the shared managers only read these.
        this.playerManager = { currentPlayer: null, isSecondPlayer: false };
        this.projectileManager = new SPProjectileManager(this);
        this.drawingManager = new DrawingManager(this);
        this.uiManager = new UIManager(this);
        this.inputManager = new InputManager(this);

        this.drawingManager.init();
        this.rebuildMap();
        this.projectileManager.createGroups();
        this.createPlayer();
        this.createEnemy();
        this.setupPhysics();

        this.uiManager.createUI();
        this.uiManager.updateLives(DEFAULT_LIVES, DEFAULT_LIVES);
        this.uiManager.updateScore(this.score);
        this.inputManager.setupInput();

        this.input.keyboard.on('keydown-ESC', () => {
            if (this.onReturnHome) this.onReturnHome();
        });
        this.add.text(GAME_WIDTH - 10, 10, 'ESC to exit', {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            color: '#8878A8',
        }).setOrigin(1, 0).setDepth(HUD_DEPTH + 1);
    }

    createPlayer() {
        const spawn = this.getSpawnPosition(0);
        const player = this.physics.add.sprite(spawn.x, spawn.y, 'player')
            .setScale(PLAYER_SPRITE_SCALE)
            .setDepth(PLAYER_DEPTH);
        player.setCollideWorldBounds(true);
        this.playerManager.currentPlayer = player;
    }

    createEnemy() {
        const spawn = this.getSpawnPosition(1);
        this.enemy = this.physics.add.sprite(spawn.x, spawn.y, 'player2')
            .setScale(PLAYER_SPRITE_SCALE)
            .setDepth(PLAYER_DEPTH);
        this.enemy.setImmovable(true);
    }

    setupPhysics() {
        const player = this.playerManager.currentPlayer;
        const projectiles = this.projectileManager.group;

        // Keep the player out of the HUD strip.
        this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);

        this.physics.add.collider(player, this.barriers);
        this.physics.add.collider(player, this.nets);
        this.physics.add.collider(player, this.enemy);
        this.physics.add.overlap(projectiles, this.enemy, this.handleProjectileHitEnemy, null, this);
        this.physics.add.overlap(projectiles, this.barriers, this.handleProjectileHitBarrier, null, this);
    }

    // --- Collisions ---

    handleProjectileHitEnemy(projectile, enemy) {
        this.score++;
        this.uiManager.updateScore(this.score);
        this.spawnExplosion(projectile.x, projectile.y);
        this.projectileManager.removeSprite(projectile);

        const spawn = this.getSpawnPosition(1);
        enemy.setPosition(spawn.x, spawn.y);
    }

    handleProjectileHitBarrier(projectile) {
        this.spawnExplosion(projectile.x, projectile.y);
        this.projectileManager.removeSprite(projectile);
    }

    // --- Frame ---

    handlePlayerMovement() {
        const player = this.playerManager.currentPlayer;
        const c = this.cursors;
        if (!player || !c) return;
        const dir = inputFromKeys(c.left.isDown, c.right.isDown, c.up.isDown, c.down.isDown);
        player.setVelocity(dir.x * PLAYER_SPEED, dir.y * PLAYER_SPEED);
    }

    update(_time, delta) {
        if (this.gameover || !this.playerManager) return;
        this.handlePlayerMovement();
        this.projectileManager.moveProjectiles(delta);
        this.projectileManager.regenerate(delta);
        this.drawingManager.regenerate(INK_REGEN_PER_SEC, delta);
        this.drawingManager.redrawPath();
        this.uiManager.updateUI();
    }
}
