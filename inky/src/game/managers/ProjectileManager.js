export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
    }

    shootProjectile() {
        if (this.scene.drawingManager.drawPath.length > 1 && this.scene.projectileCount > 0) {
            const worldPath = this.scene.drawingManager.drawPath.map(point => ({
                x: this.scene.currentPlayer.x + point.x,
                y: this.scene.currentPlayer.y + point.y
            }));

            const resampledPath = this.scene.drawingManager.resamplePath(worldPath, 5);

            if (resampledPath.length > 1) {
                const shootSprite = this.scene.isSecondPlayer ? 'player2shoot' : 'playershoot';
                this.scene.currentPlayer.setTexture(shootSprite);

                this.scene.time.delayedCall(320, () => {
                    const normalSprite = this.scene.isSecondPlayer ? 'player2' : 'player';
                    if (this.scene.currentPlayer && this.scene.currentPlayer.active) {
                        this.scene.currentPlayer.setTexture(normalSprite);
                    }
                });

                this.scene.game.socket.emit('shootProjectile', {
                    gameId: this.scene.gameId,
                    playerId: this.scene.game.socket.id,
                    path: resampledPath
                });
                this.scene.projectileCount--;
                this.scene.uiManager.updateProjectileSprites();
                this.scene.graphics.clear();
            }
        }
    }

    updateProjectiles(projectilesInfo) {
        if (!projectilesInfo) return;

        this.scene.playerProjectiles.forEach(projectile => projectile.destroy());
        this.scene.enemyProjectiles.forEach(projectile => projectile.destroy());
        this.scene.playerProjectiles.clear();
        this.scene.enemyProjectiles.clear();

        projectilesInfo.forEach(projInfo => {
            const sprite = projInfo.isSecondPlayer ? 'projectile2' : 'projectile';
            const projectile = this.scene.physics.add.image(projInfo.x, projInfo.y, sprite)
                .setScale(0.07)
                .setDepth(2);
            projectile.path = projInfo.path;
            projectile.pathIndex = projInfo.pathIndex;
            projectile.projectileId = projInfo.id;
            projectile.playerId = projInfo.playerId;

            if (projInfo.shooter_id === this.scene.game.socket.id) {
                this.scene.playerProjectiles.set(projInfo.id, projectile);
            } else {
                this.scene.enemyProjectiles.set(projInfo.id, projectile);
            }
        });
    }

    moveProjectiles() {
        this.moveProjectileGroup(this.scene.playerProjectiles);
        this.moveProjectileGroup(this.scene.enemyProjectiles);
    }

    moveProjectileGroup(projectileGroup) {
        projectileGroup.forEach((projectile, id) => {
            if (!projectile || !projectile.active) {
                projectileGroup.delete(id);
                projectile.destroy();
                return;
            }

            if (projectile.path && projectile.pathIndex < projectile.path.length - 1) {
                const targetPoint = projectile.path[projectile.pathIndex + 1];
                const angle = Phaser.Math.Angle.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y);
                const speed = 10;

                projectile.x += Math.cos(angle) * speed;
                projectile.y += Math.sin(angle) * speed;

                if (Phaser.Math.Distance.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y) < speed) {
                    projectile.pathIndex++;
                }
            }
        });
    }

    handleNewProjectile(projectileInfo) {
        const sprite = projectileInfo.isSecondPlayer ? 'projectile2' : 'projectile';
        const projectile = this.scene.physics.add.image(projectileInfo.path[0].x, projectileInfo.path[0].y, sprite)
            .setScale(0.07)
            .setDepth(2);
        projectile.path = projectileInfo.path;
        projectile.pathIndex = 0;
        projectile.projectileId = projectileInfo.id;
        projectile.playerId = projectileInfo.playerId;

        if (projectileInfo.playerId === this.scene.game.socket.id) {
            this.scene.playerProjectiles.set(projectileInfo.id, projectile);
        } else {
            this.scene.enemyProjectiles.set(projectileInfo.id, projectile);
        }
    }
}
