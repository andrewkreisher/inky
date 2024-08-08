export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.currentPlayer = null;
        this.otherPlayers = new Map();
        this.playerProjectiles = new Map();
        this.enemyProjectiles = new Map();
        this.drawPath = [];
        this.currentInk = 50;
        this.projectileCount = 10;
        this.MAX_INK = 200;
        this.MIN_PATH_LENGTH = 200;
    }

    init(data) {
        console.log('Initializing MainScene with data:', data);
        if (data.game) {
            this.gameId = data.game.id;
            this.gameData = data.game;
            console.log('Game ID set to:', this.gameId);
        } else {
            console.error('Game data not provided to MainScene');
        }
    }
    
    preload() {
        ['player', 'background', 'barrier', 'projectile'].forEach(asset => {
            this.load.image(asset, `assets/${asset}.png`);
            this.load.on(`filecomplete-image-${asset}`, () => console.log(`${asset} loaded successfully`));
        });
        this.load.on('loaderror', (file) => console.error('Error loading asset:', file.src));
    }
    
    create() {
        this.createGameObjects();
        this.createUI();
        this.setupInput();
        this.createCurrentPlayer();
        this.setupCollisions();
        this.connectToServer();
    }

    createCurrentPlayer() {
        this.currentPlayer = this.physics.add.sprite(400, 300, 'player').setScale(0.2);
        this.currentPlayer.setCollideWorldBounds(true);
    }

    setupCollisions() {
        this.enemyProjectilesGroup = this.physics.add.group();
        this.physics.add.overlap(this.currentPlayer, this.enemyProjectilesGroup, this.handlePlayerHit, null, this);
    }


    handlePlayerHit(player, projectile) {
        if (!player || !projectile) return;

        console.log('Player hit:', this.game.socket.id);
        this.game.socket.emit('playerHit', {
            gameId: this.gameId,
            hitPlayerId: this.game.socket.id,
            projectileId: projectile.projectileId
        });
        
        // Remove the projectile locally
        this.enemyProjectiles.delete(projectile.projectileId);
        projectile.destroy();
    }
    
    createGameObjects() {
        this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);
        this.barrier = this.physics.add.staticImage(600, 400, 'barrier').setScale(0.5);
        this.graphics = this.add.graphics();
    }
    
    createUI() {
        this.inkBar = this.add.graphics();
        this.projectileBar = this.add.graphics();
        this.livesBar = this.add.graphics();
        this.scoreText = this.add.text(20, 20, '', { fontSize: '32px', fill: '#fff' });
    }
    
    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.on('pointerdown', this.startDrawing, this);
        this.input.on('pointermove', this.continueDrawing, this);
        this.input.on('pointerup', this.stopDrawing, this);
        this.input.keyboard.on('keydown-SPACE', this.shootProjectile, this);
    }
    
    connectToServer() {
        this.socket = this.game.socket;
        this.socket.on('gameState', this.handleGameState.bind(this));
        this.socket.on('newProjectile', this.handleNewProjectile.bind(this));
        this.socket.on('playerDisconnected', this.handlePlayerDisconnected.bind(this));
    }
    
    update() {
        if (this.currentPlayer && this.currentPlayer.active) {
            this.handlePlayerMovement();
            this.moveProjectiles();
        }
        this.updateUI();
        if (!this.isDrawing) {
            this.currentInk = Math.min(this.currentInk + 0.3, this.MAX_INK);
        }
    }
    
    handlePlayerMovement() {
        const movement = {
            x: (this.cursors.left.isDown ? -1 : 0) + (this.cursors.right.isDown ? 1 : 0),
            y: (this.cursors.up.isDown ? -1 : 0) + (this.cursors.down.isDown ? 1 : 0)
        };
        if (movement.x !== 0 || movement.y !== 0) {
            this.game.socket.emit('playerMovement', { gameId: this.gameId, playerId: this.game.socket.id, movement: movement });
        }
    }
    
    startDrawing(pointer) {
        if (this.currentInk > 0) {
            this.isDrawing = true;
            this.drawPath = [{ x: pointer.x, y: pointer.y }];
            this.graphics.clear().lineStyle(2, 0xff0000);
            this.graphics.beginPath().moveTo(pointer.x, pointer.y);
        }
    }
    
    continueDrawing(pointer) {
        if (this.isDrawing && this.currentInk > 0) {
            this.drawPath.push({ x: pointer.x, y: pointer.y });
            this.graphics.lineTo(pointer.x, pointer.y).stroke();
            this.currentInk = Math.max(0, this.currentInk - 0.5);
        }
    }
    
    stopDrawing() {
        this.isDrawing = false;
        this.graphics.closePath();
    }
    
    shootProjectile() {
        if (this.drawPath.length > 1 && this.projectileCount > 0) {
            const pathLength = Phaser.Math.Distance.Between(
                this.drawPath[0].x, this.drawPath[0].y,
                this.drawPath[this.drawPath.length - 1].x, this.drawPath[this.drawPath.length - 1].y
            );
            if (pathLength >= this.MIN_PATH_LENGTH) {
                console.log('Emitting shootProjectile event');
                this.game.socket.emit('shootProjectile', { gameId: this.gameId, playerId: this.game.socket.id, path: this.drawPath });
                this.projectileCount--;
            }
        }
    }
    
    handleGameState(gameState) {
        // console.log('gamestate', gameState);
        this.updatePlayers(gameState.players);
        this.updateProjectiles(gameState.projectiles);
        this.updateScore(gameState.score);
    }
    
    updatePlayers(players) {
        players.forEach(playerInfo => {
            if (playerInfo.id === this.socket.id) {
                this.updateCurrentPlayer(playerInfo);
            } else {
                this.updateOtherPlayer(playerInfo);
            }
        });
    }
    
    updateCurrentPlayer(playerInfo) {
        // console.log('playerInfo', playerInfo);
        // console.log('currentplayer', this.currentPlayer);
        if (!this.currentPlayer) {
            this.currentPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'player').setScale(0.2);
            this.physics.add.collider(this.currentPlayer, this.barrier);
        }
        this.currentPlayer.setPosition(playerInfo.x, playerInfo.y);
        this.currentPlayer.lives = playerInfo.lives;
        // console.log('Current player position:', this.currentPlayer.x, this.currentPlayer.y);
    }
    
    updateOtherPlayer(playerInfo) {
        let otherPlayer = this.otherPlayers.get(playerInfo.id);
        if (!otherPlayer) {
            otherPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'player').setScale(0.2);
            this.otherPlayers.set(playerInfo.id, otherPlayer);
        }
        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        // console.log('Other player position:', otherPlayer.x, otherPlayer.y);
    }
    
    updateProjectiles(projectilesInfo) {
        if (!projectilesInfo) return;
        
        // Clear out old projectiles
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();
        this.enemyProjectilesGroup.clear(true, true);
    
        projectilesInfo.forEach(projInfo => {
            const projectile = this.physics.add.image(projInfo.x, projInfo.y, 'projectile').setScale(0.07);
            projectile.path = projInfo.path;
            projectile.pathIndex = projInfo.pathIndex;
            projectile.projectileId = projInfo.id;
            projectile.playerId = projInfo.playerId;
    
            if (projInfo.playerId === this.game.socket.id) {
                this.playerProjectiles.set(projInfo.id, projectile);
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
                return;
            }
            if (projectile.path && projectile.pathIndex < projectile.path.length - 1) {
                const targetPoint = projectile.path[projectile.pathIndex + 1];
                const angle = Phaser.Math.Angle.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y);
                const speed = 5; // Adjust as needed
                projectile.x += Math.cos(angle) * speed;
                projectile.y += Math.sin(angle) * speed;
                
                if (Phaser.Math.Distance.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y) < 5) {
                    projectile.pathIndex++;
                }
            }
        });
    }
    
    handleNewProjectile(projectileInfo) {
        console.log('New projectile:', projectileInfo);
        const projectile = this.physics.add.image(projectileInfo.path[0].x, projectileInfo.path[0].y, 'projectile').setScale(0.07);
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
        const player = this.otherPlayers.get(playerId);
        if (player) {
            player.destroy();
            this.otherPlayers.delete(playerId);
        }
    }
    
    updateScore(score) {
        this.scoreText.setText(`Score: ${score}`);
    }
    
    updateUI() {
        this.inkBar.clear().fillStyle(0x0000ff, 1).fillRect(20, this.game.config.height - 40, this.currentInk * 2, 20);
        this.projectileBar.clear().fillStyle(0xff0000, 1).fillRect(20, this.game.config.height - 70, this.projectileCount * 20, 20);
        this.livesBar.clear().fillStyle(0x00ff00, 1).fillRect(20, this.game.config.height - 100, (this.currentPlayer ? this.currentPlayer.lives : 3) * 30, 20);
    }
}