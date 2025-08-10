export class InputManager {
    constructor(scene) {
        this.scene = scene;
    }

    setupInput() {
        this.scene.cursors = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Disable context menu to prevent focus loss on right-click
        if (this.scene.input && this.scene.input.mouse && this.scene.input.mouse.disableContextMenu) {
            this.scene.input.mouse.disableContextMenu();
        }
        if (this.scene.game && this.scene.game.canvas) {
            this.scene.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        this.scene.input.on('pointerdown', this.scene.drawingManager.startDrawing, this.scene.drawingManager);
        this.scene.input.on('pointermove', this.scene.drawingManager.continueDrawing, this.scene.drawingManager);
        this.scene.input.on('pointerup', this.scene.drawingManager.stopDrawing, this.scene.drawingManager);
        this.scene.input.on('pointerout', this.scene.drawingManager.stopDrawing, this.scene.drawingManager);

        // If the window loses focus, clear any stuck keys and stop drawing
        window.addEventListener('blur', () => {
            this.resetMovementKeys();
            if (this.scene.drawingManager) this.scene.drawingManager.stopDrawing();
        });

        // Also clear keys when a right-click is released on the canvas and cancel drawing
        this.scene.input.on('pointerup', (pointer) => {
            if (pointer.button === 2) {
                this.resetMovementKeys();
                if (this.scene.drawingManager) this.scene.drawingManager.cancelDrawing();
            }
        });

        window.addEventListener('mouseout', (event) => {
            if (event.relatedTarget === null) {
                this.scene.drawingManager.stopDrawing();
            }
        });

        this.scene.input.keyboard.on('keydown-SPACE', this.scene.projectileManager.shootProjectile, this.scene.projectileManager);
        this.scene.input.keyboard.on('keydown-E', this.scene.drawingManager.cancelDrawing, this.scene.drawingManager);
    }

    resetMovementKeys() {
        if (!this.scene.cursors) return;
        const { up, down, left, right } = this.scene.cursors;
        if (up && up.reset) up.reset();
        if (down && down.reset) down.reset();
        if (left && left.reset) left.reset();
        if (right && right.reset) right.reset();
    }
}
