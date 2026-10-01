import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK, DEFAULT_LIVES, FONT_FAMILY,
    HUD_HEIGHT, HUD_DEPTH,
    INK_BAR_X, INK_BAR_WIDTH, INK_BAR_HEIGHT, INK_BAR_RADIUS, INK_BAR_LOW_THRESHOLD,
    PROJECTILE_UI_SCALE, PROJECTILE_UI_SPACING,
    LIFE_UI_SCALE, LIFE_UI_SPACING, LIFE_UI_LOST_ALPHA,
    SCOREBOARD_Y, SCOREBOARD_WIDTH, SCOREBOARD_HEIGHT, SCOREBOARD_ICON_SCALE,
    SCOREBOARD_SCORE_SIZE, SCOREBOARD_NAME_SIZE, SCOREBOARD_NAME_MAX_CHARS,
} from '../constants';

const LABEL_STYLE = { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#6a6a8a' };
const HUD_CORNERS = { tl: 8, tr: 8, bl: 0, br: 0 };
const INK_COLOR = 0x6c5ce7;
const INK_LOW_COLOR = 0xe17055;
const P1_COLOR = '#5BA8A8';
const P2_COLOR = '#B068A8';

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * HUD: a scoreboard across the top (both players, names + big scores) and a
 * bottom strip with lives (tiny sprites of your character, lost ones dimmed),
 * the ink bar and ammo.
 */
export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.hudPanel = null;
        this.inkBar = null;
        this.inkBarY = 0;
        this.livesContainer = null;
        this.lifeSprites = [];
        this.lives = DEFAULT_LIVES;
        this.maxLives = DEFAULT_LIVES;
        this.projectileContainer = null;
        this.projectileSprites = [];
        this.scoreboard = null; // { container, meIcon, oppIcon, meName, oppName, meScore, oppScore }
    }

    createUI() {
        const hudY = GAME_HEIGHT - HUD_HEIGHT;
        this.createHUDPanel(hudY);
        this.createScoreboard();
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

    // --- Scoreboard ---

    createScoreboard() {
        const { add } = this.scene;
        const x = GAME_WIDTH / 2;
        const half = SCOREBOARD_WIDTH / 2;
        const midY = SCOREBOARD_HEIGHT / 2;

        const container = add.container(x, SCOREBOARD_Y).setDepth(HUD_DEPTH + 1);

        const bg = add.graphics();
        bg.fillStyle(0x0a0a1a, 0.85);
        bg.fillRoundedRect(-half, 0, SCOREBOARD_WIDTH, SCOREBOARD_HEIGHT, 8);
        bg.lineStyle(1, 0x4a3870, 0.6);
        bg.strokeRoundedRect(-half, 0, SCOREBOARD_WIDTH, SCOREBOARD_HEIGHT, 8);
        container.add(bg);

        const scoreStyle = {
            fontFamily: FONT_FAMILY, fontSize: SCOREBOARD_SCORE_SIZE, color: '#E8DCC8',
            stroke: '#000000', strokeThickness: 4,
        };
        const nameStyle = { fontFamily: FONT_FAMILY, fontSize: SCOREBOARD_NAME_SIZE, color: '#8878A8' };

        const sep = add.text(0, midY, ':', { ...scoreStyle, color: '#6a6a8a' }).setOrigin(0.5);
        const meScore = add.text(-28, midY, '0', scoreStyle).setOrigin(1, 0.5);
        const oppScore = add.text(28, midY, '0', scoreStyle).setOrigin(0, 0.5);

        const iconX = half - 34;
        const meIcon = add.image(-iconX, midY, 'player').setScale(SCOREBOARD_ICON_SCALE);
        const oppIcon = add.image(iconX, midY, 'player2').setScale(SCOREBOARD_ICON_SCALE).setVisible(false);

        const meName = add.text(-iconX + 30, midY, 'You', nameStyle).setOrigin(0, 0.5);
        const oppName = add.text(iconX - 30, midY, '', nameStyle).setOrigin(1, 0.5);

        container.add([sep, meScore, oppScore, meIcon, oppIcon, meName, oppName]);
        this.scoreboard = { container, meIcon, oppIcon, meName, oppName, meScore, oppScore, sep };
    }

    /**
     * @param {{me:{score:number,name:string,isSecondPlayer:boolean}, opponent?:{score:number,name:string,isSecondPlayer:boolean}|null}} data
     */
    updateScoreboard({ me, opponent }) {
        const sb = this.scoreboard;
        if (!sb) return;

        sb.meScore.setText(String(me.score));
        sb.meName.setText(truncate(me.name, SCOREBOARD_NAME_MAX_CHARS));
        sb.meName.setColor(me.isSecondPlayer ? P2_COLOR : P1_COLOR);
        sb.meIcon.setTexture(me.isSecondPlayer ? 'player2' : 'player');

        const hasOpp = Boolean(opponent);
        sb.oppScore.setVisible(hasOpp);
        sb.oppName.setVisible(hasOpp);
        sb.oppIcon.setVisible(hasOpp);
        sb.sep.setVisible(hasOpp);
        if (hasOpp) {
            sb.oppScore.setText(String(opponent.score));
            sb.oppName.setText(truncate(opponent.name, SCOREBOARD_NAME_MAX_CHARS));
            sb.oppName.setColor(opponent.isSecondPlayer ? P2_COLOR : P1_COLOR);
            sb.oppIcon.setTexture(opponent.isSecondPlayer ? 'player2' : 'player');
            sb.meScore.setOrigin(1, 0.5).setX(-28);
        } else {
            // Single player: centre the lone score.
            sb.meScore.setOrigin(0.5, 0.5).setX(0);
        }
    }

    /** Back-compat shim for single player: just my score. */
    updateScore(score) {
        this.updateScoreboard({ me: { score, name: 'You', isSecondPlayer: false }, opponent: null });
    }

    // --- Bottom strip ---

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
        this.livesContainer = this.scene.add.container(24 + LIFE_UI_SPACING / 2, hudY + 36).setDepth(HUD_DEPTH + 1);
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

    /**
     * Set remaining/max lives. Only rebuilds sprites when something changed
     * (or `force` is set, e.g. the player texture changed).
     */
    updateLives(lives, maxLives = this.maxLives, force = false) {
        const changed = lives !== this.lives || maxLives !== this.maxLives;
        this.lives = lives;
        this.maxLives = Math.max(maxLives, lives);
        if (changed || force) this.updateLifeSprites();
    }

    /** One tiny sprite of your character per life slot; lost lives are dimmed. */
    updateLifeSprites() {
        this.lifeSprites.forEach(sprite => sprite.destroy());
        this.lifeSprites = [];

        const texture = this.scene.playerManager.isSecondPlayer ? 'player2' : 'player';
        for (let i = 0; i < this.maxLives; i++) {
            const sprite = this.scene.add.image(i * LIFE_UI_SPACING, 0, texture)
                .setScale(LIFE_UI_SCALE)
                .setAlpha(i < this.lives ? 1 : LIFE_UI_LOST_ALPHA);
            this.lifeSprites.push(sprite);
            this.livesContainer.add(sprite);
        }
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
