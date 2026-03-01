import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK,
    HUD_HEIGHT, HUD_DEPTH,
    INK_BAR_X, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS, INK_BAR_LOW_THRESHOLD,
    PROJECTILE_UI_SCALE, PROJECTILE_UI_SPACING,
    LIFE_UI_SCALE, LIFE_UI_SPACING,
} from '../constants';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.hudPanel = null;
        this.inkBar = null;
        this.barBackground = null;
        this.inkBarBorder = null;
        this.inkBarMaskGfx = null;
        this.scoreText = null;
        this.livesLabel = null;
        this.livesContainer = null;
        this.lifeSprites = [];
        this.inkLabel = null;
        this.ammoLabel = null;
        this.projectileContainer = null;
        this.projectileSprites = [];
        this.gameEnded = false;
    }

    createUI() {
        const hudY = GAME_HEIGHT - HUD_HEIGHT;

        this.createHUDPanel(hudY);
        this.createScoreText();
        this.createInkBar(hudY);
        this.createLivesDisplay(hudY);
        this.createAmmoDisplay(hudY);
    }

    createHUDPanel(hudY) {
        this.hudPanel = this.scene.add.graphics();
        this.hudPanel.fillStyle(0x0a0a1a, 0.85);
        this.hudPanel.fillRoundedRect(0, hudY, GAME_WIDTH, HUD_HEIGHT, { tl: 8, tr: 8, bl: 0, br: 0 });
        this.hudPanel.lineStyle(1, 0x4a3870, 0.6);
        this.hudPanel.strokeRoundedRect(0, hudY, GAME_WIDTH, HUD_HEIGHT, { tl: 8, tr: 8, bl: 0, br: 0 });
        this.hudPanel.setDepth(HUD_DEPTH);
    }

    createScoreText() {
        this.scoreText = this.scene.add.text(20, 16, '', {
            fontFamily: 'Silkscreen',
            fontSize: '28px',
            color: '#e8dcc8',
            stroke: '#000000',
            strokeThickness: 4,
        }).setDepth(HUD_DEPTH + 1);
    }

    createInkBar(hudY) {
        const barY = hudY + 28;

        this.inkLabel = this.scene.add.text(INK_BAR_X, hudY + 8, 'INK', {
            fontFamily: 'Silkscreen',
            fontSize: '11px',
            color: '#6a6a8a',
        }).setDepth(HUD_DEPTH + 1);

        // Dark inner background
        this.barBackground = this.scene.add.graphics();
        this.barBackground.fillStyle(0x1a1528, 1);
        this.barBackground.fillRoundedRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS);
        this.barBackground.setDepth(HUD_DEPTH + 1);

        // Fill bar (redrawn each frame, clipped by mask)
        this.inkBar = this.scene.add.graphics();
        this.inkBar.setDepth(HUD_DEPTH + 2);

        this.inkBarMaskGfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
        this.inkBarMaskGfx.fillStyle(0xffffff);
        this.inkBarMaskGfx.fillRoundedRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS);
        this.inkBar.setMask(this.inkBarMaskGfx.createGeometryMask());

        // Border outline
        this.inkBarBorder = this.scene.add.graphics();
        this.inkBarBorder.lineStyle(1.5, 0x6c5ce7, 0.8);
        this.inkBarBorder.strokeRoundedRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS);
        this.inkBarBorder.setDepth(HUD_DEPTH + 2);

        this.inkBarY = barY;
    }

    createLivesDisplay(hudY) {
        this.livesLabel = this.scene.add.text(24, hudY + 8, 'LIVES', {
            fontFamily: 'Silkscreen',
            fontSize: '11px',
            color: '#6a6a8a',
        }).setDepth(HUD_DEPTH + 1);

        this.livesContainer = this.scene.add.container(24, hudY + 36);
        this.livesContainer.setDepth(HUD_DEPTH + 1);
        this.updateLifeSprites();
    }

    createAmmoDisplay(hudY) {
        const ammoX = INK_BAR_X + INK_BAR_WIDTH + 50;

        this.ammoLabel = this.scene.add.text(ammoX, hudY + 8, 'AMMO', {
            fontFamily: 'Silkscreen',
            fontSize: '11px',
            color: '#6a6a8a',
        }).setDepth(HUD_DEPTH + 1);

        this.projectileContainer = this.scene.add.container(ammoX, hudY + 36);
        this.projectileContainer.setDepth(HUD_DEPTH + 1);
        this.updateProjectileSprites();
    }

    updateProjectileSprites() {
        this.projectileSprites.forEach(sprite => sprite.destroy());
        this.projectileSprites = [];

        const fullProjectiles = Math.floor(this.scene.projectileManager.projectileCount);
        const spriteName = this.scene.playerManager.isSecondPlayer ? 'projectile2' : 'projectile';

        for (let i = 0; i < fullProjectiles; i++) {
            const sprite = this.scene.add.image(i * PROJECTILE_UI_SPACING, 0, spriteName)
                .setScale(PROJECTILE_UI_SCALE);
            this.projectileSprites.push(sprite);
            this.projectileContainer.add(sprite);
        }

        const fraction = this.scene.projectileManager.projectileCount - fullProjectiles;
        if (fraction > 0) {
            const sprite = this.scene.add.image(fullProjectiles * PROJECTILE_UI_SPACING, 0, spriteName)
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
        const spriteName = this.scene.playerManager.isSecondPlayer ? 'player2' : 'player';

        for (let i = 0; i < lives; i++) {
            const sprite = this.scene.add.image(i * LIFE_UI_SPACING, 0, spriteName)
                .setScale(LIFE_UI_SCALE);
            this.lifeSprites.push(sprite);
            this.livesContainer.add(sprite);
        }
    }

    updateScore(score) {
        this.scoreText.setText(`Score: ${score}`);
    }

    updateUI() {
        const inkRatio = this.scene.drawingManager.currentInk / MAX_INK;
        const fillWidth = inkRatio * INK_BAR_WIDTH;
        const fillColor = inkRatio < INK_BAR_LOW_THRESHOLD ? 0xe17055 : 0x6c5ce7;

        this.inkBar.clear();
        if (fillWidth > 0) {
            this.inkBar.fillStyle(fillColor, 1);
            this.inkBar.fillRect(INK_BAR_X, this.inkBarY, fillWidth, INK_BAR_HEIGHT);
        }
    }

    handlePlayerDisconnected(playerId) {
        this.scene.gameover = true;
        this.scene.physics.pause();
    }
}
