import {
    GAME_WIDTH, GAME_HEIGHT,
    PLAYER_SPRITE_SCALE, PLAYER_DEPTH, PLAYER_MOVEMENT_SPEED,
    INVINCIBILITY_FLASH_DURATION,
} from '../constants';

export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.invincibilityTweens = new Map();
        this.currentPlayer = null;
        this.otherPlayers = new Map();
        this.otherPlayersGroup = null;
        this.isSecondPlayer = false;
        this.checkedPlayer = false;
    }

    createGroups() {
        this.otherPlayersGroup = this.scene.physics.add.group();
    }

    createCurrentPlayer() {
        const startX = GAME_WIDTH * 0.25;
        const startY = GAME_HEIGHT * 0.5;
        this.currentPlayer = this.scene.physics.add.sprite(startX, startY, 'player').setScale(PLAYER_SPRITE_SCALE);
    }

    updatePlayers(players) {
        const existingPlayerIds = new Set(this.otherPlayers.keys());
        players.forEach(playerInfo => {
            if (playerInfo.id === this.scene.socket.id) {
                this.updateCurrentPlayer(playerInfo);
            } else {
                existingPlayerIds.delete(playerInfo.id);
                this.updateOtherPlayer(playerInfo);
            }
        });
        existingPlayerIds.forEach(id => {
            const player = this.otherPlayers.get(id);
            if (player) {
                player.destroy();
                this.otherPlayers.delete(id);
                this.otherPlayersGroup.remove(player);
            }
        });
    }

    updateCurrentPlayer(playerInfo) {
        if (!this.currentPlayer || !this.checkedPlayer || (this.isSecondPlayer !== playerInfo.isSecondPlayer)) {
            if (this.currentPlayer) {
                this.currentPlayer.destroy();
            }
            const sprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
            this.currentPlayer = this.scene.physics.add.sprite(playerInfo.x, playerInfo.y, sprite)
                .setScale(PLAYER_SPRITE_SCALE)
                .setDepth(PLAYER_DEPTH);
            this.checkedPlayer = true;
            this.isSecondPlayer = playerInfo.isSecondPlayer;
        }

        this.currentPlayer.setPosition(playerInfo.x, playerInfo.y);
        this.currentPlayer.lives = playerInfo.lives;
        this.scene.uiManager.updateLifeSprites();
        this.updatePlayerInvincibility(this.currentPlayer, playerInfo.isInvincible);
    }

    updateOtherPlayer(playerInfo) {
        let otherPlayer = this.otherPlayers.get(playerInfo.id);
        const expectedSprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
        if (!otherPlayer || otherPlayer.texture.key !== expectedSprite) {
            if (otherPlayer) {
                otherPlayer.destroy();
            }
            otherPlayer = this.scene.physics.add.sprite(playerInfo.x, playerInfo.y, expectedSprite)
                .setScale(PLAYER_SPRITE_SCALE)
                .setDepth(PLAYER_DEPTH);
            this.otherPlayers.set(playerInfo.id, otherPlayer);
            this.otherPlayersGroup.add(otherPlayer);
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
            duration: INVINCIBILITY_FLASH_DURATION,
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
        if (!this.currentPlayer || !this.scene.cursors) return;

        let movement = { x: 0, y: 0 };

        if (this.scene.cursors.left.isDown) {
            movement.x = -PLAYER_MOVEMENT_SPEED;
        } else if (this.scene.cursors.right.isDown) {
            movement.x = PLAYER_MOVEMENT_SPEED;
        }

        if (this.scene.cursors.up.isDown) {
            movement.y = -PLAYER_MOVEMENT_SPEED;
        } else if (this.scene.cursors.down.isDown) {
            movement.y = PLAYER_MOVEMENT_SPEED;
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
