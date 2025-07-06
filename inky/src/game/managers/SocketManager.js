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
        this.scene.socket.on('projectilesDestroyed', this.scene.projectileManager.destroyProjectiles.bind(this.scene.projectileManager));
        this.scene.socket.on('playerDisconnected', this.scene.uiManager.handlePlayerDisconnected.bind(this.scene.uiManager));
        this.scene.socket.on('pointScored', this.resetMap.bind(this));
    }

    handleGameState(gameState) {
        if (!gameState || !gameState.players) return;
        this.scene.playerManager.updatePlayers(gameState.players);
        this.scene.projectileManager.updateProjectiles(gameState.projectiles);
        const currentPlayer = gameState.players.find(player => player.id === this.scene.game.socket.id);
        if (currentPlayer) {
            this.scene.uiManager.updateScore(currentPlayer.score);
        }
    }

    resetMap() {
        this.scene.playerProjectiles.forEach(projectile => projectile.destroy());
        this.scene.enemyProjectiles.forEach(projectile => projectile.destroy());
        this.scene.playerProjectiles.clear();
        this.scene.enemyProjectiles.clear();
        this.scene.drawingManager.drawPath = [];
        this.scene.graphics.clear();
        this.scene.projectileCount = 10;
        this.scene.currentInk = 200;
        this.scene.playerManager.stopInvincibilityAnimation(this.scene.currentPlayer);
        this.scene.otherPlayers.forEach(player => {
            this.scene.playerManager.stopInvincibilityAnimation(player);
        });
        this.scene.game.socket.emit('requestGameState', this.scene.gameId);
    }
}
