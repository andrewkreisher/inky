import { INITIAL_INK, MAX_PROJECTILE_COUNT } from '../constants';

export class SocketManager {
    constructor(scene) {
        this.scene = scene;
    }

    connectToServer() {
        if (!this.scene.socket) {
            this.scene.socket = this.scene.game.socket;
        }

        this.scene.socket.on('gameState', this.handleGameState.bind(this));
        this.scene.socket.on('newProjectile', this.scene.projectileManager.handleNewProjectile.bind(this.scene.projectileManager));
        this.scene.socket.on('playerDisconnected', this.scene.uiManager.handlePlayerDisconnected.bind(this.scene.uiManager));
        this.scene.socket.on('pointScored', this.resetMap.bind(this));

        // Request initial map and state
        if (this.scene.gameId) {
            this.scene.socket.emit('requestGameState', this.scene.gameId);
        }
    }

    handleGameState(gameState) {
        if (!gameState || !gameState.players) return;
        this.scene.playerManager.updatePlayers(gameState.players);
        this.scene.projectileManager.updateProjectiles(gameState.projectiles);
        if (gameState.explosions && gameState.explosions.length > 0) {
            gameState.explosions.forEach(explosion => {
                this.scene.events.emit('projectileDestroyed', explosion.x, explosion.y);
            });
        }
        const currentPlayer = gameState.players.find(player => player.id === this.scene.game.socket.id);
        if (currentPlayer) {
            this.scene.uiManager.updateScore(currentPlayer.score);
        }
        if (gameState.round && gameState.round !== this.scene.currentRound) {
            this.scene.currentRound = gameState.round;
            this.scene.showRoundText();
        }
        // Fallback: rebuild map if map changed via gameState
        if (gameState.map && (!this.scene.currentMap || this.scene.currentMap.id !== gameState.map.id)) {
            this.scene.currentMap = gameState.map;
            this.scene.rebuildMap();
        }
    }

    resetMap() {
        const pm = this.scene.projectileManager;
        pm.playerProjectiles.forEach(projectile => projectile.destroy());
        pm.enemyProjectiles.forEach(projectile => projectile.destroy());
        pm.playerProjectiles.clear();
        pm.enemyProjectiles.clear();
        this.scene.drawingManager.drawPath = [];
        this.scene.drawingManager.graphics.clear();
        pm.projectileCount = MAX_PROJECTILE_COUNT;
        this.scene.drawingManager.currentInk = INITIAL_INK;
        this.scene.playerManager.stopInvincibilityAnimation(this.scene.playerManager.currentPlayer);
        this.scene.playerManager.otherPlayers.forEach(player => {
            this.scene.playerManager.stopInvincibilityAnimation(player);
        });
        this.scene.game.socket.emit('requestGameState', this.scene.gameId);
    }
}
