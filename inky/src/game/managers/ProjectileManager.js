import {
    PROJECTILE_SPRITE_SCALE, PROJECTILE_DEPTH, PROJECTILE_SPEED,
    RESAMPLE_STEP, SHOOT_ANIMATION_DURATION, INITIAL_PROJECTILE_COUNT,
} from '../constants';

export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.playerProjectiles = new Map();
        this.enemyProjectiles = new Map();
        this.playerProjectilesGroup = null;
        this.enemyProjectilesGroup = null;
        this.projectileCount = INITIAL_PROJECTILE_COUNT;
    }

    createGroups() {
        this.playerProjectilesGroup = this.scene.physics.add.group();
        this.enemyProjectilesGroup = this.scene.physics.add.group();
    }

    setupCollisions(barriers, otherPlayersGroup, currentPlayer) {
        // Projectile vs projectile
        this.scene.physics.add.overlap(this.playerProjectilesGroup, this.enemyProjectilesGroup, (p1, p2) => {
            if (p1.collided || p2.collided) return;
            if (p1.active && p2.active) {
                p1.collided = true;
                p2.collided = true;
                this.scene.socket.emit('projectileCollision', {
                    gameId: this.scene.gameId,
                    projectile1Id: p1.projectileId,
                    projectile2Id: p2.projectileId,
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2
                });
                this.playerProjectilesGroup.remove(p1);
                this.enemyProjectilesGroup.remove(p2);
                p1.destroy();
                p2.destroy();
            }
        }, null, this.scene);

        // Projectiles vs barriers
        this.scene.physics.add.overlap(this.playerProjectilesGroup, barriers, (projectile, barrier) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                this.playerProjectilesGroup.remove(projectile);
                projectile.destroy();
            }
        }, null, this.scene);

        this.scene.physics.add.overlap(this.enemyProjectilesGroup, barriers, (projectile, barrier) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                this.enemyProjectilesGroup.remove(projectile);
                projectile.destroy();
            }
        }, null, this.scene);

        // Projectile vs other players (client-side visuals only)
        this.scene.physics.add.overlap(this.playerProjectilesGroup, otherPlayersGroup, (projectile, player) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                this.playerProjectilesGroup.remove(projectile);
                projectile.destroy();
            }
        }, null, this.scene);

        // Enemy projectiles vs current player
        this.scene.physics.add.overlap(this.enemyProjectilesGroup, currentPlayer, (projectile, player) => {
            if (projectile.collided) return;
            if (projectile.active) {
                projectile.collided = true;
                projectile.body.enable = false;
                projectile.destroy();
                this.enemyProjectilesGroup.remove(projectile);
            }
        }, null, this.scene);
    }

    shootProjectile() {
        if (this.scene.drawingManager.drawPath.length > 1 && this.projectileCount > 0) {
            const currentPlayer = this.scene.playerManager.currentPlayer;
            const worldPath = this.scene.drawingManager.drawPath.map(point => ({
                x: currentPlayer.x + point.x,
                y: currentPlayer.y + point.y
            }));

            const resampledPath = this.scene.drawingManager.resamplePath(worldPath, RESAMPLE_STEP);

            if (resampledPath.length > 1) {
                const shootSprite = this.scene.playerManager.isSecondPlayer ? 'player2shoot' : 'playershoot';
                currentPlayer.setTexture(shootSprite);

                this.scene.time.delayedCall(SHOOT_ANIMATION_DURATION, () => {
                    const normalSprite = this.scene.playerManager.isSecondPlayer ? 'player2' : 'player';
                    const cp = this.scene.playerManager.currentPlayer;
                    if (cp && cp.active) {
                        cp.setTexture(normalSprite);
                    }
                });

                this.scene.game.socket.emit('shootProjectile', {
                    gameId: this.scene.gameId,
                    playerId: this.scene.game.socket.id,
                    path: resampledPath
                });
                this.projectileCount--;
                this.scene.uiManager.updateProjectileSprites();
                this.scene.drawingManager.graphics.clear();
            }
        }
    }

    updateProjectiles(projectilesInfo) {
        if (!projectilesInfo) return;

        this.playerProjectilesGroup.clear(true, true);
        this.enemyProjectilesGroup.clear(true, true);
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();

        projectilesInfo.forEach(projInfo => {
            const sprite = projInfo.isSecondPlayer ? 'projectile2' : 'projectile';
            const projectile = this.scene.physics.add.image(projInfo.x, projInfo.y, sprite)
                .setScale(PROJECTILE_SPRITE_SCALE)
                .setDepth(PROJECTILE_DEPTH);
            projectile.path = projInfo.path;
            projectile.pathIndex = projInfo.pathIndex;
            projectile.projectileId = projInfo.id;
            projectile.shooterId = projInfo.shooter_id;
            projectile.collided = false;

            if (projInfo.shooter_id === this.scene.game.socket.id) {
                this.playerProjectiles.set(projInfo.id, projectile);
                this.playerProjectilesGroup.add(projectile);
            } else {
                this.enemyProjectiles.set(projInfo.id, projectile);
                this.enemyProjectilesGroup.add(projectile);
            }
        });
    }

    moveProjectiles() {
        this.moveProjectileGroup(this.playerProjectiles);
        this.moveProjectileGroup(this.enemyProjectiles);
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

                projectile.x += Math.cos(angle) * PROJECTILE_SPEED;
                projectile.y += Math.sin(angle) * PROJECTILE_SPEED;

                if (Phaser.Math.Distance.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y) < PROJECTILE_SPEED) {
                    projectile.pathIndex++;
                }
            }
        });
    }

    handleNewProjectile(projectileInfo) {
        const sprite = projectileInfo.isSecondPlayer ? 'projectile2' : 'projectile';
        const projectile = this.scene.physics.add.image(projectileInfo.path[0].x, projectileInfo.path[0].y, sprite)
            .setScale(PROJECTILE_SPRITE_SCALE)
            .setDepth(PROJECTILE_DEPTH);
        projectile.path = projectileInfo.path;
        projectile.pathIndex = 0;
        projectile.projectileId = projectileInfo.id;
        projectile.shooterId = projectileInfo.shooter_id;
        projectile.collided = false;

        if (projectileInfo.shooter_id === this.scene.game.socket.id) {
            this.playerProjectiles.set(projectileInfo.id, projectile);
            this.playerProjectilesGroup.add(projectile);
        } else {
            this.enemyProjectiles.set(projectileInfo.id, projectile);
            this.enemyProjectilesGroup.add(projectile);
        }
    }
}
