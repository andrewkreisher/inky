import {
    GAME_WIDTH, GAME_HEIGHT, MAX_INK, MIN_PATH_LENGTH, INITIAL_INK,
    DRAWING_LINE_WIDTH, DRAWING_LINE_COLOR, BOUNDARY_BUFFER, INK_COST_PER_PIXEL,
} from '../constants';

export class DrawingManager {
    constructor(scene) {
        this.scene = scene;
        this.drawPath = [];
        this.isDrawing = false;
        this.currentInk = INITIAL_INK;
        this.graphics = null;
    }

    init() {
        this.graphics = this.scene.add.graphics();
    }

    startDrawing(pointer) {
        // Only respond to left mouse button
        if (pointer && pointer.rightButtonDown && pointer.rightButtonDown()) return;
        if (pointer && pointer.button !== undefined && pointer.button !== 0) return;

        if (this.currentInk > 0) {
            this.isDrawing = true;
            const currentPlayer = this.scene.playerManager.currentPlayer;
            const relativeX = pointer.x - currentPlayer.x;
            const relativeY = pointer.y - currentPlayer.y;
            this.drawPath = [{ x: relativeX, y: relativeY }];
            this.graphics.clear().lineStyle(DRAWING_LINE_WIDTH, DRAWING_LINE_COLOR);
        }
    }

    continueDrawing(pointer) {
        if (pointer && pointer.rightButtonDown && pointer.rightButtonDown()) return;
        if (pointer && pointer.buttons !== undefined && (pointer.buttons & 1) === 0) return;

        const isNearBounds = pointer.x < BOUNDARY_BUFFER ||
            pointer.x > GAME_WIDTH - BOUNDARY_BUFFER ||
            pointer.y < BOUNDARY_BUFFER ||
            pointer.y > GAME_HEIGHT - BOUNDARY_BUFFER;

        if (isNearBounds) {
            this.stopDrawing(pointer);
            return;
        }

        if (this.isDrawing && this.currentInk > 0) {
            const currentPlayer = this.scene.playerManager.currentPlayer;
            const relativeX = pointer.x - currentPlayer.x;
            const relativeY = pointer.y - currentPlayer.y;
            const lastPoint = this.drawPath[this.drawPath.length - 1];
            const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, relativeX, relativeY);
            const inkUsed = distance * INK_COST_PER_PIXEL;
            if (this.currentInk >= inkUsed) {
                this.drawPath.push({ x: relativeX, y: relativeY });
                this.currentInk -= inkUsed;
                this.redrawPath();
            }
        }
    }

    stopDrawing(pointer) {
        if (pointer && pointer.button !== undefined && pointer.button !== 0) {
            return;
        }
        if (this.isDrawing) {
            const pathDistance = this.calculatePathDistance(this.drawPath);
            if (pathDistance < MIN_PATH_LENGTH) {
                this.currentInk = Math.min(MAX_INK, this.currentInk + pathDistance * INK_COST_PER_PIXEL);
                this.drawPath = [];
                this.graphics.clear();
            } else {
                const offsetX = this.drawPath[0].x;
                const offsetY = this.drawPath[0].y;
                this.drawPath = this.drawPath.map(point => ({
                    x: point.x - offsetX,
                    y: point.y - offsetY
                }));
            }
        }
        this.isDrawing = false;
        this.redrawPath();
    }

    calculatePathDistance(path) {
        let distance = 0;
        for (let i = 1; i < path.length; i++) {
            distance += Phaser.Math.Distance.Between(
                path[i - 1].x, path[i - 1].y,
                path[i].x, path[i].y
            );
        }
        return distance;
    }

    redrawPath() {
        if (this.drawPath.length > 1) {
            const currentPlayer = this.scene.playerManager.currentPlayer;
            this.graphics.clear().lineStyle(DRAWING_LINE_WIDTH, DRAWING_LINE_COLOR);
            this.graphics.beginPath();
            const startX = currentPlayer.x + this.drawPath[0].x;
            const startY = currentPlayer.y + this.drawPath[0].y;
            this.graphics.moveTo(startX, startY);
            for (let i = 1; i < this.drawPath.length; i++) {
                const worldX = currentPlayer.x + this.drawPath[i].x;
                const worldY = currentPlayer.y + this.drawPath[i].y;
                this.graphics.lineTo(worldX, worldY);
            }
            this.graphics.strokePath();
        }
    }

    cancelDrawing() {
        if (this.isDrawing) {
            const pathDistance = this.calculatePathDistance(this.drawPath);
            this.currentInk = Math.min(MAX_INK, this.currentInk + pathDistance * INK_COST_PER_PIXEL);
            this.drawPath = [];
            this.graphics.clear();
            this.isDrawing = false;
        }
    }

    resamplePath(path, step) {
        if (!path || path.length < 2) {
            return path;
        }

        const newPath = [path[0]];
        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
            totalDistance += Phaser.Math.Distance.Between(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
        }

        if (totalDistance === 0) {
            return newPath;
        }

        const numSteps = Math.floor(totalDistance / step);
        let pathCursor = 0;
        let currentDistance = 0;

        for (let i = 1; i <= numSteps; i++) {
            const targetDistance = i * step;

            while (pathCursor < path.length - 1) {
                const segmentLength = Phaser.Math.Distance.Between(path[pathCursor].x, path[pathCursor].y, path[pathCursor + 1].x, path[pathCursor + 1].y);
                if (currentDistance + segmentLength >= targetDistance) {
                    const distanceIntoSegment = targetDistance - currentDistance;
                    const t = distanceIntoSegment / segmentLength;
                    const newPoint = {
                        x: Phaser.Math.Linear(path[pathCursor].x, path[pathCursor + 1].x, t),
                        y: Phaser.Math.Linear(path[pathCursor].y, path[pathCursor + 1].y, t)
                    };
                    newPath.push(newPoint);
                    break;
                } else {
                    currentDistance += segmentLength;
                    pathCursor++;
                }
            }
        }

        return newPath;
    }
}
