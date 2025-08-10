import playerImage from '../../assets/player.png';
import player2Image from '../../assets/player2.png';
import darkBackgroundImage from '../../assets/inkybackground.png';
import barrierImage from '../../assets/woodbarrier.png';
import projectileImage from '../../assets/projectile.png';
import projectile2Image from '../../assets/projectile2.png';
import playerShootImage from '../../assets/playershoot.png';
import player2ShootImage from '../../assets/player2shoot.png';
import inkbarImage from '../../assets/inkbar.png';
import projectileExplosion from '../../assets/projectileexplosion.png';

import { PlayerManager } from '../managers/PlayerManager';
import { ProjectileManager } from '../managers/ProjectileManager';
import { UIManager } from '../managers/UIManager';
import { InputManager } from '../managers/InputManager';
import { SocketManager } from '../managers/SocketManager';
import { DrawingManager } from '../managers/DrawingManager';
import { GAME_WIDTH, GAME_HEIGHT, MAX_INK, MIN_PATH_LENGTH } from '../constants';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.currentPlayer = null;
        this.otherPlayers = new Map();
        this.otherPlayersGroup = null;
        this.playerProjectiles = new Map();
        this.enemyProjectiles = new Map();
        this.playerProjectilesGroup = null;
        this.enemyProjectilesGroup = null;
        this.currentInk = 200;
        this.projectileCount = 5;
        this.checkedPlayer = false;
        this.isSecondPlayer = false;
        this.assetsLoaded = false;
        this.socket = null;
        this.gameover = false;

        this.MAX_INK = MAX_INK;
        this.MIN_PATH_LENGTH = MIN_PATH_LENGTH;

        this.currentRound = 1;
        this.currentMap = null;
        this.roundText = null;
    }

    init(data) {
        if (data && data.game) {
            this.gameId = data.game.id;
        }
        this.socket = this.game.socket;
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
        this.load.image('inkbar', inkbarImage);
        this.load.image('projectileExplosion', projectileExplosion);
    }

    create() {
        this.playerManager = new PlayerManager(this);
        this.projectileManager = new ProjectileManager(this);
        this.uiManager = new UIManager(this);
        this.inputManager = new InputManager(this);
        this.socketManager = new SocketManager(this);
        this.drawingManager = new DrawingManager(this);

        this.createBackground();
        this.createBarrierGroup();
        // Build fallback barrier immediately; real map will rebuild upon event
        this.rebuildMap();

        this.playerProjectilesGroup = this.physics.add.group();
        this.enemyProjectilesGroup = this.physics.add.group();
        this.otherPlayersGroup = this.physics.add.group();

        this.physics.add.overlap(this.playerProjectilesGroup, this.enemyProjectilesGroup, (p1, p2) => {
            if (p1.collided || p2.collided) return;
            if (p1.active && p2.active) {
                p1.collided = true;
                p2.collided = true;
                this.socket.emit('projectileCollision', {
                    gameId: this.gameId,
                    projectile1Id: p1.projectileId,
                    projectile2Id: p2.projectileId,
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2
                });
                const explosionX = (p1.x + p2.x) / 2;
                const explosionY = (p1.y + p2.y) / 2;
                this.playerProjectilesGroup.remove(p1);
                this.enemyProjectilesGroup.remove(p2);
                p1.destroy();
                p2.destroy();
            }
        }, null, this);

        // Projectiles vs barriers
        this.physics.add.overlap(this.playerProjectilesGroup, this.barriers, (projectile, barrier) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                const explosionX = projectile.x;
                const explosionY = projectile.y;
                this.playerProjectilesGroup.remove(projectile);
                projectile.destroy();
            }
        }, null, this);

        this.physics.add.overlap(this.enemyProjectilesGroup, this.barriers, (projectile, barrier) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                const explosionX = projectile.x;
                const explosionY = projectile.y;
                this.enemyProjectilesGroup.remove(projectile);
                projectile.destroy();
            }
        }, null, this);

        // Projectile vs players (client-side visuals only)
        this.physics.add.overlap(this.playerProjectilesGroup, this.otherPlayersGroup, (projectile, player) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                const explosionX = projectile.x;
                const explosionY = projectile.y;
                this.playerProjectilesGroup.remove(projectile);
                projectile.destroy();
            }
        }, null, this);

        this.playerManager.createCurrentPlayer();
        // Register overlap with current player after it is created
        this.physics.add.overlap(this.enemyProjectilesGroup, this.currentPlayer, (projectile, player) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                const explosionX = projectile.x;
                const explosionY = projectile.y;
                projectile.destroy();
                this.enemyProjectilesGroup.remove(projectile);
            }
        }, null, this);

        this.uiManager.createUI();
        this.inputManager.setupInput();
        this.socketManager.connectToServer();

        // Listen for map/round events BEFORE connecting/requesting state
        this.socket.on('mapSelected', ({ round, map }) => {
            console.log('[client] mapSelected:', map?.id, 'round', round);
            this.currentRound = round;
            this.currentMap = map;
            this.rebuildMap();
            this.showRoundText();
        });
        this.socket.on('roundEnded', ({ round, nextRound, map }) => {
            console.log('[client] roundEnded:', round, '->', nextRound, 'nextMap', map?.id);
            // no-op for now; mapSelected will handle rebuild
        });
        this.socket.on('matchEnded', ({ totalRounds, winnerId, scores }) => {
            console.log('[client] matchEnded winner:', winnerId);
            this.handleMatchEnded(winnerId, scores);
        });

        this.events.on('update', this.update, this);
        this.events.on('projectileDestroyed', (x, y) => {
            const explosion = this.add.image(x, y, 'projectileExplosion').setDisplaySize(80, 80).setDepth(100);
            this.time.delayedCall(200, () => {
                explosion.destroy();
            });
        });
    }

    createBackground() {
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'dark_background').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
        this.graphics = this.add.graphics();
    }

    createBarrierGroup() {
        if (this.barriers) {
            this.barriers.clear(true, true);
            this.barriers.destroy(true);
        }
        this.barriers = this.physics.add.staticGroup();
    }

    rebuildMap() {
        if (!this.barriers) this.createBarrierGroup();
        this.barriers.clear(true, true);
        if (this.currentMap && this.currentMap.barriers) {
            this.currentMap.barriers.forEach(b => {
                const barrier = this.barriers.create(b.x, b.y, 'barrier');
                barrier.setSize(b.width, b.height);
                barrier.setDisplaySize(b.width, b.height);
                barrier.setDepth(0.5);
                barrier.setAlpha(1);
                barrier.refreshBody();
            });
        } else {
            // Fallback to legacy single barrier if map not received yet
            const barrier = this.barriers.create(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'barrier');
            barrier.setSize(100, 300);
            barrier.setDisplaySize(100, 300);
            barrier.setDepth(0.5);
            barrier.setAlpha(1);
            barrier.refreshBody();
        }
    }

    showRoundText() {
        if (this.roundText) {
            this.roundText.destroy();
        }
        this.roundText = this.add.text(GAME_WIDTH / 2, 40, `Round ${this.currentRound}`, { fontSize: '28px', fill: '#fff' }).setOrigin(0.5);
        this.time.delayedCall(1500, () => {
            if (this.roundText) this.roundText.destroy();
            this.roundText = null;
        });
    }

    handleMatchEnded(winnerId, scores) {
        this.gameover = true;
        this.physics.pause();

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        overlay.setDepth(10);

        const isWinner = winnerId === this.game.socket.id;
        const title = isWinner ? 'You Win!' : 'You Lose';
        const resultText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, title, {
            fontSize: '56px', fill: '#fff', fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(11);

        const scoreLines = scores.map(s => `${s.id === this.game.socket.id ? 'You' : 'Opponent'}: ${s.score}`).join('\n');
        const scoresText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, scoreLines, {
            fontSize: '28px', fill: '#fff', fontFamily: 'Arial', align: 'center'
        }).setOrigin(0.5).setDepth(11);

        const backButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, 'Back to Lobby', {
            fontSize: '32px', fill: '#00bfff', fontFamily: 'Arial'
        }).setOrigin(0.5).setInteractive().setDepth(11);

        backButton.on('pointerdown', () => {
            window.location.href = '/';
        });
        backButton.on('pointerover', () => backButton.setStyle({ fill: '#1e90ff' }));
        backButton.on('pointerout', () => backButton.setStyle({ fill: '#00bfff' }));
    }

    update() {
        if (this.gameover) return;
        this.playerManager.handlePlayerMovement();
        if (this.currentPlayer && this.currentPlayer.active) {
            this.projectileManager.moveProjectiles();
            this.drawingManager.redrawPath();
            this.uiManager.updateUI();
        }

        const oldProjectileCount = Math.floor(this.projectileCount);
        this.projectileCount = Math.min(this.projectileCount + 0.001, 10);
        if (Math.floor(this.projectileCount) !== oldProjectileCount) {
            this.uiManager.updateProjectileSprites();
        }

        if (!this.drawingManager.isDrawing) {
            this.currentInk = Math.min(this.currentInk + 0.4, this.MAX_INK);
        }
    }

    shutdown() {
        window.removeEventListener('mouseout', this.drawingManager.stopDrawing);
        this.cleanupScene();
        super.shutdown();
    }

    cleanupScene() {
        this.playerManager.invincibilityTweens.forEach(tween => tween.stop());
        this.playerManager.invincibilityTweens.clear();

        if (this.graphics) this.graphics.clear();
        if (this.uiManager.inkBar) this.uiManager.inkBar.clear();
        if (this.uiManager.barBackground) this.uiManager.barBackground.clear();

        if (this.socket) {
            this.socket.off('gameState', this.socketManager.handleGameState);
            this.socket.off('newProjectile', this.projectileManager.handleNewProjectile);
            this.socket.off('playerDisconnected', this.uiManager.handlePlayerDisconnected);
            this.socket.off('pointScored', this.socketManager.resetMap);
            this.socket.off('mapSelected');
            this.socket.off('roundEnded');
            this.socket.off('matchEnded');
        }

        if (this.playerProjectilesGroup) {
            this.playerProjectilesGroup.destroy(true);
            this.playerProjectilesGroup = null;
        }
        if (this.enemyProjectilesGroup) {
            this.enemyProjectilesGroup.destroy(true);
            this.enemyProjectilesGroup = null;
        }

        this.playerProjectiles.forEach(p => p.destroy());
        this.enemyProjectiles.forEach(p => p.destroy());
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();

        this.otherPlayers.forEach(p => p.destroy());
        this.otherPlayers.clear();

        if (this.currentPlayer) {
            this.currentPlayer.destroy();
            this.currentPlayer = null;
        }
    }
}