import { GAME_WIDTH, GAME_HEIGHT, MAX_INK } from '../constants';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
    }

    createUI() {
        this.scene.inkBar = this.scene.add.graphics();
        this.scene.barBackground = this.scene.add.graphics();
        this.scene.scoreText = this.scene.add.text(20, 20, '', { fontSize: '32px', fill: '#fff' });
        this.scene.projectileContainer = this.scene.add.container(20, GAME_HEIGHT - 70);
        this.scene.projectileSprites = [];
        this.scene.livesContainer = this.scene.add.container(20, GAME_HEIGHT - 100);
        this.scene.lifeSprites = [];
        this.updateProjectileSprites();
        this.updateLifeSprites();
    }

    updateProjectileSprites() {
        this.scene.projectileSprites.forEach(sprite => sprite.destroy());
        this.scene.projectileSprites = [];

        const fullProjectiles = Math.floor(this.scene.projectileCount);
        for (let i = 0; i < fullProjectiles; i++) {
            const spriteName = this.scene.isSecondPlayer ? 'projectile2' : 'projectile';
            const sprite = this.scene.add.image(5 + i * 30, 0, spriteName).setScale(0.05);
            this.scene.projectileSprites.push(sprite);
            this.scene.projectileContainer.add(sprite);
        }

        const fraction = this.scene.projectileCount - fullProjectiles;
        if (fraction > 0) {
            const spriteName = this.scene.isSecondPlayer ? 'projectile2' : 'projectile';
            const sprite = this.scene.add.image(5 + fullProjectiles * 30, 0, spriteName)
                .setScale(0.05)
                .setAlpha(fraction);
            this.scene.projectileSprites.push(sprite);
            this.scene.projectileContainer.add(sprite);
        }
    }

    updateLifeSprites() {
        this.scene.lifeSprites.forEach(sprite => sprite.destroy());
        this.scene.lifeSprites = [];

        const lives = this.scene.currentPlayer ? this.scene.currentPlayer.lives : 3;
        for (let i = 0; i < lives; i++) {
            const spriteName = this.scene.isSecondPlayer ? 'player2' : 'player';
            const sprite = this.scene.add.image(10 + i * 50, -10, spriteName).setScale(0.07);
            this.scene.lifeSprites.push(sprite);
            this.scene.livesContainer.add(sprite);
        }
    }

    updateScore(score) {
        this.scene.scoreText.setText(`Score: ${score}`);
    }

    updateUI() {
        this.scene.inkBar.clear().fillStyle(0x000000, 1).fillRect(20, GAME_HEIGHT - 40, (this.scene.currentInk / MAX_INK) * 200, 20);
        this.scene.barBackground.clear().fillStyle(0x000000, 0.5).fillRect(20, GAME_HEIGHT - 40, 200, 20);
        this.updateProjectileSprites();
        this.updateLifeSprites();
    }

    handlePlayerDisconnected(playerId) {
        this.scene.gameover = true;
        this.scene.physics.pause();

        console.log('Player disconnected:', playerId);

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
