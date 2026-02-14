import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK,
    INK_BAR_X, INK_BAR_Y_OFFSET, INK_BAR_WIDTH, INK_BAR_HEIGHT,
    PROJECTILE_UI_SCALE, PROJECTILE_UI_SPACING,
    LIFE_UI_SCALE, LIFE_UI_SPACING,
} from '../constants';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.inkBar = null;
        this.barBackground = null;
        this.scoreText = null;
        this.projectileContainer = null;
        this.projectileSprites = [];
        this.livesContainer = null;
        this.lifeSprites = [];
    }

    createUI() {
        this.inkBar = this.scene.add.graphics();
        this.barBackground = this.scene.add.graphics();
        this.scene.add.image(140, GAME_HEIGHT - 40, 'inkbar').setDisplaySize(300, 150);
        this.scoreText = this.scene.add.text(20, 20, '', { fontSize: '32px', fill: '#fff' });
        this.projectileContainer = this.scene.add.container(20, GAME_HEIGHT - 70);
        this.livesContainer = this.scene.add.container(20, GAME_HEIGHT - 100);
        this.updateProjectileSprites();
        this.updateLifeSprites();
    }

    updateProjectileSprites() {
        this.projectileSprites.forEach(sprite => sprite.destroy());
        this.projectileSprites = [];

        const fullProjectiles = Math.floor(this.scene.projectileManager.projectileCount);
        for (let i = 0; i < fullProjectiles; i++) {
            const spriteName = this.scene.playerManager.isSecondPlayer ? 'projectile2' : 'projectile';
            const sprite = this.scene.add.image(10 + i * PROJECTILE_UI_SPACING, -10, spriteName).setScale(PROJECTILE_UI_SCALE);
            this.projectileSprites.push(sprite);
            this.projectileContainer.add(sprite);
        }

        const fraction = this.scene.projectileManager.projectileCount - fullProjectiles;
        if (fraction > 0) {
            const spriteName = this.scene.playerManager.isSecondPlayer ? 'projectile2' : 'projectile';
            const sprite = this.scene.add.image(10 + fullProjectiles * PROJECTILE_UI_SPACING, -10, spriteName)
                .setScale(PROJECTILE_UI_SCALE)
                .setAlpha(fraction);
            this.projectileSprites.push(sprite);
            this.projectileContainer.add(sprite);
        }
    }

    updateLifeSprites() {
        this.lifeSprites.forEach(sprite => sprite.destroy());
        this.lifeSprites = [];

        const currentPlayer = this.scene.playerManager.currentPlayer;
        const lives = currentPlayer ? currentPlayer.lives : 3;
        for (let i = 0; i < lives; i++) {
            const spriteName = this.scene.playerManager.isSecondPlayer ? 'player2' : 'player';
            const sprite = this.scene.add.image(10 + i * LIFE_UI_SPACING, -20, spriteName).setScale(LIFE_UI_SCALE);
            this.lifeSprites.push(sprite);
            this.livesContainer.add(sprite);
        }
    }

    updateScore(score) {
        this.scoreText.setText(`Score: ${score}`);
    }

    updateUI() {
        const barY = GAME_HEIGHT - INK_BAR_Y_OFFSET;
        this.barBackground.clear().fillStyle(0x000000, 0.5).fillRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT);
        this.inkBar.clear().fillStyle(0x000000, 1).fillRect(INK_BAR_X, barY, (this.scene.drawingManager.currentInk / MAX_INK) * INK_BAR_WIDTH, INK_BAR_HEIGHT);
    }

    handlePlayerDisconnected(playerId) {
        this.scene.gameover = true;
        this.scene.physics.pause();

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        overlay.setDepth(10);

        const disconnectText = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'Opponent Disconnected', {
            fontSize: '48px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(11);

        const backButton = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 'Back to Lobby', {
            fontSize: '32px',
            fill: '#00bfff',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setInteractive().setDepth(11);

        backButton.on('pointerdown', () => {
            window.location.href = '/';
        });

        backButton.on('pointerover', () => {
            backButton.setStyle({ fill: '#1e90ff' });
        });

        backButton.on('pointerout', () => {
            backButton.setStyle({ fill: '#00bfff' });
        });
    }
}
