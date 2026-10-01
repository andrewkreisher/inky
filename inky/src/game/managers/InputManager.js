import Phaser from 'phaser';

/**
 * WASD movement keys, mouse drawing, and hotkeys. Window-level listeners are
 * stored so `destroy()` can remove them.
 */
export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this._onBlur = null;
        this._onMouseout = null;
    }

    setupInput() {
        const { scene } = this;
        const { drawingManager, projectileManager } = scene;

        scene.cursors = scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });

        // Right-click is used to cancel drawing; keep the browser menu away.
        scene.input.mouse?.disableContextMenu();

        scene.input.on('pointerdown', drawingManager.startDrawing, drawingManager);
        scene.input.on('pointermove', drawingManager.continueDrawing, drawingManager);
        scene.input.on('pointerup', drawingManager.stopDrawing, drawingManager);
        scene.input.on('pointerout', drawingManager.stopDrawing, drawingManager);

        // Right-click release: cancel the stroke and clear any stuck movement keys.
        scene.input.on('pointerup', (pointer) => {
            if (pointer.button === 2) {
                this.resetMovementKeys();
                drawingManager.cancelDrawing();
            }
        });

        scene.input.keyboard.on('keydown-SPACE', projectileManager.shootProjectile, projectileManager);
        scene.input.keyboard.on('keydown-E', drawingManager.cancelDrawing, drawingManager);

        // Losing focus mid-stroke or mid-keypress would otherwise leave state stuck.
        this._onBlur = () => {
            this.resetMovementKeys();
            drawingManager.stopDrawing();
        };
        this._onMouseout = (event) => {
            if (event.relatedTarget === null) drawingManager.stopDrawing();
        };
        window.addEventListener('blur', this._onBlur);
        window.addEventListener('mouseout', this._onMouseout);
    }

    resetMovementKeys() {
        const cursors = this.scene.cursors;
        if (!cursors) return;
        Object.values(cursors).forEach(key => key.reset());
    }

    destroy() {
        if (this._onBlur) window.removeEventListener('blur', this._onBlur);
        if (this._onMouseout) window.removeEventListener('mouseout', this._onMouseout);
        this._onBlur = null;
        this._onMouseout = null;
    }
}
