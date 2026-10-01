import { BaseGameScene } from './BaseGameScene';
import { PlayerManager } from '../managers/PlayerManager';
import { ProjectileManager } from '../managers/ProjectileManager';
import { UIManager } from '../managers/UIManager';
import { InputManager } from '../managers/InputManager';
import { SocketManager } from '../managers/SocketManager';
import { DrawingManager } from '../managers/DrawingManager';
import {
    GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, OVERLAY_TEXT_DEPTH,
    ROUND_TEXT_DURATION, COUNTDOWN_DURATION, SCORED_TEXT_DURATION,
} from '../constants';

const COUNTDOWN_SECONDS = Math.round(COUNTDOWN_DURATION / 1000);

/**
 * Multiplayer scene — composition root for the managers.
 *
 * The server is authoritative for everything. The client predicts its own
 * movement (PlayerManager), interpolates everything else from snapshots, and
 * mirrors server-owned ink/ammo in the HUD.
 *
 * init data: `{ gameId, socket }`
 */
export class MainScene extends BaseGameScene {
    constructor() {
        super('MainScene');
        this.gameId = null;
        this.socket = null;
        this.usernames = {};
        this.currentRound = 1;
        this.totalRounds = 0; // learned from the first snapshot
        this.roundTransitioning = false;
        this.roundText = null;
        this.countdownText = null;
        this.countdownTimer = null;
    }

    init(data = {}) {
        this.gameId = data.gameId ?? this.gameId;
        this.socket = data.socket ?? this.socket;
        this.usernames = data.usernames ?? this.usernames ?? {};
    }

    create() {
        super.create();

        this.playerManager = new PlayerManager(this);
        this.projectileManager = new ProjectileManager(this);
        this.uiManager = new UIManager(this);
        this.inputManager = new InputManager(this);
        this.socketManager = new SocketManager(this);
        this.drawingManager = new DrawingManager(this);

        this.drawingManager.init();
        // Server pauses ink regen while we draw.
        this.drawingManager.onDrawingStateChanged = (drawing) => {
            this.socket.emit('drawingState', { gameId: this.gameId, drawing });
        };

        this.uiManager.createUI();
        this.inputManager.setupInput();

        this.registerSocketListeners();
        this.socketManager.registerListeners();

        // Round 1's mapSelected/countdownStart fire before this scene exists,
        // so show them directly here.
        this.roundTransitioning = true;
        this.showRoundText();
        this.showCountdown();
    }

    // --- Socket events owned by the scene (round/match flow) ---

    registerSocketListeners() {
        this._onMapSelected = ({ round, map }) => {
            const roundChanged = round !== this.currentRound;
            this.currentRound = round;
            this.currentMap = map;
            this.rebuildMap();
            if (roundChanged) this.showRoundText();
        };
        this._onMatchEnded = () => this.freeze();
        this._onCountdownStart = () => {
            this.roundTransitioning = true;
            this.showCountdown();
        };
        this._onCountdownEnd = () => {
            this.roundTransitioning = false;
        };
        this._onPlayerDisconnected = () => this.freeze();
        this._onRematchStarted = ({ round, map }) => this.handleRematchStarted(round, map);

        this.socket.on('mapSelected', this._onMapSelected);
        this.socket.on('matchEnded', this._onMatchEnded);
        this.socket.on('countdownStart', this._onCountdownStart);
        this.socket.on('countdownEnd', this._onCountdownEnd);
        this.socket.on('playerDisconnected', this._onPlayerDisconnected);
        this.socket.on('rematchStarted', this._onRematchStarted);
    }

    unregisterSocketListeners() {
        if (!this.socket) return;
        this.socket.off('mapSelected', this._onMapSelected);
        this.socket.off('matchEnded', this._onMatchEnded);
        this.socket.off('countdownStart', this._onCountdownStart);
        this.socket.off('countdownEnd', this._onCountdownEnd);
        this.socket.off('playerDisconnected', this._onPlayerDisconnected);
        this.socket.off('rematchStarted', this._onRematchStarted);
    }

    // --- Round / match flow ---

    /** `pointScored`: a round just ended; clear local round state. */
    onPointScored(scorerName) {
        this.roundTransitioning = true;
        this.projectileManager.clearAll();
        this.drawingManager.cancelDrawing();
        this.drawingManager.clearPath();
        this.playerManager.resetPrediction();
        this.playerManager.stopAllInvincibilityAnimations();
        if (scorerName) {
            this.showTimedText(`${scorerName} scored!`, { color: '#68A878', duration: SCORED_TEXT_DURATION });
        }
    }

    /** Both players accepted a rematch: un-freeze and reset to round 1. */
    handleRematchStarted(round, map) {
        this.gameover = false;
        this.currentRound = round;
        this.currentMap = map;
        this.rebuildMap();
        this.onPointScored(null);
        this.showRoundText();
    }

    /** Match over or opponent left: the React overlay takes it from here. */
    freeze() {
        this.gameover = true;
        this.drawingManager.cancelDrawing();
    }

    showRoundText() {
        if (this.roundText) this.roundText.destroy();
        const label = this.totalRounds ? `Round ${this.currentRound} / ${this.totalRounds}` : `Round ${this.currentRound}`;
        this.roundText = this.showTimedText(label, {
            y: GAME_HEIGHT / 2 - 80,
            fontSize: '36px',
            duration: ROUND_TEXT_DURATION,
        });
    }

    showCountdown() {
        if (this.countdownTimer) this.countdownTimer.remove();
        if (this.countdownText) this.countdownText.destroy();

        let count = COUNTDOWN_SECONDS;
        this.countdownText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${count}`, {
            fontFamily: FONT_FAMILY,
            fontSize: '72px',
            color: '#e8dcc8',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5).setDepth(OVERLAY_TEXT_DEPTH);

        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            repeat: COUNTDOWN_SECONDS,
            callback: () => {
                count--;
                if (count > 0) {
                    this.countdownText.setText(`${count}`);
                } else if (count === 0) {
                    this.countdownText.setText('Go!');
                } else {
                    this.countdownText.destroy();
                    this.countdownText = null;
                    this.countdownTimer = null;
                }
            },
        });
    }

    // --- Frame ---

    update(_time, delta) {
        const now = performance.now();
        this.playerManager.update(delta, now);
        this.projectileManager.update(now);
        if (!this.gameover) {
            this.drawingManager.redrawPath();
            this.uiManager.updateUI();
        }
    }

    onShutdown() {
        super.onShutdown();
        this.unregisterSocketListeners();
        if (this.socketManager) this.socketManager.destroy();
        if (this.playerManager) this.playerManager.stopAllInvincibilityAnimations();
        if (this.countdownTimer) {
            this.countdownTimer.remove();
            this.countdownTimer = null;
        }
    }
}
