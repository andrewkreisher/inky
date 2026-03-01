import playerImage from '../../assets/player.png';
import player2Image from '../../assets/player2.png';
import darkBackgroundImage from '../../assets/inkybackground.png';
import barrierImage from '../../assets/woodbarrier.png';
import netImage from '../../assets/net.png';
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
import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK, INITIAL_INK,
    MAX_PROJECTILE_COUNT, PROJECTILE_REGEN_RATE, INK_REGEN_RATE,
    EXPLOSION_SIZE, EXPLOSION_DURATION, ROUND_TEXT_DURATION,
    COUNTDOWN_SECONDS,
} from '../constants';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.socket = null;
        this.gameover = false;
        this.currentRound = 1;
        this.currentMap = null;
        this.roundText = null;
        this.roundTransitioning = false;
        this.countdownText = null;
        this.transitionText = null;
    }

    init(data) {
        if (data && data.game) {
            this.gameId = data.game.id;
        }
        this.socket = this.game.socket;
        this.gameover = false;
        this.currentRound = 1;
        this.currentMap = null;
        this.roundText = null;
        this.roundTransitioning = false;
        this.countdownText = null;
        this.transitionText = null;
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
        this.load.image('net', netImage);
    }

    create() {
        this.playerManager = new PlayerManager(this);
        this.projectileManager = new ProjectileManager(this);
        this.uiManager = new UIManager(this);
        this.inputManager = new InputManager(this);
        this.socketManager = new SocketManager(this);
        this.drawingManager = new DrawingManager(this);

        this.createBackground();
        this.drawingManager.init();
        this.rebuildMap();

        this.projectileManager.createGroups();
        this.playerManager.createGroups();
        this.playerManager.createCurrentPlayer();
        this.projectileManager.setupCollisions();

        this.uiManager.createUI();
        this.inputManager.setupInput();
        this.socketManager.connectToServer();

        // Listen for map/round events BEFORE connecting/requesting state
        // Store handler references so they can be properly cleaned up
        this._onMapSelected = ({ round, map }) => {
            this.currentRound = round;
            this.currentMap = map;
            this.rebuildMap();
            this.showRoundText();
        };
        this._onRoundEnded = () => {
            this.roundTransitioning = true;
            this.showTransitionText('Point!');
        };
        this._onMatchEnded = ({ totalRounds, winnerId, scores }) => {
            this.handleMatchEnded(winnerId, scores);
        };
        this._onRematchStarted = () => {
            this.resetForRematch();
        };
        this._onCountdownStart = () => {
            this.clearTransitionText();
            this.startCountdown();
        };
        this._onCountdownEnd = () => {
            this.roundTransitioning = false;
            this.clearCountdownText();
        };
        this.socket.on('mapSelected', this._onMapSelected);
        this.socket.on('roundEnded', this._onRoundEnded);
        this.socket.on('matchEnded', this._onMatchEnded);
        this.socket.on('rematchStarted', this._onRematchStarted);
        this.socket.on('countdownStart', this._onCountdownStart);
        this.socket.on('countdownEnd', this._onCountdownEnd);

        this.events.on('update', this.update, this);
        this.events.on('projectileDestroyed', (x, y) => {
            const explosion = this.add.image(x, y, 'projectileExplosion').setDisplaySize(EXPLOSION_SIZE, EXPLOSION_SIZE).setDepth(100);
            this.time.delayedCall(EXPLOSION_DURATION, () => {
                explosion.destroy();
            });
        });
    }

    createBackground() {
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'dark_background').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    }

    createBarrierGroup() {
        if (this.barriers) {
            this.barriers.clear(true, true);
            this.barriers.destroy(true);
        }
        this.barriers = this.physics.add.staticGroup();
    }

    createNetGroup() {
        if (this.nets) {
            this.nets.clear(true, true);
            this.nets.destroy(true);
        }
        this.nets = this.physics.add.staticGroup();
    }

    rebuildMap() {
        if (!this.barriers) this.createBarrierGroup();
        if (!this.nets) this.createNetGroup();
        this.barriers.clear(true, true);
        this.nets.clear(true, true);
        if (this.currentMap && this.currentMap.barriers) {
            this.currentMap.barriers.forEach(b => {
                const barrier = this.barriers.create(b.x, b.y, 'barrier');
                barrier.setSize(b.width, b.height);
                barrier.setDisplaySize(b.width, b.height);
                barrier.setDepth(0.5);
                barrier.setAlpha(1);
                barrier.refreshBody();
            });
        }
        if (this.currentMap && this.currentMap.nets) {
            this.currentMap.nets.forEach(n => {
                const net = this.nets.create(n.x, n.y, 'net');
                net.setSize(n.width, n.height);
                net.setDisplaySize(n.width, n.height);
                net.setDepth(0.5);
                net.setAlpha(1);
                net.refreshBody();
            });
        }
    }

    showRoundText() {
        if (this.roundText) {
            this.roundText.destroy();
        }
        this.roundText = this.add.text(GAME_WIDTH / 2, 40, `Round ${this.currentRound}`, { fontSize: '28px', fill: '#fff' }).setOrigin(0.5);
        this.time.delayedCall(ROUND_TEXT_DURATION, () => {
            if (this.roundText) this.roundText.destroy();
            this.roundText = null;
        });
    }

    showTransitionText(message) {
        this.clearTransitionText();
        this.transitionText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
            fontSize: '64px', fill: '#fff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(200);
    }

    clearTransitionText() {
        if (this.transitionText) {
            this.transitionText.destroy();
            this.transitionText = null;
        }
    }

    startCountdown() {
        this.roundTransitioning = true;
        let remaining = COUNTDOWN_SECONDS;
        this.clearCountdownText();
        this.countdownText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${remaining}`, {
            fontSize: '80px', fill: '#fff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(200);

        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            repeat: COUNTDOWN_SECONDS - 1,
            callback: () => {
                remaining--;
                if (this.countdownText) {
                    this.countdownText.setText(remaining > 0 ? `${remaining}` : 'GO!');
                }
                if (remaining <= 0 && this.countdownText) {
                    this.time.delayedCall(400, () => this.clearCountdownText());
                }
            },
        });
    }

    clearCountdownText() {
        if (this.countdownText) {
            this.countdownText.destroy();
            this.countdownText = null;
        }
        if (this.countdownTimer) {
            this.countdownTimer.destroy();
            this.countdownTimer = null;
        }
    }

    handleMatchEnded(winnerId, scores) {
        this.gameover = true;
        this.physics.pause();
        this.uiManager.gameEnded = true;
    }

    resetForRematch() {
        this.gameover = false;
        this.roundTransitioning = false;
        this.currentRound = 1;
        this.currentMap = null;
        this.clearTransitionText();
        this.clearCountdownText();
        this.physics.resume();
        this.uiManager.gameEnded = false;

        // Clear invincibility
        this.playerManager.invincibilityTweens.forEach(tween => tween.stop());
        this.playerManager.invincibilityTweens.clear();
        if (this.playerManager.currentPlayer) {
            this.playerManager.currentPlayer.alpha = 1;
        }

        // Clear other players
        this.playerManager.otherPlayers.forEach(p => p.destroy());
        this.playerManager.otherPlayers.clear();

        // Clear projectiles
        this.projectileManager.playerProjectiles.forEach(p => p.destroy());
        this.projectileManager.enemyProjectiles.forEach(p => p.destroy());
        this.projectileManager.playerProjectiles.clear();
        this.projectileManager.enemyProjectiles.clear();
        this.projectileManager.projectileCount = MAX_PROJECTILE_COUNT;
        this.uiManager.updateProjectileSprites();

        // Clear drawing
        this.drawingManager.drawPath = [];
        this.drawingManager.graphics.clear();
        this.drawingManager.currentInk = INITIAL_INK;

        // Clear barriers and nets
        if (this.barriers) this.barriers.clear(true, true);
        if (this.nets) this.nets.clear(true, true);

        // Reset UI
        this.uiManager.updateScore(0);
        this.uiManager.updateLifeSprites();
        if (this.roundText) {
            this.roundText.destroy();
            this.roundText = null;
        }

        // Request fresh game state from server
        this.socket.emit('requestGameState', this.gameId);
    }

    update() {
        if (this.gameover || this.roundTransitioning) return;
        this.playerManager.handlePlayerMovement();
        if (this.playerManager.currentPlayer && this.playerManager.currentPlayer.active) {
            this.projectileManager.moveProjectiles();
            this.drawingManager.redrawPath();
            this.uiManager.updateUI();
        }

        const oldProjectileCount = Math.floor(this.projectileManager.projectileCount);
        this.projectileManager.projectileCount = Math.min(this.projectileManager.projectileCount + PROJECTILE_REGEN_RATE, MAX_PROJECTILE_COUNT);
        if (Math.floor(this.projectileManager.projectileCount) !== oldProjectileCount) {
            this.uiManager.updateProjectileSprites();
        }

        if (!this.drawingManager.isDrawing) {
            this.drawingManager.currentInk = Math.min(this.drawingManager.currentInk + INK_REGEN_RATE, MAX_INK);
        }
    }

    shutdown() {
        if (this.inputManager) this.inputManager.destroy();
        this.cleanupScene();
        super.shutdown();
    }

    cleanupScene() {
        this.clearTransitionText();
        this.clearCountdownText();

        this.playerManager.invincibilityTweens.forEach(tween => tween.stop());
        this.playerManager.invincibilityTweens.clear();

        if (this.drawingManager.graphics) this.drawingManager.graphics.clear();
        if (this.uiManager.inkBar) this.uiManager.inkBar.clear();
        if (this.uiManager.barBackground) this.uiManager.barBackground.clear();

        if (this.socket) {
            this.socket.off('gameState', this.socketManager._onGameState);
            this.socket.off('newProjectile', this.socketManager._onNewProjectile);
            this.socket.off('playerDisconnected', this.socketManager._onPlayerDisconnected);
            this.socket.off('pointScored', this.socketManager._onPointScored);
            this.socket.off('mapSelected', this._onMapSelected);
            this.socket.off('roundEnded', this._onRoundEnded);
            this.socket.off('matchEnded', this._onMatchEnded);
            this.socket.off('rematchStarted', this._onRematchStarted);
            this.socket.off('countdownStart', this._onCountdownStart);
            this.socket.off('countdownEnd', this._onCountdownEnd);
        }

        if (this.projectileManager.playerProjectilesGroup) {
            this.projectileManager.playerProjectilesGroup.destroy(true);
            this.projectileManager.playerProjectilesGroup = null;
        }
        if (this.projectileManager.enemyProjectilesGroup) {
            this.projectileManager.enemyProjectilesGroup.destroy(true);
            this.projectileManager.enemyProjectilesGroup = null;
        }

        this.projectileManager.playerProjectiles.forEach(p => p.destroy());
        this.projectileManager.enemyProjectiles.forEach(p => p.destroy());
        this.projectileManager.playerProjectiles.clear();
        this.projectileManager.enemyProjectiles.clear();

        this.playerManager.otherPlayers.forEach(p => p.destroy());
        this.playerManager.otherPlayers.clear();

        if (this.playerManager.currentPlayer) {
            this.playerManager.currentPlayer.destroy();
            this.playerManager.currentPlayer = null;
        }
    }
}
