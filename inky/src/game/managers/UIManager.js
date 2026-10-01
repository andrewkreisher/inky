import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK, DEFAULT_LIVES, FONT_FAMILY,
    HUD_HEIGHT, HUD_DEPTH,
    INK_BAR_X, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS, INK_BAR_LOW_THRESHOLD,
    PROJECTILE_UI_SCALE, PROJECTILE_UI_SPACING,
    LIFE_UI_SCALE, LIFE_UI_SPACING,
} from '../constants';

const LABEL_STYLE = { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#6a6a8a' };
const HUD_CORNERS = { tl: 8, tr: 8, bl: 0, br: 0 };
const INK_COLOR = 0x6c5ce7;
const INK_LOW_COLOR = 0xe17055;

/** Bottom HUD: lives, ink bar, ammo, plus the score text in the top-left. */
export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.hudPanel = null;
        this.inkBar = null;
        this.inkBarY = 0;
        this.scoreText = null;
        this.livesContainer = null;
        this.lifeSprites = [];
        this.projectileContainer = null;
        this.projectileSprites = [];
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
        this.hudPanel = this.scene.add.graphics().setDepth(HUD_DEPTH);
        this.hudPanel.fillStyle(0x0a0a1a, 0.85);
        this.hudPanel.fillRoundedRect(0, hudY, GAME_WIDTH, HUD_HEIGHT, HUD_CORNERS);
        this.hudPanel.lineStyle(1, 0x4a3870, 0.6);
        this.hudPanel.strokeRoundedRect(0, hudY, GAME_WIDTH, HUD_HEIGHT, HUD_CORNERS);
    }

    createScoreText() {
        this.scoreText = this.scene.add.text(20, 16, '', {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            color: '#e8dcc8',
            stroke: '#000000',
            strokeThickness: 4,
        }).setDepth(HUD_DEPTH + 1);
    }

    createInkBar(hudY) {
        const barY = hudY + 28;
        this.inkBarY = barY;

        this.scene.add.text(INK_BAR_X, hudY + 8, 'INK', LABEL_STYLE).setDepth(HUD_DEPTH + 1);

        const background = this.scene.add.graphics().setDepth(HUD_DEPTH + 1);
        background.fillStyle(0x1a1528, 1);
        background.fillRoundedRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS);

        // Fill bar, redrawn each frame and clipped to the rounded shape.
        this.inkBar = this.scene.add.graphics().setDepth(HUD_DEPTH + 2);
        const mask = this.scene.make.graphics({ x: 0, y: 0, add: false });
        mask.fillStyle(0xffffff);
        mask.fillRoundedRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS);
        this.inkBar.setMask(mask.createGeometryMask());

        const border = this.scene.add.graphics().setDepth(HUD_DEPTH + 2);
        border.lineStyle(1.5, INK_COLOR, 0.8);
        border.strokeRoundedRect(INK_BAR_X, barY, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS);
    }

    createLivesDisplay(hudY) {
        this.scene.add.text(24, hudY + 8, 'LIVES', LABEL_STYLE).setDepth(HUD_DEPTH + 1);
        this.livesContainer = this.scene.add.container(24, hudY + 36).setDepth(HUD_DEPTH + 1);
        this.updateLifeSprites();
    }

    createAmmoDisplay(hudY) {
        const ammoX = INK_BAR_X + INK_BAR_WIDTH + 50;
        this.scene.add.text(ammoX, hudY + 8, 'AMMO', LABEL_STYLE).setDepth(HUD_DEPTH + 1);
        this.projectileContainer = this.scene.add.container(ammoX, hudY + 36).setDepth(HUD_DEPTH + 1);
        this.updateProjectileSprites();
    }

    // --- Updates ---

    /** Rebuild ammo icons; a partial icon fades in as the next shot regenerates. */
    updateProjectileSprites() {
        this.projectileSprites.forEach(sprite => sprite.destroy());
        this.projectileSprites = [];

        const count = this.scene.projectileManager.projectileCount;
        const full = Math.floor(count);
        const fraction = count - full;
        const texture = this.scene.playerManager.isSecondPlayer ? 'projectile2' : 'projectile';

        const addIcon = (slot, alpha) => {
            const sprite = this.scene.add.image(slot * PROJECTILE_UI_SPACING, 0, texture)
                .setScale(PROJECTILE_UI_SCALE)
                .setAlpha(alpha);
            this.projectileSprites.push(sprite);
            this.projectileContainer.add(sprite);
        };
        for (let i = 0; i < full; i++) addIcon(i, 1);
        if (fraction > 0) addIcon(full, fraction);
    }

    updateLifeSprites() {
        this.lifeSprites.forEach(sprite => sprite.destroy());
        this.lifeSprites = [];

        const player = this.scene.playerManager.currentPlayer;
        const lives = player && player.lives !== undefined ? player.lives : DEFAULT_LIVES;
        const texture = this.scene.playerManager.isSecondPlayer ? 'player2' : 'player';

        for (let i = 0; i < lives; i++) {
            const sprite = this.scene.add.image(i * LIFE_UI_SPACING, 0, texture).setScale(LIFE_UI_SCALE);
            this.lifeSprites.push(sprite);
            this.livesContainer.add(sprite);
        }
    }

    updateScore(score) {
        this.scoreText.setText(`Score: ${score}`);
    }

    /** Per-frame: redraw the ink fill. */
    updateUI() {
        const ratio = this.scene.drawingManager.currentInk / MAX_INK;
        const width = ratio * INK_BAR_WIDTH;
        this.inkBar.clear();
        if (width > 0) {
            this.inkBar.fillStyle(ratio < INK_BAR_LOW_THRESHOLD ? INK_LOW_COLOR : INK_COLOR, 1);
            this.inkBar.fillRect(INK_BAR_X, this.inkBarY, width, INK_BAR_HEIGHT);
        }
    }
}
