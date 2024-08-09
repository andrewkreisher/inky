export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.currentPlayer = null;
        this.otherPlayers = new Map();
        this.playerProjectiles = new Map();
        this.enemyProjectiles = new Map();
        this.drawPath = [];
        this.currentInk = 200;
        this.projectileCount = 10;
        this.MAX_INK = 400;
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
        this.createCurrentPlayer();
        this.createGameObjects();
        this.createUI();
        this.setupInput();
        this.connectToServer();
    }

    createCurrentPlayer() {
        this.currentPlayer = this.physics.add.sprite(400, 300, 'player').setScale(0.2);
    }
    
    createGameObjects() {
        this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);
        this.barrier = this.physics.add.image(600, 400, 'barrier').setScale(0.5);
        this.barrier.setImmovable(true);
        this.graphics = this.add.graphics();
    }
    
    createUI() {
        this.inkBar = this.add.graphics();
        this.projectileBar = this.add.graphics();
        this.livesBar = this.add.graphics();
        this.barBackground = this.add.graphics();
        this.scoreText = this.add.text(20, 20, '', { fontSize: '32px', fill: '#fff' });
    }
    
    setupInput() {
        this.cursors = this.input.keyboard.addKeys(
            {up:Phaser.Input.Keyboard.KeyCodes.W,
            down:Phaser.Input.Keyboard.KeyCodes.S,
            left:Phaser.Input.Keyboard.KeyCodes.A,
            right:Phaser.Input.Keyboard.KeyCodes.D});
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
        this.socket.on('playerHit', this.handlePlayerHit.bind(this));
    }

    handlePlayerHit(hitData) {
        if (hitData.playerId === this.game.socket.id) {
            // Update local player state (e.g., lives, position)
            // You might want to add some visual or audio feedback here
            console.log('You were hit!');
        }
    }
    
    update() {
        if (this.currentPlayer && this.currentPlayer.active) {
            this.handlePlayerMovement();
            this.moveProjectiles();
            this.redrawPath(); // Redraw the path every frame
        }
        this.updateUI();
        // increase resources
        if (!this.isDrawing) {
            this.currentInk = Math.min(this.currentInk + 0.4, this.MAX_INK);
        }
        this.projectileCount = Math.min(this.projectileCount + 0.01, 10);
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
            // Start from the pointer position relative to the player
            const relativeX = pointer.x - this.currentPlayer.x;
            const relativeY = pointer.y - this.currentPlayer.y;
            this.drawPath = [{x: relativeX, y: relativeY}];
            this.graphics.clear().lineStyle(2, 0xff0000);
        }
    }
    
    continueDrawing(pointer) {
        if (this.isDrawing && this.currentInk > 0) {
            // Calculate the position relative to the player
            const relativeX = pointer.x - this.currentPlayer.x;
            const relativeY = pointer.y - this.currentPlayer.y;
            this.drawPath.push({ x: relativeX, y: relativeY });
            
            this.currentInk = Math.max(0, this.currentInk - 0.5);
            this.redrawPath(); // Redraw the path immediately
        }
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            // Calculate the offset to move the path to the player's center
            const offsetX = this.drawPath[0].x;
            const offsetY = this.drawPath[0].y;
            
            // Adjust all points in the path
            this.drawPath = this.drawPath.map(point => ({
                x: point.x - offsetX,
                y: point.y - offsetY
            }));
        }
        this.isDrawing = false;
        this.redrawPath(); // Redraw the path to show the snapped position
    }
    
    shootProjectile() {
        if (this.drawPath.length > 1 && this.projectileCount > 1) {
            // Convert relative path to world coordinates at the time of shooting
            const worldPath = this.drawPath.map(point => ({
                x: this.currentPlayer.x + point.x,
                y: this.currentPlayer.y + point.y
            }));
    
            const pathLength = Phaser.Math.Distance.Between(
                worldPath[0].x, worldPath[0].y,
                worldPath[worldPath.length - 1].x, worldPath[worldPath.length - 1].y
            );
    
            if (pathLength >= this.MIN_PATH_LENGTH) {
                console.log('Emitting shootProjectile event');
                this.game.socket.emit('shootProjectile', { 
                    gameId: this.gameId, 
                    playerId: this.game.socket.id, 
                    path: worldPath  // This is now in world coordinates
                });
                this.projectileCount--;
            }
        }
    }
    
    handleGameState(gameState) {
        // console.log('gamestate', gameState);
        this.updatePlayers(gameState.players);
        this.updateProjectiles(gameState.projectiles);
        this.updateScore(gameState.players.find(player => player.id === this.game.socket.id).score);
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
        
        // Destroy all existing projectile sprites
        this.playerProjectiles.forEach(projectile => projectile.destroy());
        this.enemyProjectiles.forEach(projectile => projectile.destroy());

        // Clear out old projectiles
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();
        // this.enemyProjectilesGroup.clear(true, true);
    
        projectilesInfo.forEach(projInfo => {
            const projectile = this.physics.add.image(projInfo.x, projInfo.y, 'projectile').setScale(0.07);
            projectile.path = projInfo.path;
            projectile.pathIndex = projInfo.pathIndex;
            projectile.projectileId = projInfo.id;
            projectile.playerId = projInfo.playerId;
            console.log('projectile:', projInfo);
            console.log('id:', this.game.socket.id);
            if (projInfo.shooter_id === this.game.socket.id) {
                this.playerProjectiles.set(projInfo.id, projectile);
            } else {
                this.enemyProjectiles.set(projInfo.id, projectile);
                // this.enemyProjectilesGroup.add(projectile);
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
        this.inkBar.clear().fillStyle(0x000000, 1).fillRect(20, this.game.config.height - 40, this.currentInk * 2, 20);
        this.projectileBar.clear().fillStyle(0xff0000, 1).fillRect(20, this.game.config.height - 70, this.projectileCount * 20, 20);
        this.livesBar.clear().fillStyle(0x00ff00, 1).fillRect(20, this.game.config.height - 100, (this.currentPlayer ? this.currentPlayer.lives : 3) * 30, 20);
        //transparent background around ink bar projectile bar and lives bar to make it easier to read
        this.barBackground.clear().fillStyle(0x000000, 0.5).fillRect(20, this.game.config.height - 40, this.currentInk * 2, 20);

    }
}