import playerImage from '../../assets/player.png';
import player2Image from '../../assets/player2.png';
import darkBackgroundImage from '../../assets/dark_background.png';
import barrierImage from '../../assets/barrier.png';
import projectileImage from '../../assets/projectile.png';
import projectile2Image from '../../assets/projectile2.png';
import playerShootImage from '../../assets/playershoot.png';
import player2ShootImage from '../../assets/player2shoot.png';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.currentPlayer = null;
        this.otherPlayers = new Map();
        this.playerProjectiles = new Map();
        this.enemyProjectiles = new Map();
        this.drawPath = [];
        this.currentInk = 200;
        this.projectileCount = 5;
        this.MAX_INK = 400;
        this.MIN_PATH_LENGTH = 200;
        this.GAME_WIDTH = 1280;
        this.GAME_HEIGHT = 720;
        this.checkedPlayer = false;
        this.isSecondPlayer = false;
        this.invincibilityTweens = new Map();
        this.assetsLoaded = false;
        this.socket = null;
        this.gameover = false;
    }

    init(data) {
        if (data && data.game) {
            this.gameId = data.game.id;
        }
        this.socket = this.game.socket;
    }

    preload() {
        this.load.image('player', playerImage);
        this.load.image('player2', player2Image);
        this.load.image('dark_background', darkBackgroundImage);
        this.load.image('barrier', barrierImage);
        this.load.image('projectile', projectileImage);
        this.load.image('projectile2', projectile2Image);
        this.load.image('playershoot', playerShootImage);
        this.load.image('player2shoot', player2ShootImage);
    }

    create() {
        this.createGameObjects();
        this.createCurrentPlayer();
        this.createUI();
        this.setupInput();
        this.connectToServer();
        this.events.on('update', this.update, this);
    }

    createGameObjects() {
        this.add.image(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2, 'dark_background').setDisplaySize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.barriers = this.physics.add.staticGroup();
        this.barriers.create(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2, 'barrier')
            .setDisplaySize(100, 300)
            .refreshBody();
        this.graphics = this.add.graphics();
    }

    createCurrentPlayer() {
        const startX = this.GAME_WIDTH * 0.25;
        const startY = this.GAME_HEIGHT * 0.5;
        this.currentPlayer = this.physics.add.sprite(startX, startY, 'player').setScale(0.2);
    }

    createUI() {
        this.inkBar = this.add.graphics();
        this.barBackground = this.add.graphics();
        this.scoreText = this.add.text(20, 20, '', { fontSize: '32px', fill: '#fff' });
        this.projectileContainer = this.add.container(20, this.GAME_HEIGHT - 70);
        this.projectileSprites = [];
        this.livesContainer = this.add.container(20, this.GAME_HEIGHT - 100);
        this.lifeSprites = [];
        this.updateProjectileSprites();
        this.updateLifeSprites();
    }

    updateProjectileSprites() {
        this.projectileSprites.forEach(sprite => sprite.destroy());
        this.projectileSprites = [];

        const fullProjectiles = Math.floor(this.projectileCount);
        for (let i = 0; i < fullProjectiles; i++) {
            const spriteName = this.isSecondPlayer ? 'projectile2' : 'projectile';
            const sprite = this.add.image(5 + i * 30, 0, spriteName).setScale(0.05);
            this.projectileSprites.push(sprite);
            this.projectileContainer.add(sprite);
        }

        const fraction = this.projectileCount - fullProjectiles;
        if (fraction > 0) {
            const spriteName = this.isSecondPlayer ? 'projectile2' : 'projectile';
            const sprite = this.add.image(5 + fullProjectiles * 30, 0, spriteName)
                .setScale(0.05)
                .setAlpha(fraction);
            this.projectileSprites.push(sprite);
            this.projectileContainer.add(sprite);
        }
    }

    updateLifeSprites() {
        this.lifeSprites.forEach(sprite => sprite.destroy());
        this.lifeSprites = [];

        const lives = this.currentPlayer ? this.currentPlayer.lives : 3;
        for (let i = 0; i < lives; i++) {
            const spriteName = this.isSecondPlayer ? 'player2' : 'player';
            const sprite = this.add.image(10 + i * 50, -10, spriteName).setScale(0.07);
            this.lifeSprites.push(sprite);
            this.livesContainer.add(sprite);
        }
    }

    setupInput() {
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.input.on('pointerdown', this.startDrawing, this);
        this.input.on('pointermove', this.continueDrawing, this);
        this.input.on('pointerup', this.stopDrawing, this);
        this.input.on('pointerout', this.stopDrawing, this);

        window.addEventListener('mouseout', (event) => {
            if (event.relatedTarget === null) {
                this.stopDrawing();
            }
        });

        this.input.keyboard.on('keydown-SPACE', this.shootProjectile, this);
        this.input.keyboard.on('keydown-E', this.cancelDrawing, this);
    }

    connectToServer() {
        if (!this.socket) {
            this.socket = this.game.socket;
        }

        this.socket.on('gameState', this.handleGameState.bind(this));
        this.socket.on('newProjectile', this.handleNewProjectile.bind(this));
        this.socket.on('playerDisconnected', this.handlePlayerDisconnected.bind(this));
        this.socket.on('pointScored', this.resetMap.bind(this));
    }

    resetMap() {
        this.playerProjectiles.forEach(projectile => projectile.destroy());
        this.enemyProjectiles.forEach(projectile => projectile.destroy());
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();
        this.drawPath = [];
        this.graphics.clear();
        this.projectileCount = 10;
        this.currentInk = 200;
        this.stopInvincibilityAnimation(this.currentPlayer);
        this.otherPlayers.forEach(player => {
            this.stopInvincibilityAnimation(player);
        });
        this.game.socket.emit('requestGameState', this.gameId);
    }

    update() {
        if (this.gameover) return;
        this.handlePlayerMovement();
        if (this.currentPlayer && this.currentPlayer.active) {
            this.moveProjectiles();
            this.redrawPath();
            this.updateUI();
        }

        const oldProjectileCount = Math.floor(this.projectileCount);
        this.projectileCount = Math.min(this.projectileCount + 0.001, 10);
        if (Math.floor(this.projectileCount) !== oldProjectileCount) {
            this.updateProjectileSprites();
        }

        if (!this.isDrawing) {
            this.currentInk = Math.min(this.currentInk + 0.4, this.MAX_INK);
        }
    }

    redrawPath() {
        if (this.drawPath.length > 1) {
            this.graphics.clear().lineStyle(2, 0xff0000);
            this.graphics.beginPath();
            const startX = this.currentPlayer.x + this.drawPath[0].x;
            const startY = this.currentPlayer.y + this.drawPath[0].y;
            this.graphics.moveTo(startX, startY);
            for (let i = 1; i < this.drawPath.length; i++) {
                const worldX = this.currentPlayer.x + this.drawPath[i].x;
                const worldY = this.currentPlayer.y + this.drawPath[i].y;
                this.graphics.lineTo(worldX, worldY);
            }
            this.graphics.strokePath();
        }
    }

    handlePlayerMovement() {
        if (!this.currentPlayer || !this.cursors) return;

        let movement = { x: 0, y: 0 };

        if (this.cursors.left.isDown) {
            movement.x = -0.5;
        } else if (this.cursors.right.isDown) {
            movement.x = 0.5;
        }

        if (this.cursors.up.isDown) {
            movement.y = -0.5;
        } else if (this.cursors.down.isDown) {
            movement.y = 0.5;
        }

        if (movement.x !== 0 || movement.y !== 0) {
            this.socket.emit('playerMovement', {
                gameId: this.gameId,
                playerId: this.socket.id,
                movement: movement
            });
        }
    }

    startDrawing(pointer) {
        if (this.currentInk > 0) {
            this.isDrawing = true;
            const relativeX = pointer.x - this.currentPlayer.x;
            const relativeY = pointer.y - this.currentPlayer.y;
            this.drawPath = [{ x: relativeX, y: relativeY }];
            this.graphics.clear().lineStyle(2, 0xff0000);
        }
    }

    continueDrawing(pointer) {
        const BOUNDARY_BUFFER = 1;
        const isNearBounds = pointer.x < BOUNDARY_BUFFER ||
            pointer.x > this.GAME_WIDTH - BOUNDARY_BUFFER ||
            pointer.y < BOUNDARY_BUFFER ||
            pointer.y > this.GAME_HEIGHT - BOUNDARY_BUFFER;

        if (isNearBounds) {
            this.stopDrawing();
            return;
        }

        if (this.isDrawing && this.currentInk > 0) {
            const relativeX = pointer.x - this.currentPlayer.x;
            const relativeY = pointer.y - this.currentPlayer.y;
            const lastPoint = this.drawPath[this.drawPath.length - 1];
            const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, relativeX, relativeY);
            const inkUsed = distance * 0.1;
            if (this.currentInk >= inkUsed) {
                this.drawPath.push({ x: relativeX, y: relativeY });
                this.currentInk -= inkUsed;
                this.redrawPath();
            }
        }
    }

    stopDrawing() {
        if (this.isDrawing) {
            const pathDistance = this.calculatePathDistance(this.drawPath);
            if (pathDistance < this.MIN_PATH_LENGTH) {
                this.currentInk = Math.min(this.MAX_INK, this.currentInk + pathDistance * 0.1);
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

    shootProjectile() {
        if (this.drawPath.length > 1 && this.projectileCount > 1) {
            const worldPath = this.drawPath.map(point => ({
                x: this.currentPlayer.x + point.x,
                y: this.currentPlayer.y + point.y
            }));

            const pathDistance = this.calculatePathDistance(worldPath);

            if (pathDistance >= this.MIN_PATH_LENGTH) {
                const shootSprite = this.isSecondPlayer ? 'player2shoot' : 'playershoot';
                this.currentPlayer.setTexture(shootSprite);

                this.time.delayedCall(320, () => {
                    const normalSprite = this.isSecondPlayer ? 'player2' : 'player';
                    if (this.currentPlayer && this.currentPlayer.active) {
                        this.currentPlayer.setTexture(normalSprite);
                    }
                });

                this.game.socket.emit('shootProjectile', {
                    gameId: this.gameId,
                    playerId: this.game.socket.id,
                    path: worldPath
                });
                this.projectileCount--;
                this.updateProjectileSprites();
                this.graphics.clear();
            }
        }
    }

    handleGameState(gameState) {
        if (!gameState || !gameState.players) return;
        this.updatePlayers(gameState.players);
        this.updateProjectiles(gameState.projectiles);
        const currentPlayer = gameState.players.find(player => player.id === this.game.socket.id);
        if (currentPlayer) {
            this.updateScore(currentPlayer.score);
        }
    }

    updatePlayers(players) {
        const existingPlayerIds = new Set(this.otherPlayers.keys());
        players.forEach(playerInfo => {
            if (playerInfo.id === this.socket.id) {
                this.updateCurrentPlayer(playerInfo);
            } else {
                existingPlayerIds.delete(playerInfo.id);
                this.updateOtherPlayer(playerInfo);
            }
        });
        existingPlayerIds.forEach(id => {
            const player = this.otherPlayers.get(id);
            if (player) {
                player.destroy();
                this.otherPlayers.delete(id);
            }
        });
    }

    updateCurrentPlayer(playerInfo) {
        if (!this.currentPlayer || !this.checkedPlayer || (this.isSecondPlayer !== playerInfo.isSecondPlayer)) {
            if (this.currentPlayer) {
                this.currentPlayer.destroy();
            }
            const sprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
            this.currentPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, sprite)
                .setScale(0.2)
                .setDepth(1);
            this.checkedPlayer = true;
            this.isSecondPlayer = playerInfo.isSecondPlayer;
        }

        this.currentPlayer.setPosition(playerInfo.x, playerInfo.y);
        this.currentPlayer.lives = playerInfo.lives;
        this.updateLifeSprites();
        this.updatePlayerInvincibility(this.currentPlayer, playerInfo.isInvincible);
    }

    updateOtherPlayer(playerInfo) {
        let otherPlayer = this.otherPlayers.get(playerInfo.id);
        const expectedSprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
        if (!otherPlayer || otherPlayer.texture.key !== expectedSprite) {
            if (otherPlayer) {
                otherPlayer.destroy();
            }
            otherPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, expectedSprite)
                .setScale(0.2)
                .setDepth(1);
            this.otherPlayers.set(playerInfo.id, otherPlayer);
        }

        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        otherPlayer.setVisible(true);
        otherPlayer.setAlpha(1);
        this.updatePlayerInvincibility(otherPlayer, playerInfo.isInvincible);
    }

    updatePlayerInvincibility(playerSprite, isInvincible) {
        if (isInvincible && !this.invincibilityTweens.has(playerSprite)) {
            this.startInvincibilityAnimation(playerSprite);
        } else if (!isInvincible && this.invincibilityTweens.has(playerSprite)) {
            this.stopInvincibilityAnimation(playerSprite);
        }
    }

    startInvincibilityAnimation(playerSprite) {
        const tween = this.tweens.add({
            targets: playerSprite,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        this.invincibilityTweens.set(playerSprite, tween);
    }

    stopInvincibilityAnimation(playerSprite) {
        const tween = this.invincibilityTweens.get(playerSprite);
        if (tween) {
            tween.stop();
            this.invincibilityTweens.delete(playerSprite);
            playerSprite.alpha = 1;
        }
    }

    updateProjectiles(projectilesInfo) {
        if (!projectilesInfo) return;

        this.playerProjectiles.forEach(projectile => projectile.destroy());
        this.enemyProjectiles.forEach(projectile => projectile.destroy());
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();

        projectilesInfo.forEach(projInfo => {
            const sprite = projInfo.isSecondPlayer ? 'projectile2' : 'projectile';
            const projectile = this.physics.add.image(projInfo.x, projInfo.y, sprite)
                .setScale(0.07)
                .setDepth(2);
            projectile.path = projInfo.path;
            projectile.pathIndex = projInfo.pathIndex;
            projectile.projectileId = projInfo.id;
            projectile.playerId = projInfo.playerId;

            if (projInfo.shooter_id === this.game.socket.id) {
                this.playerProjectiles.set(projInfo.id, projectile);
            } else {
                this.enemyProjectiles.set(projInfo.id, projectile);
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
                const speed = 5;
                const nextX = projectile.x + Math.cos(Phaser.Math.Angle.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y)) * speed;
                const nextY = projectile.y + Math.sin(Phaser.Math.Angle.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y)) * speed;

                projectile.x = nextX;
                projectile.y = nextY;

                if (Phaser.Math.Distance.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y) < 5) {
                    projectile.pathIndex++;
                }
            }
        });
    }

    handleNewProjectile(projectileInfo) {
        const sprite = projectileInfo.isSecondPlayer ? 'projectile2' : 'projectile';
        const projectile = this.physics.add.image(projectileInfo.path[0].x, projectileInfo.path[0].y, sprite)
            .setScale(0.07)
            .setDepth(2);
        projectile.path = projectileInfo.path;
        projectile.pathIndex = 0;
        projectile.projectileId = projectileInfo.id;
        projectile.playerId = projectileInfo.playerId;

        if (projectileInfo.playerId === this.game.socket.id) {
            this.playerProjectiles.set(projectileInfo.id, projectile);
        } else {
            this.enemyProjectiles.set(projectileInfo.id, projectile);
        }
    }

    handlePlayerDisconnected(playerId) {
        this.gameover = true;
        this.physics.pause();

        console.log('Player disconnected:', playerId);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        overlay.setDepth(10);

        const disconnectText = this.add.text(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 - 50, 'Opponent Disconnected', {
            fontSize: '48px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(11);

        const backButton = this.add.text(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 50, 'Back to Lobby', {
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

    updateScore(score) {
        this.scoreText.setText(`Score: ${score}`);
    }

    updateUI() {
        this.inkBar.clear().fillStyle(0x000000, 1).fillRect(20, this.GAME_HEIGHT - 40, (this.currentInk / this.MAX_INK) * 200, 20);
        this.barBackground.clear().fillStyle(0x000000, 0.5).fillRect(20, this.GAME_HEIGHT - 40, 200, 20);
        this.updateProjectileSprites();
        this.updateLifeSprites();
    }

    shutdown() {
        window.removeEventListener('mouseout', this.stopDrawing);
        this.cleanupScene();
        super.shutdown();
    }

    cancelDrawing() {
        if (this.isDrawing) {
            const pathDistance = this.calculatePathDistance(this.drawPath);
            this.currentInk = Math.min(this.MAX_INK, this.currentInk + pathDistance * 0.1);
            this.drawPath = [];
            this.graphics.clear();
            this.isDrawing = false;
        }
    }

    cleanupScene() {
        this.invincibilityTweens.forEach(tween => tween.stop());
        this.invincibilityTweens.clear();

        if (this.graphics) this.graphics.clear();
        if (this.inkBar) this.inkBar.clear();
        if (this.barBackground) this.barBackground.clear();

        if (this.socket) {
            this.socket.off('gameState', this.handleGameState);
            this.socket.off('newProjectile', this.handleNewProjectile);
            this.socket.off('playerDisconnected', this.handlePlayerDisconnected);
            this.socket.off('pointScored', this.resetMap);
        }

        this.playerProjectiles.forEach(p => p.destroy());
        this.enemyProjectiles.forEach(p => p.destroy());
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();

        this.otherPlayers.forEach(p => p.destroy());
        this.otherPlayers.clear();

        if (this.currentPlayer) {
            this.currentPlayer.destroy();
            this.currentPlayer = null;
        }
    }
}
