var path;
var minPathLength = 200;
var cursors;
var player;
var barrier; 
var projectiles;
var enemyProjectiles; 
var spacebar;
var graphics;
var socket; 
var drawPath = [];
var isDrawing = false;
var players = [];
var moved = false;
var inkLimit; 
var usableInkBar;
var usableInk;
var inkBar;
var maxUsableInk;
var projectileBar;
var livesBar; 
var movement; 
var projectileCount = 10;
var velocity = 300;
var path2; 
let MAX_INK = 100;
var currentInk = 50; 

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }
    
    preload() {
        this.load.image('player', 'assets/sprite.png');
        this.load.image('background', 'assets/dark_background.png');
        this.load.image('barrier', 'assets/barrier.png');
        this.load.image('projectile', 'assets/projectile.png'); // Load your projectile image test
    }
    
    create() {
        connectSocket(this);
        graphics = this.add.graphics();
        var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);
    
        projectiles = this.physics.add.group({ runChildUpdate: true });
        enemyProjectiles = this.physics.add.group({ runChildUpdate: true });
    
        barrier = this.physics.add.sprite(600, 400, 'barrier').setScale(0.5).setImmovable(true);
        this.physics.add.overlap(projectiles, barrier, (barrier, projectile) => projectile.destroy());
        this.physics.add.overlap(enemyProjectiles, barrier, (barrier, projectile) => projectile.destroy());
    
        inkBar = this.add.graphics();
        inkBar.fillStyle(0x000000, 0.9); 
        inkBar.fillRect(20, this.sys.game.config.height - 80, 450, 40);
        updateInkBar(this, 100);
    
        projectileBar = this.add.graphics();
        projectileBar.fillStyle(0x3d1d07, 0.9); 
        projectileBar.fillRect(800, this.sys.game.config.height - 80, 450, 40);
        updateProjectileBar(this);
    
        livesBar = this.add.graphics();
        livesBar.fillStyle(0xffffff, 0.9);
        livesBar.fillRect(500, this.sys.game.config.height - 80, 200, 40);
        updateLivesBar(this);
    
        inkLimit = this.add.graphics();
        inkLimit.fillStyle(0xffff00, 1); 
    
    
        usableInkBar = this.add.graphics();
    
        cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        
        spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        var eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    
    
        this.input.on('pointerdown', function (pointer) {
                if (player && player.lives > 0) {
                    isDrawing = true;
                    drawPath = [];
                    drawPath.push({ x: pointer.x, y: pointer.y });
                    path = new Phaser.Curves.Path(pointer.x, pointer.y);
                    usableInk = currentInk;
                    maxUsableInk = currentInk;
                    updateUsableInkBar(this);
                }
        });
    
    
    
        eKey.on('down', function () {
            if (isDrawing) {
                isDrawing = false; 
                drawPath = [];
                usableInk = 0;
                maxUsableInk = 0;
                usableInkBar.clear();
                inkLimit.clear();
    
            }
        });
    
    
        this.input.on('pointerup', function () {
            isDrawing = false;
            usableInkBar.clear();
            inkLimit.clear();
            if (path) {
                if (path.getLength() < minPathLength) {
                    drawPath = [];
                } else {
                    currentInk = currentInk - maxUsableInk + usableInk;
                }
            }
            usableInk = 0;
            maxUsableInk = 0;
        });
    
        this.input.on('pointermove', function (pointer) {
            if (isDrawing) {
                if (usableInk > 0.5 ) {
                    let lastPoint = drawPath[drawPath.length - 1];
                    usableInk = Math.max(0, usableInk- Math.sqrt(Math.pow(pointer.x - lastPoint.x, 2) + Math.pow(pointer.y - lastPoint.y, 2))/25);
                    drawPath.push({ x: pointer.x, y: pointer.y });
                    path.lineTo(pointer.x, pointer.y);
                } else {
                    // isDrawing = false;
                    
                }
                if (graphics) {
                    graphics.clear();
                    graphics.lineStyle(4, 0xff0000, 1);
                    path.draw(graphics);
                }
            }
        });
        
    
    }
    
    update() {
        if (player) {
    
            if (player.lives > 0) {
    
                if (moved) {
                    if (movement.x || movement.y) {
                        socket.emit('playerMovement', {id: socket.id, position: {x: player.x, y: player.y}});
                    }
                    moved = false
                }
    
                handlePlayerMovement();
    
                // Shooting
                if (Phaser.Input.Keyboard.JustDown(spacebar)) {
                    if (path) {
                        if (projectileCount >= 1) {
                            shootProjectile(player.x, player.y, this);
                            projectileCount -= 1;
                            updateProjectileBar(this);
                        }
                    }
                    
                }
    
            
            
                // Rotate the path around the sprite
                if (path && !isDrawing) {
                    if (path2) {
                        graphics.clear()
                        path2.destroy()
                    }
                    if (drawPath) {
                        translatePath(path);
                    }
                    
                }
            }
    
            currentInk = Math.min(100, currentInk + 0.1);
            updateInkBar(this);
            updateUsableInkBar(this);
    
            if (projectileCount < 10) {
                if (Math.floor(projectileCount) == Math. floor(projectileCount + 0.01)) {
                    updateProjectileBar(this);
                }
                projectileCount += 0.01;
                
            }
        }
    }
    
}

function connectSocket(scene) {
    socket = scene.game.socket; 

    socket.on('currentPlayers', function(players) {
        Object.keys(players).forEach(function(id) {
            // If the player ID is not the current socket ID, add them to the game
            if (id !== socket.id) {
                addCurrentPlayer(scene, players[id], id);
            }
            if (id == socket.id) {
                player = scene.physics.add.sprite(players[id].x, players[id].y, 'player').setScale(0.2).setDepth(-1);
                player.playerId = id;
                player.lives = 3; 
                player.setCollideWorldBounds(true)
                scene.physics.add.collider(player, barrier);
                scene.physics.add.overlap(enemyProjectiles, player, (player, projectile) => {
                    console.log('hit');
                    projectile.destroy();
                    player.lives -= 1;
                    updateLivesBar(scene);
                    if (player.lives == 0) {
                        player.destroy();
                        drawPath = [];
                        graphics.clear();
                    }
                    socket.emit('playerHit', socket.id);
                    
                });
                updateLivesBar(scene);
            }
        });
    });

    socket.emit('getCurrentPlayers');

    // Handle new player connections
    socket.on('newPlayer', function(playerInfo) {
        addOtherPlayer(scene, playerInfo);
    });

    // Handle player disconnections
    socket.on('playerDisconnected', function(id) {
        removePlayer(id);
    });

    socket.on('playerMoved', function(movementData) {
        
        if (movementData.id == socket.id) {
            return;
        }
        let p = players.find(player => player.playerId == movementData.id);
        p.x = movementData.player.x;
        p.y = movementData.player.y;
     });

     socket.on('createProjectile', (data) => {
        createEnemyProjectileFromPath(scene, data);
    });

    socket.on('playerHit', (id) => { 
        if (id == socket.id) {
            return;
        }
        console.log('hereeee')
        p = players.find(player => player.playerId == id);
        p.lives -= 1;
        console.log(p)
        if (p.lives == 0) {
            console.log('destroyed');
            p.destroy();
        }
    });

}

function updateProjectileBar(scene) {
    projectileBar.clear();
    projectileBar.fillStyle(0x3d1d07, 0.9); 
    projectileBar.fillRect(725, scene.sys.game.config.height - 80, 450, 40);
    for (let i = 0; i < Math.floor(projectileCount); i++) {
        // Calculate the position for each circle
        let x = 750 + i * 45; 
        let y = scene.sys.game.config.height - 60;

        // Draw the circle
        projectileBar.fillStyle(0xffffff, 1); // White circles
        projectileBar.fillCircle(x, y, 10);
    }
}

function updateLivesBar(scene) {
    livesBar.clear();
    livesBar.fillStyle(0xffffff, 0.9);
    livesBar.fillRect(500, scene.sys.game.config.height - 80, 200, 40);
    if (player) {
        for (let i = 0; i < player.lives; i++) {
            // Calculate the position for each circle
            let x = 540 + i * 60; 
            let y = scene.sys.game.config.height - 60;

            // Draw the circle
            livesBar.fillStyle(0xff0000, 1); 
            livesBar.fillCircle(x, y, 10); 
        }
    }
}

function updateInkBar(scene) {
    inkBar.clear();
    var inkBarWidth = (currentInk / MAX_INK) * 450;
    inkBar.fillStyle(0x000000, 0.9);
    inkBar.fillRect(20, scene.sys.game.config.height - 80, inkBarWidth, 40);
}

function updateUsableInkBar(scene) {
    if (usableInk) {
        usableInkBar.clear();
        var inkBarWidth =  (maxUsableInk - usableInk) / MAX_INK * 450;
        var limit = (maxUsableInk / MAX_INK) * 450;
        usableInkBar.fillStyle(0xff0000, 0.9);
        usableInkBar.fillRect(20, 900 - 80, inkBarWidth, 40);
        inkLimit.clear();   
        inkLimit.fillStyle(0xffff00, 1);
        inkLimit.fillRect(limit+17, 820, 5, 40);
    }
}


function createEnemyProjectileFromPath(scene, data) {
    var enemyPath = data.path;
    var path = new Phaser.Curves.Path(enemyPath[0].x, enemyPath[0].y);
    enemyPath.forEach(point => path.lineTo(point.x, point.y));

    var enemyProjectile = scene.add.follower(path, data.start.x, data.start.y, 'projectile').setScale(0.07);
    enemyProjectile.setPosition(data.start.x, data.start.y); // Set the starting position   
    

    var durationQ;
    if (path.getLength() < 300) {
        durationQ = 0.5
    } else {
        durationQ = (300/path.getLength())
    }
    enemyProjectile.startFollow({
        duration: path.getLength() / durationQ,
        repeat: 0, // Set to 0 for no repeat
        rotateToPath: false, // If you want the projectile to rotate in the direction of the path
        yoyo: false,
        onComplete: function() {
            enemyProjectile.destroy(); // Remove the projectile at the end of the path
        }
    });


    enemyProjectiles.add(enemyProjectile);
    // Configure and start the projectile motion
}

function addCurrentPlayer(scene, player, id) {
    var otherPlayer = scene.physics.add.sprite(player.x, player.y, 'player').setScale(0.2);
    scene.physics.add.overlap(projectiles, otherPlayer, (otherPlayer, projectile) => projectile.destroy());
    otherPlayer.playerId = id;
    otherPlayer.lives = player.lives;
    players.push(otherPlayer);
}

function addOtherPlayer(scene, player) {
    var otherPlayer = scene.physics.add.sprite(player.data.x, player.data.y, 'player').setScale(0.2);
    scene.physics.add.overlap(projectiles, otherPlayer, (otherPlayer, projectile) => projectile.destroy());
    otherPlayer.playerId = player.id;
    otherPlayer.lives = player.data.lives;
    players.push(otherPlayer);
}

function removePlayer(id) {
    //find removed player, destroy sprite and remove from list
    var removedPlayer = players.find(player => player.playerId == id);
    removedPlayer.destroy();
    players = players.filter(player => player.playerId != id);
}


function handlePlayerMovement() {
    if (player.active) {
        player.setVelocity(0);
        movement = {};
        // Player movement
        if (cursors.left.isDown) {
            player.setVelocityX(-velocity);
            movement.x = -velocity;
            moved = true;
        } else if (cursors.right.isDown) {
            player.setVelocityX(velocity);
            movement.x = velocity;
            moved = true;
        }

        if (cursors.up.isDown) {
            player.setVelocityY(-velocity);
            movement.y = -velocity;
            moved = true;
        } else if (cursors.down.isDown) {
            player.setVelocityY(velocity);
            movement.y = velocity;
            moved = true;
        }
    }
}


//stick path to player
function translatePath() {
    path2 = new Phaser.Curves.Path(player.x, player.y);

    for (var i = 1; i < drawPath.length; i++) {
        
        let point = drawPath[i]
        let center = player.getCenter()
        var translatedX = point.x - drawPath[0].x  + center.x;
        var translatedY = point.y - drawPath[0].y + center.y;

        path2.lineTo(translatedX, translatedY);
    }



    // If you have a graphics object displaying the path, redraw it
    if (graphics) {
        // graphics.clear();
        graphics.lineStyle(4, 0xff0000, 1);
        path2.draw(graphics);
    }
}



function copyPath(ogPath) {
    copy = new Phaser.Curves.Path(ogPath.startPoint.x,ogPath.startPoint.y);
    pts = ogPath.getPoints()
    for (let i = 1; i < pts.length; i++) {
        path2.lineTo(pts[i].x, pts[i].y);
    }
    return copy
    
}


function createProjectile(x,y,scene) {
    var projectile = scene.add.follower(path, x, y, 'projectile');
    // projectile.setPosition(x, y); // Set the starting position
    projectile.setScale(0.07);

    var durationQ
    if (path.getLength() < 300) {
        durationQ = 0.5
    } else {
        durationQ = (300/path.getLength())
    }
    projectile.startFollow({
        duration: path.getLength() / durationQ,
        repeat: 0, // Set to 0 for no repeat
        rotateToPath: false, // If you want the projectile to rotate in the direction of the path
        yoyo: false,
        onComplete: function() {
            projectile.destroy(); // Remove the projectile at the end of the path
        }
    });

    projectiles.add(projectile)


    return projectile;
}

function shootProjectile(x, y, scene) {
    if (path.getLength() > minPathLength) {
        var projectile = createProjectile(x,y,scene);
        socket.emit('projectileShot', { path: drawPath, playerId: socket.id, start: {x: player.x, y: player.y}});
        return projectile;
    }
    return; 
}
