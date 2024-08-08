export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.path = null;
        this.minPathLength = 200;
        this.currentPlayer = null;
        this.players = [];
        this.drawPath = [];
        this.isDrawing = false;
        this.currentInk = 50;
        this.projectileCount = 10;
        this.velocity = 300;
        this.MAX_INK = 100;
        this.scores = [];
    }
    
    preload() {
        ['player', 'background', 'barrier', 'projectile'].forEach(asset => 
            this.load.image(asset, `assets/${asset}.png`));
    }
    
    create() {
        this.setupGameObjects();
        this.setupInput();
        this.connectSocket();
    }
    
    setupGameObjects() {
        this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);
        this.graphics = this.add.graphics();
        this.projectiles = this.physics.add.group({ runChildUpdate: true });
        this.enemyProjectiles = this.physics.add.group({ runChildUpdate: true });
        this.barrier = this.physics.add.sprite(600, 400, 'barrier').setScale(0.5).setImmovable(true);
        
        this.setupCollisions();
        this.setupUI();
    }
    
    setupCollisions() {
        this.physics.add.overlap(this.projectiles, this.barrier, (barrier, projectile) => projectile.destroy());
        this.physics.add.overlap(this.enemyProjectiles, this.barrier, (barrier, projectile) => projectile.destroy());
    }
    
    setupUI() {
        this.inkBar = this.createBar(20, this.sys.game.config.height - 80, 450, 40, 0x000000);
        this.projectileBar = this.createBar(800, this.sys.game.config.height - 80, 450, 40, 0x3d1d07);
        this.livesBar = this.createBar(500, this.sys.game.config.height - 80, 200, 40, 0xffffff);
        this.inkLimit = this.add.graphics().fillStyle(0xffff00, 1);
        this.usableInkBar = this.add.graphics();
        
        this.updateUI();
    }
    
    createBar(x, y, width, height, color) {
        return this.add.graphics().fillStyle(color, 0.9).fillRect(x, y, width, height);
    }
    
    setupInput() {
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        
        this.setupDrawingInput();
    }
    
    setupDrawingInput() {
        this.input.on('pointerdown', this.startDrawing, this);
        this.input.on('pointermove', this.continueDrawing, this);
        this.input.on('pointerup', this.stopDrawing, this);
        this.eKey.on('down', this.cancelDrawing, this);
    }
    
    startDrawing(pointer) {
        if (this.currentPlayer && this.currentPlayer.lives > 0) {
            this.isDrawing = true;
            this.drawPath = [{ x: pointer.x, y: pointer.y }];
            this.path = new Phaser.Curves.Path(pointer.x, pointer.y);
            this.usableInk = this.currentInk;
            this.maxUsableInk = this.currentInk;
            this.updateUsableInkBar();
        }
    }
    
    continueDrawing(pointer) {
        if (this.isDrawing && this.usableInk > 0.5) {
            let lastPoint = this.drawPath[this.drawPath.length - 1];
            this.usableInk = Math.max(0, this.usableInk - this.calculateInkUsage(lastPoint, pointer));
            this.drawPath.push({ x: pointer.x, y: pointer.y });
            this.path.lineTo(pointer.x, pointer.y);
            this.redrawPath();
        }
    }
    
    calculateInkUsage(lastPoint, currentPoint) {
        return Math.sqrt(Math.pow(currentPoint.x - lastPoint.x, 2) + Math.pow(currentPoint.y - lastPoint.y, 2)) / 25;
    }
    
    stopDrawing() {
        this.isDrawing = false;
        this.usableInkBar.clear();
        this.inkLimit.clear();
        if (this.path && this.path.getLength() >= this.minPathLength) {
            this.currentInk = this.currentInk - this.maxUsableInk + this.usableInk;
        } else {
            this.drawPath = [];
        }
        this.usableInk = 0;
        this.maxUsableInk = 0;
    }
    
    cancelDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.drawPath = [];
            this.usableInk = 0;
            this.maxUsableInk = 0;
            this.usableInkBar.clear();
            this.inkLimit.clear();
        }
    }
    
    redrawPath() {
        this.graphics.clear();
        this.graphics.lineStyle(4, 0xff0000, 1);
        this.path.draw(this.graphics);
    }
    
    update() {
        if (this.currentPlayer && this.currentPlayer.lives > 0) {
            this.handlePlayerMovement();
            this.handleShooting();
            this.updatePath();
        }
        this.updateResources();
    }
    
    handlePlayerMovement() {
        const movement = this.getMovement();
        if (movement.x || movement.y) {
            this.currentPlayer.setVelocity(movement.x, movement.y);
            this.socket.emit('playerMovement', {id: this.socket.id, position: {x: this.currentPlayer.x, y: this.currentPlayer.y}});
        } else {
            this.currentPlayer.setVelocity(0);
        }
    }
    
    getMovement() {
        return {
            x: (this.cursors.left.isDown ? -this.velocity : 0) + (this.cursors.right.isDown ? this.velocity : 0),
            y: (this.cursors.up.isDown ? -this.velocity : 0) + (this.cursors.down.isDown ? this.velocity : 0)
        };
    }
    
    handleShooting() {
        if (Phaser.Input.Keyboard.JustDown(this.spacebar) && this.path && this.projectileCount >= 1) {
            this.shootProjectile(this.currentPlayer.x, this.currentPlayer.y);
            this.projectileCount--;
            this.updateProjectileBar();
        }
    }
    
    updatePath() {
        if (this.path && !this.isDrawing) {
            this.translatePath();
        }
    }
    
    updateResources() {
        this.currentInk = Math.min(this.MAX_INK, this.currentInk + 0.1);
        this.projectileCount = Math.min(10, this.projectileCount + 0.01);
        this.updateUI();
    }
    
    updateUI() {
        this.updateInkBar();
        this.updateUsableInkBar();
        this.updateProjectileBar();
        this.updateLivesBar();
    }
    
    // ... (rest of the methods like connectSocket, createProjectile, etc. remain largely unchanged)
    connectSocket() {
        this.socket = this.game.socket;

        this.socket.on('currentGame', this.handleCurrentGame.bind(this));
        this.socket.on('newPlayer', this.addOtherPlayer.bind(this));
        this.socket.on('playerDisconnected', this.removePlayer.bind(this));
        this.socket.on('playerMoved', this.handlePlayerMoved.bind(this));
        this.socket.on('pointScored', this.handlePointScored.bind(this));
        this.socket.on('createProjectile', this.createEnemyProjectileFromPath.bind(this));
        this.socket.on('playerHit', this.handlePlayerHit.bind(this));

        this.socket.emit('getCurrentGame', this.socket.id);
    }

    handleCurrentGame(game) {
        const playerData = game.playerData;
        Object.values(playerData).forEach(playerToAdd => {
            if (playerToAdd.id !== this.socket.id) {
                this.addCurrentPlayer(playerToAdd, playerToAdd.id);
            } else {
                this.addSelf(playerToAdd);
            }
        });
        this.updateScoreboard(playerData);
    }

    addCurrentPlayer(player, id) {
        const otherPlayer = this.physics.add.sprite(player.x, player.y, 'player').setScale(0.2);
        this.physics.add.overlap(this.projectiles, otherPlayer, (otherPlayer, projectile) => projectile.destroy());
        otherPlayer.id = id;
        otherPlayer.lives = player.lives;
        otherPlayer.score = 0;
        this.players.push(otherPlayer);
    }

    addSelf(playerData) {
        this.currentPlayer = this.physics.add.sprite(playerData.x, playerData.y, 'player').setScale(0.2).setDepth(-1);
        this.currentPlayer.id = playerData.id;
        this.currentPlayer.lives = 3;
        this.currentPlayer.score = 0;
        this.currentPlayer.setCollideWorldBounds(true);
        this.physics.add.collider(this.currentPlayer, this.barrier);
        this.physics.add.overlap(this.enemyProjectiles, this.currentPlayer, this.handlePlayerCollision.bind(this));
        this.updateLivesBar();
    }

    handlePlayerCollision(currentPlayer, projectile) {
        projectile.destroy();
        currentPlayer.lives--;
        this.updateLivesBar();
        this.socket.emit('playerHit', this.socket.id);
    }

    addOtherPlayer(playerInfo) {
        const otherPlayer = this.physics.add.sprite(playerInfo.data.x, playerInfo.data.y, 'player').setScale(0.2);
        this.physics.add.overlap(this.projectiles, otherPlayer, (otherPlayer, projectile) => projectile.destroy());
        otherPlayer.playerId = playerInfo.id;
        otherPlayer.lives = playerInfo.data.lives;
        this.players.push(otherPlayer);
    }

    removePlayer(id) {
        const removedPlayer = this.players.find(player => player.id === id);
        if (removedPlayer) {
            removedPlayer.destroy();
            this.players = this.players.filter(player => player.id !== id);
        }
    }

    handlePlayerMoved(movementData) {
        if (movementData.id === this.socket.id) return;
        const playerToMove = this.players.find(player => player.id === movementData.id);
        if (playerToMove) {
            playerToMove.x = movementData.player.x;
            playerToMove.y = movementData.player.y;
        }
    }

    handlePointScored(playerData) {
        this.destroyAllProjectiles();
        playerData.forEach(player => {
            if (player.id === this.currentPlayer.id) {
                this.updateCurrentPlayer(player);
            } else {
                this.updateOtherPlayer(player);
            }
        });
        this.updateScoreboard(playerData);
    }

    updateCurrentPlayer(player) {
        this.currentPlayer.score = player.score;
        this.currentPlayer.x = player.x;
        this.currentPlayer.y = player.y;
        this.currentPlayer.lives = 3;
        this.updateLivesBar();
    }

    updateOtherPlayer(player) {
        const otherPlayer = this.players.find(p => p.id === player.id);
        if (otherPlayer) {
            otherPlayer.x = player.x;
            otherPlayer.y = player.y;
            otherPlayer.lives = 3;
            otherPlayer.score = player.score;
        }
    }

    destroyAllProjectiles() {
        [this.projectiles, this.enemyProjectiles].forEach(group => {
            group.children.each(projectile => projectile.destroy());
        });
    }

    createEnemyProjectileFromPath(data) {
        const enemyPath = new Phaser.Curves.Path(data.path[0].x, data.path[0].y);
        data.path.forEach(point => enemyPath.lineTo(point.x, point.y));

        const enemyProjectile = this.add.follower(enemyPath, data.start.x, data.start.y, 'projectile').setScale(0.07);
        
        const duration = this.calculateProjectileDuration(enemyPath);
        enemyProjectile.startFollow({
            duration: duration,
            repeat: 0,
            rotateToPath: false,
            yoyo: false,
            onComplete: () => enemyProjectile.destroy()
        });

        this.enemyProjectiles.add(enemyProjectile);
    }

    calculateProjectileDuration(path) {
        const pathLength = path.getLength();
        return pathLength < 300 ? 600 : pathLength * 2;
    }

    handlePlayerHit(id) {
        if (id === this.socket.id) return;
        const hitPlayer = this.players.find(player => player.id === id);
        if (hitPlayer) {
            // Handle the hit player (e.g., update their visual state)
        }
    }

    translatePath() {
        if (!this.currentPlayer || this.drawPath.length < 2) return;

        const newPath = new Phaser.Curves.Path(this.currentPlayer.x, this.currentPlayer.y);
        const offsetX = this.drawPath[0].x - this.currentPlayer.x;
        const offsetY = this.drawPath[0].y - this.currentPlayer.y;

        for (let i = 1; i < this.drawPath.length; i++) {
            const point = this.drawPath[i];
            newPath.lineTo(point.x - offsetX, point.y - offsetY);
        }

        this.graphics.clear();
        this.graphics.lineStyle(4, 0xff0000, 1);
        newPath.draw(this.graphics);

        this.path = newPath;
    }

    shootProjectile(x, y) {
        if (this.path && this.path.getLength() > this.minPathLength) {
            const projectile = this.add.follower(this.path, x, y, 'projectile').setScale(0.07);
            
            const duration = this.calculateProjectileDuration(this.path);
            projectile.startFollow({
                duration: duration,
                repeat: 0,
                rotateToPath: false,
                yoyo: false,
                onComplete: () => projectile.destroy()
            });

            this.projectiles.add(projectile);

            this.socket.emit('projectileShot', {
                path: this.drawPath,
                playerId: this.socket.id,
                start: {x: this.currentPlayer.x, y: this.currentPlayer.y}
            });
        }
    }

    updateScoreboard(playerData) {
        this.clearScores();
        playerData.forEach((player, index) => {
            const text = this.add.text(200 + 600 * index, 50, player.score, { fill: '#0F0' }).setFont('100px Arial');
            this.scores.push(text);
        });
    }

    clearScores() {
        this.scores.forEach(text => text.destroy());
        this.scores = [];
    }

    updateProjectileBar() {
        this.projectileBar.clear();
        this.projectileBar.fillStyle(0x3d1d07, 0.9);
        this.projectileBar.fillRect(725, this.sys.game.config.height - 80, 450, 40);
        
        for (let i = 0; i < Math.floor(this.projectileCount); i++) {
            const x = 750 + i * 45;
            const y = this.sys.game.config.height - 60;
            this.projectileBar.fillStyle(0xffffff, 1);
            this.projectileBar.fillCircle(x, y, 10);
        }
    }

    updateLivesBar() {
        this.livesBar.clear();
        this.livesBar.fillStyle(0xffffff, 0.9);
        this.livesBar.fillRect(500, this.sys.game.config.height - 80, 200, 40);
        
        if (this.currentPlayer) {
            for (let i = 0; i < this.currentPlayer.lives; i++) {
                const x = 540 + i * 60;
                const y = this.sys.game.config.height - 60;
                this.livesBar.fillStyle(0xff0000, 1);
                this.livesBar.fillCircle(x, y, 10);
            }
        }
    }

    updateInkBar() {
        this.inkBar.clear();
        const inkBarWidth = (this.currentInk / this.MAX_INK) * 450;
        this.inkBar.fillStyle(0x000000, 0.9);
        this.inkBar.fillRect(20, this.sys.game.config.height - 80, inkBarWidth, 40);
    }

    updateUsableInkBar() {
        if (this.usableInk) {
            this.usableInkBar.clear();
            const inkBarWidth = (this.maxUsableInk - this.usableInk) / this.MAX_INK * 450;
            const limit = (this.maxUsableInk / this.MAX_INK) * 450;
            
            this.usableInkBar.fillStyle(0xff0000, 0.9);
            this.usableInkBar.fillRect(20, 900 - 80, inkBarWidth, 40);
            
            this.inkLimit.clear();
            this.inkLimit.fillStyle(0xffff00, 1);
            this.inkLimit.fillRect(limit + 17, 820, 5, 40);
        }
    }
}