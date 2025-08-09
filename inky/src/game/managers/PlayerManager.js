import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.invincibilityTweens = new Map();
    }

    createCurrentPlayer() {
        const startX = GAME_WIDTH * 0.25;
        const startY = GAME_HEIGHT * 0.5;
        this.scene.currentPlayer = this.scene.physics.add.sprite(startX, startY, 'player').setScale(0.2);
    }

    updatePlayers(players) {
        const existingPlayerIds = new Set(this.scene.otherPlayers.keys());
        players.forEach(playerInfo => {
            if (playerInfo.id === this.scene.socket.id) {
                this.updateCurrentPlayer(playerInfo);
            } else {
                existingPlayerIds.delete(playerInfo.id);
                this.updateOtherPlayer(playerInfo);
            }
        });
        existingPlayerIds.forEach(id => {
            const player = this.scene.otherPlayers.get(id);
            if (player) {
                player.destroy();
                this.scene.otherPlayers.delete(id);
                this.scene.otherPlayersGroup.remove(player);
            }
        });
    }

    updateCurrentPlayer(playerInfo) {
        if (!this.scene.currentPlayer || !this.scene.checkedPlayer || (this.scene.isSecondPlayer !== playerInfo.isSecondPlayer)) {
            if (this.scene.currentPlayer) {
                this.scene.currentPlayer.destroy();
            }
            const sprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
            this.scene.currentPlayer = this.scene.physics.add.sprite(playerInfo.x, playerInfo.y, sprite)
                .setScale(0.2)
                .setDepth(1);
            this.scene.checkedPlayer = true;
            this.scene.isSecondPlayer = playerInfo.isSecondPlayer;
        }

        this.scene.currentPlayer.setPosition(playerInfo.x, playerInfo.y);
        this.scene.currentPlayer.lives = playerInfo.lives;
        this.scene.uiManager.updateLifeSprites();
        this.updatePlayerInvincibility(this.scene.currentPlayer, playerInfo.isInvincible);
    }

    updateOtherPlayer(playerInfo) {
        let otherPlayer = this.scene.otherPlayers.get(playerInfo.id);
        const expectedSprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
        if (!otherPlayer || otherPlayer.texture.key !== expectedSprite) {
            if (otherPlayer) {
                otherPlayer.destroy();
            }
            otherPlayer = this.scene.physics.add.sprite(playerInfo.x, playerInfo.y, expectedSprite)
                .setScale(0.2)
                .setDepth(1);
            this.scene.otherPlayers.set(playerInfo.id, otherPlayer);
            this.scene.otherPlayersGroup.add(otherPlayer);
        }

        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        otherPlayer.setVisible(true);
        otherPlayer.setAlpha(1);
        this.updatePlayerInvincibility(otherPlayer, playerInfo.isInvincible);
    }

    updatePlayerInvincibility(playerSprite, isInvincible) {
        if (isInvincible && !this.invincibilityTweens.has(playerSprite)) {
            this.startInvincibilityAnimation(playerSprite);
        } else if (!isInvincible && this.invincibilityTweens.has(playerSprite)) {
            this.stopInvincibilityAnimation(playerSprite);
        }
    }

    startInvincibilityAnimation(playerSprite) {
        const tween = this.scene.tweens.add({
            targets: playerSprite,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        this.invincibilityTweens.set(playerSprite, tween);
    }

    stopInvincibilityAnimation(playerSprite) {
        const tween = this.invincibilityTweens.get(playerSprite);
        if (tween) {
            tween.stop();
            this.invincibilityTweens.delete(playerSprite);
            playerSprite.alpha = 1;
        }
    }

    handlePlayerMovement() {
        if (!this.scene.currentPlayer || !this.scene.cursors) return;

        let movement = { x: 0, y: 0 };

        if (this.scene.cursors.left.isDown) {
            movement.x = -0.5;
        } else if (this.scene.cursors.right.isDown) {
            movement.x = 0.5;
        }

        if (this.scene.cursors.up.isDown) {
            movement.y = -0.5;
        } else if (this.scene.cursors.down.isDown) {
            movement.y = 0.5;
        }

        if (movement.x !== 0 || movement.y !== 0) {
            this.scene.socket.emit('playerMovement', {
                gameId: this.scene.gameId,
                playerId: this.scene.socket.id,
                movement: movement
            });
        }
    }
}
