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

import { DrawingManager } from '../managers/DrawingManager';
import { UIManager } from '../managers/UIManager';
import { InputManager } from '../managers/InputManager';
import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK,
    MAX_PROJECTILE_COUNT, PROJECTILE_REGEN_RATE, INK_REGEN_RATE,
    EXPLOSION_SIZE, EXPLOSION_DURATION,
    PLAYER_SPRITE_SCALE, PLAYER_DEPTH,
    PROJECTILE_SPRITE_SCALE, PROJECTILE_DEPTH, PROJECTILE_SPEED,
    RESAMPLE_STEP, SHOOT_ANIMATION_DURATION, INITIAL_PROJECTILE_COUNT,
    HUD_HEIGHT, HUD_DEPTH, SP_PLAYER_SPEED,
} from '../constants';

class SPProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectileCount = INITIAL_PROJECTILE_COUNT;
        this.playerProjectiles = new Map();
        this.enemyProjectiles = new Map();
        this.playerProjectilesGroup = null;
        this.enemyProjectilesGroup = null;
        this._idCounter = 0;
    }

    createGroups() {
        this.playerProjectilesGroup = this.scene.physics.add.group();
        this.enemyProjectilesGroup = this.scene.physics.add.group();
    }

    shootProjectile() {
        const dm = this.scene.drawingManager;
        if (dm.drawPath.length > 1 && this.projectileCount > 0) {
            const cp = this.scene.playerManager.currentPlayer;
            const worldPath = dm.drawPath.map(p => ({
                x: cp.x + p.x,
                y: cp.y + p.y,
            }));
            const resampled = dm.resamplePath(worldPath, RESAMPLE_STEP);
            if (resampled.length > 1) {
                cp.setTexture('playershoot');
                this.scene.time.delayedCall(SHOOT_ANIMATION_DURATION, () => {
                    if (cp && cp.active) cp.setTexture('player');
                });

                const id = `sp_${this._idCounter++}`;
                const proj = this.scene.physics.add.image(
                    resampled[0].x, resampled[0].y, 'projectile'
                ).setScale(PROJECTILE_SPRITE_SCALE).setDepth(PROJECTILE_DEPTH);
                proj.path = resampled;
                proj.pathIndex = 0;
                proj.projectileId = id;

                this.playerProjectiles.set(id, proj);
                this.playerProjectilesGroup.add(proj);

                this.projectileCount--;
                this.scene.uiManager.updateProjectileSprites();
                dm.graphics.clear();
            }
        }
    }

    moveProjectiles() {
        this.playerProjectiles.forEach((proj, id) => {
            if (!proj || !proj.active) {
                this.playerProjectiles.delete(id);
                return;
            }
            if (proj.path && proj.pathIndex < proj.path.length - 1) {
                const target = proj.path[proj.pathIndex + 1];
                const angle = Phaser.Math.Angle.Between(proj.x, proj.y, target.x, target.y);
                proj.x += Math.cos(angle) * PROJECTILE_SPEED;
                proj.y += Math.sin(angle) * PROJECTILE_SPEED;
                if (Phaser.Math.Distance.Between(proj.x, proj.y, target.x, target.y) < PROJECTILE_SPEED) {
                    proj.pathIndex++;
                }
            } else {
                this.playerProjectilesGroup.remove(proj);
                proj.destroy();
                this.playerProjectiles.delete(id);
            }
        });
    }
}

export class SinglePlayerScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SinglePlayerScene' });
        this.levelData = null;
        this.gameover = false;
        this.score = 0;
    }

    init(data) {
        if (data && data.level) {
            this.levelData = data.level;
        }
        this.gameover = false;
        this.score = 0;
    }

    preload() {
        this.load.image('player', playerImage);
        this.load.image('player2', player2Image);
        this.load.image('dark_background', darkBackgroundImage);
        this.load.image('barrier', barrierImage);
        this.load.image('projectile', projectileImage);
        this.load.image('projectile2', projectile2Image);
        this.load.image('playershoot', playerShootImage);
        this.load.image('player2shoot', player2ShootImage);
        this.load.image('projectileExplosion', projectileExplosion);
        this.load.image('net', netImage);
    }

    create() {
        if (!this.levelData) return;

        this.currentMap = this.levelData.map;

        // Minimal player manager adapter (no socket needed)
        this.playerManager = {
            currentPlayer: null,
            isSecondPlayer: false,
            invincibilityTweens: new Map(),
            stopInvincibilityAnimation() {},
        };

        this.projectileManager = new SPProjectileManager(this);
        this.drawingManager = new DrawingManager(this);
        this.uiManager = new UIManager(this);
        this.inputManager = new InputManager(this);

        // Background
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'dark_background')
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

        this.drawingManager.init();

        // Build map
        this.barriers = this.physics.add.staticGroup();
        this.nets = this.physics.add.staticGroup();
        if (this.currentMap.barriers) {
            this.currentMap.barriers.forEach(b => {
                const barrier = this.barriers.create(b.x, b.y, 'barrier');
                barrier.setSize(b.width, b.height);
                barrier.setDisplaySize(b.width, b.height);
                barrier.setDepth(0.5);
                barrier.refreshBody();
            });
        }
        if (this.currentMap.nets) {
            this.currentMap.nets.forEach(n => {
                const net = this.nets.create(n.x, n.y, 'net');
                net.setSize(n.width, n.height);
                net.setDisplaySize(n.width, n.height);
                net.setDepth(0.5);
                net.refreshBody();
            });
        }

        this.projectileManager.createGroups();

        // Create player at first spawn point
        const spawn = this.currentMap.playerSpawnScale[0];
        const player = this.physics.add.sprite(
            GAME_WIDTH * spawn[0], GAME_HEIGHT * spawn[1], 'player'
        ).setScale(PLAYER_SPRITE_SCALE).setDepth(PLAYER_DEPTH);
        player.setCollideWorldBounds(true);
        player.lives = 1;
        this.playerManager.currentPlayer = player;

        // Create static enemy at second spawn point
        const enemySpawn = this.currentMap.playerSpawnScale[1];
        this.enemy = this.physics.add.sprite(
            GAME_WIDTH * enemySpawn[0], GAME_HEIGHT * enemySpawn[1], 'player2'
        ).setScale(PLAYER_SPRITE_SCALE).setDepth(PLAYER_DEPTH);
        this.enemy.setImmovable(true);

        // Physics collisions
        this.physics.add.collider(player, this.barriers);
        this.physics.add.collider(player, this.nets);
        this.physics.add.collider(player, this.enemy);
        this.physics.add.overlap(
            this.projectileManager.playerProjectilesGroup,
            this.enemy,
            this.handleProjectileHitEnemy,
            null,
            this
        );
        this.physics.add.overlap(
            this.projectileManager.playerProjectilesGroup,
            this.barriers,
            this.handleProjectileHitBarrier,
            null,
            this
        );

        // World bounds exclude HUD area at bottom
        this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);

        this.uiManager.createUI();
        this.inputManager.setupInput();

        // Explosion effects
        this.events.on('projectileDestroyed', (x, y) => {
            const explosion = this.add.image(x, y, 'projectileExplosion')
                .setDisplaySize(EXPLOSION_SIZE, EXPLOSION_SIZE).setDepth(100);
            this.time.delayedCall(EXPLOSION_DURATION, () => explosion.destroy());
        });

        // ESC to exit
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.game.onReturnHome) this.game.onReturnHome();
        });

        this.add.text(GAME_WIDTH - 10, 10, 'ESC to exit', {
            fontFamily: 'Silkscreen',
            fontSize: '12px',
            color: '#8878A8',
        }).setOrigin(1, 0).setDepth(HUD_DEPTH + 1);

        this.events.on('update', this.update, this);
    }

    handleProjectileHitEnemy(projectile, enemy) {
        this.score++;
        this.uiManager.updateScore(this.score);
        this.events.emit('projectileDestroyed', projectile.x, projectile.y);
        this.projectileManager.playerProjectilesGroup.remove(projectile);
        this.projectileManager.playerProjectiles.delete(projectile.projectileId);
        projectile.destroy();

        // Respawn enemy at its spawn point
        const spawn = this.currentMap.playerSpawnScale[1];
        enemy.setPosition(GAME_WIDTH * spawn[0], GAME_HEIGHT * spawn[1]);
    }

    handleProjectileHitBarrier(projectile) {
        this.events.emit('projectileDestroyed', projectile.x, projectile.y);
        this.projectileManager.playerProjectilesGroup.remove(projectile);
        this.projectileManager.playerProjectiles.delete(projectile.projectileId);
        projectile.destroy();
    }

    handlePlayerMovement() {
        const player = this.playerManager.currentPlayer;
        if (!player || !this.cursors) return;

        let vx = 0, vy = 0;
        if (this.cursors.left.isDown) vx = -SP_PLAYER_SPEED;
        else if (this.cursors.right.isDown) vx = SP_PLAYER_SPEED;
        if (this.cursors.up.isDown) vy = -SP_PLAYER_SPEED;
        else if (this.cursors.down.isDown) vy = SP_PLAYER_SPEED;

        player.setVelocity(vx, vy);
    }

    update() {
        if (this.gameover) return;

        this.handlePlayerMovement();

        if (this.playerManager.currentPlayer && this.playerManager.currentPlayer.active) {
            this.projectileManager.moveProjectiles();
            this.drawingManager.redrawPath();
            this.uiManager.updateUI();
        }

        const oldCount = Math.floor(this.projectileManager.projectileCount);
        this.projectileManager.projectileCount = Math.min(
            this.projectileManager.projectileCount + PROJECTILE_REGEN_RATE,
            MAX_PROJECTILE_COUNT
        );
        if (Math.floor(this.projectileManager.projectileCount) !== oldCount) {
            this.uiManager.updateProjectileSprites();
        }

        if (!this.drawingManager.isDrawing) {
            this.drawingManager.currentInk = Math.min(
                this.drawingManager.currentInk + INK_REGEN_RATE,
                MAX_INK
            );
        }
    }

    shutdown() {
        if (this.inputManager) this.inputManager.destroy();
        this.cleanupScene();
        super.shutdown();
    }

    cleanupScene() {
        if (this.drawingManager && this.drawingManager.graphics) this.drawingManager.graphics.clear();
        if (this.uiManager) {
            if (this.uiManager.inkBar) this.uiManager.inkBar.clear();
            if (this.uiManager.barBackground) this.uiManager.barBackground.clear();
            if (this.uiManager.inkBarBorder) this.uiManager.inkBarBorder.clear();
            if (this.uiManager.hudPanel) this.uiManager.hudPanel.clear();
        }

        if (this.projectileManager) {
            if (this.projectileManager.playerProjectilesGroup) {
                this.projectileManager.playerProjectilesGroup.destroy(true);
                this.projectileManager.playerProjectilesGroup = null;
            }
            if (this.projectileManager.enemyProjectilesGroup) {
                this.projectileManager.enemyProjectilesGroup.destroy(true);
                this.projectileManager.enemyProjectilesGroup = null;
            }
            this.projectileManager.playerProjectiles.forEach(p => p.destroy());
            this.projectileManager.playerProjectiles.clear();
        }

        if (this.playerManager && this.playerManager.currentPlayer) {
            this.playerManager.currentPlayer.destroy();
            this.playerManager.currentPlayer = null;
        }
        if (this.enemy) {
            this.enemy.destroy();
            this.enemy = null;
        }
    }
}
