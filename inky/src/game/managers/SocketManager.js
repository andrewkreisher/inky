/**
 * Bridges server events to the scene's managers. Owns the listeners it
 * registers and removes them in `destroy()`.
 */
export class SocketManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = scene.socket;
        this._onGameState = (state) => this.handleGameState(state);
        this._onNewProjectile = (info) => this.scene.projectileManager.handleNewProjectile(info, performance.now());
        this._onPointScored = (data) => this.scene.onPointScored(data && data.scorerName);
        this._onShotRejected = ({ reason }) => console.debug('[inky] shot rejected:', reason);
    }

    registerListeners() {
        this.socket.on('gameState', this._onGameState);
        this.socket.on('newProjectile', this._onNewProjectile);
        this.socket.on('pointScored', this._onPointScored);
        this.socket.on('shotRejected', this._onShotRejected);

        // Fetch the current map + snapshot immediately rather than waiting a tick.
        if (this.scene.gameId) {
            this.socket.emit('requestGameState', this.scene.gameId);
        }
    }

    destroy() {
        this.socket.off('gameState', this._onGameState);
        this.socket.off('newProjectile', this._onNewProjectile);
        this.socket.off('pointScored', this._onPointScored);
        this.socket.off('shotRejected', this._onShotRejected);
    }

    handleGameState(state) {
        if (!state || !state.players) return;
        const now = performance.now();
        const { playerManager, projectileManager, drawingManager, uiManager } = this.scene;

        // The server is the source of truth for whether the round is live.
        if (typeof state.paused === 'boolean') this.scene.roundTransitioning = state.paused;
        if (state.totalRounds) this.scene.totalRounds = state.totalRounds;

        playerManager.applySnapshot(state.players, now);
        projectileManager.applySnapshot(state.projectiles, now);

        if (state.explosions) {
            state.explosions.forEach(({ x, y }) => this.scene.spawnExplosion(x, y));
        }

        const me = state.players.find(p => p.id === this.socket.id);
        const opponent = state.players.find(p => p.id !== this.socket.id);
        if (me) {
            const names = this.scene.usernames || {};
            uiManager.updateScoreboard({
                me: { score: me.score, name: names[me.id] || 'You', isSecondPlayer: me.isSecondPlayer },
                opponent: opponent
                    ? { score: opponent.score, name: names[opponent.id] || 'Opponent', isSecondPlayer: opponent.isSecondPlayer }
                    : null,
            });
            uiManager.updateLives(me.lives, state.maxLives);
            drawingManager.setInkPool(me.ink);
            projectileManager.setServerAmmo(me.ammo);
        }
    }
}
