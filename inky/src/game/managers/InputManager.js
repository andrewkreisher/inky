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

        this.scene.input.on('pointerdown', this.scene.drawingManager.startDrawing, this.scene.drawingManager);
        this.scene.input.on('pointermove', this.scene.drawingManager.continueDrawing, this.scene.drawingManager);
        this.scene.input.on('pointerup', this.scene.drawingManager.stopDrawing, this.scene.drawingManager);
        this.scene.input.on('pointerout', this.scene.drawingManager.stopDrawing, this.scene.drawingManager);

        window.addEventListener('mouseout', (event) => {
            if (event.relatedTarget === null) {
                this.scene.drawingManager.stopDrawing();
            }
        });

        this.scene.input.keyboard.on('keydown-SPACE', this.scene.projectileManager.shootProjectile, this.scene.projectileManager);
        this.scene.input.keyboard.on('keydown-E', this.scene.drawingManager.cancelDrawing, this.scene.drawingManager);
    }
}
