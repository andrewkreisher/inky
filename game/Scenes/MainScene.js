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
        this.GAME_WIDTH = 1280;
        this.GAME_HEIGHT = 720;
        this.checkedPlayer = false;
        this.isSecondPlayer = false;
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
        ['player', 'player2', 'background', 'barrier', 'projectile', 'projectile2'].forEach(asset => {
            this.load.image(asset, `assets/${asset}.png`);
            this.load.on(`filecomplete-image-${asset}`, () => console.log(`${asset} loaded successfully`));
        });
        this.load.on('loaderror', (file) => console.error('Error loading asset:', file.src));
    }
    
    create() {
        this.createGameObjects();
        this.createCurrentPlayer();
        this.createUI();
        this.setupInput();
        this.connectToServer();
    }

    createGameObjects() {
        this.add.image(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2, 'background').setDisplaySize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.barrier = this.physics.add.image(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2, 'barrier').setScale(0.5);
        this.barrier.setImmovable(true);
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
        this.socket.on('pointScored', this.resetMap.bind(this));
    }

    resetMap() {
        console.log('resetting map');
        //destroy all active projectiles
        this.playerProjectiles.forEach(projectile => projectile.destroy());
        this.enemyProjectiles.forEach(projectile => projectile.destroy());
        this.playerProjectiles.clear();
        this.enemyProjectiles.clear();
    
        this.drawPath = [];
        this.graphics.clear(); 

        // reset projectile count and ink 
        this.projectileCount = 10;
        this.currentInk = 200;
    
        // Request a fresh game state from the server
        this.game.socket.emit('requestGameState', this.gameId);
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

        const oldProjectileCount = Math.floor(this.projectileCount);
        this.projectileCount = Math.min(this.projectileCount + 0.01, 10);
        if (Math.floor(this.projectileCount) !== oldProjectileCount) {
            this.updateProjectileSprites();
        }

        // increase resources
        if (!this.isDrawing) {
            this.currentInk = Math.min(this.currentInk + 0.4, this.MAX_INK);
        }
        this.projectileCount = Math.min(this.projectileCount + 0.001, 10);
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
            const relativeX = pointer.x - this.currentPlayer.x;
            const relativeY = pointer.y - this.currentPlayer.y;
            const lastPoint = this.drawPath[this.drawPath.length - 1];
            const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, relativeX, relativeY);
            
            const inkUsed = distance * 0.1; // Adjust this factor to control ink usage
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
            console.log('Path distance:', pathDistance);
            if (pathDistance < this.MIN_PATH_LENGTH) {
                // Refund all ink used
                this.currentInk = Math.min(this.MAX_INK, this.currentInk + pathDistance * 0.1);
                this.drawPath = [];
                this.graphics.clear();
            } else {
                // Snap the path to the player's center
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
                path[i-1].x, path[i-1].y,
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
                console.log('Emitting shootProjectile event');
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
        if (!this.currentPlayer || !this.checkedPlayer) {
            this.currentPlayer.destroy();
            const sprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
            this.currentPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, sprite).setScale(0.2);
            this.checkedPlayer = true;
            this.isSecondPlayer = playerInfo.isSecondPlayer;
        }
        this.currentPlayer.setPosition(playerInfo.x, playerInfo.y);
        
        if (this.currentPlayer.lives !== playerInfo.lives) {
            this.currentPlayer.lives = playerInfo.lives;
            this.updateLifeSprites();
        }
    }
    
    updateOtherPlayer(playerInfo) {
        let otherPlayer = this.otherPlayers.get(playerInfo.id);
        if (!otherPlayer) {
            const sprite = playerInfo.isSecondPlayer ? 'player2' : 'player';
            otherPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, sprite).setScale(0.2);
            this.otherPlayers.set(playerInfo.id, otherPlayer);
        }
        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
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
            const sprite = projInfo.isSecondPlayer ? 'projectile2' : 'projectile';
            const projectile = this.physics.add.image(projInfo.x, projInfo.y, sprite).setScale(0.07);
            projectile.path = projInfo.path;
            projectile.pathIndex = projInfo.pathIndex;
            projectile.projectileId = projInfo.id;
            projectile.playerId = projInfo.playerId;
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
                const speed = 5;
                projectile.x += Math.cos(angle) * speed;
                projectile.y += Math.sin(angle) * speed;
                
                if (Phaser.Math.Distance.Between(projectile.x, projectile.y, targetPoint.x, targetPoint.y) < 5) {
                    projectile.pathIndex++;
                }
            }
        });
    }
    
    handleNewProjectile(projectileInfo) {
        const sprite = projectileInfo.isSecondPlayer ? 'projectile2' : 'projectile';
        console.log('sprite:', sprite);
        console.log('projectileInfo:', projectileInfo);
        const projectile = this.physics.add.image(projectileInfo.path[0].x, projectileInfo.path[0].y, sprite).setScale(0.07);
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
        this.inkBar.clear().fillStyle(0x000000, 1).fillRect(20, this.GAME_HEIGHT - 40, (this.currentInk / this.MAX_INK) * 200, 20);
        this.barBackground.clear().fillStyle(0x000000, 0.5).fillRect(20, this.GAME_HEIGHT - 40, 200, 20);
    
        this.updateProjectileSprites();
        this.updateLifeSprites();
    }
}