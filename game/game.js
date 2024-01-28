var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 900,
    disableVisibilityChange: true, 
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
            setBounds: true,
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);
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

function preload() {
    this.load.image('player', 'assets/sprite.png');
    this.load.image('background', 'assets/dark_background.png');
    this.load.image('barrier', 'assets/barrier.png');
    this.load.image('projectile', 'assets/projectile.png'); // Load your projectile image
}


function create() {
    connectSocket(this);
    graphics = this.add.graphics();
    var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);

    projectiles = this.physics.add.group({ runChildUpdate: true });
    enemyProjectiles = this.physics.add.group({ runChildUpdate: true });

    barrier = this.physics.add.sprite(600, 400, 'barrier').setScale(0.5).setImmovable(true);
    this.physics.add.overlap(projectiles, barrier, (barrier, projectile) => projectile.destroy());
    this.physics.add.overlap(enemyProjectiles, barrier, (barrier, projectile) => projectile.destroy());

    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });
    
    spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    var fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);


    this.input.on('pointerdown', function (pointer) {
            isDrawing = true;
            drawPath = [];
            drawPath.push({ x: pointer.x, y: pointer.y });
            path = new Phaser.Curves.Path(pointer.x, pointer.y);
    });

    fKey.on('down', function () {
        if (isDrawing) {
            isDrawing = false; 
            drawPath = [];
        }
    });


    this.input.on('pointerup', function () {
        isDrawing = false;
        if (path.getLength() < minPathLength) {
            drawPath = [];
        } 
    });

    this.input.on('pointermove', function (pointer) {
        if (isDrawing) {
            drawPath.push({ x: pointer.x, y: pointer.y });
            path.lineTo(pointer.x, pointer.y);
            if (graphics) {
                graphics.clear();
                graphics.lineStyle(4, 0xff0000, 1);
                path.draw(graphics);
            }
        }
    });
    

}

function update() {
    if (player) {

        if (moved) {
            if (movement.x || movement.y) {
                socket.emit('playerMovement', {id: socket.id, position: {x: player.x, y: player.y}});
            }
            moved = false
        }

        player.setVelocity(0);
        handlePlayerMovement();

        // Shooting
        if (Phaser.Input.Keyboard.JustDown(spacebar)) {
            if (path) {
                shootProjectile(player.x, player.y, this);
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

        // Update projectiles
        projectiles.getChildren().forEach(function(projectile) {

        });
    }
}

function connectSocket(scene) {
    socket = io('http://localhost:3000');

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
                scene.physics.add.collider(player, barrier);
                scene.physics.add.overlap(enemyProjectiles, player, (player, projectile) => projectile.destroy());
            }
        });
    });

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
        p = players.find(player => player.playerId == movementData.id);
        p.x = movementData.player.x;
        p.y = movementData.player.y;
     });

     socket.on('createProjectile', (data) => {
        createEnemyProjectileFromPath(scene, data);
    });

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
    players.push(otherPlayer);
}

function addOtherPlayer(scene, player) {
    var otherPlayer = scene.physics.add.sprite(player.data.x, player.data.y, 'player').setScale(0.2);
    scene.physics.add.overlap(projectiles, otherPlayer, (otherPlayer, projectile) => projectile.destroy());
    otherPlayer.playerId = player.id;
    players.push(otherPlayer);
}

function removePlayer(id) {
    //find removed player, destroy sprite and remove from list
    var removedPlayer = players.find(player => player.playerId == id);
    removedPlayer.destroy();
    players = players.filter(player => player.playerId != id);
}

var velocity = 300;



function handlePlayerMovement() {
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

var path2; 

//stick path to player
function translatePath() {
    path2 = new Phaser.Curves.Path(player.x, player.y);

    for (var i = 1; i < drawPath.length; i++) {
        
        point = drawPath[i]
        center = player.getCenter()
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

var followSpeed = 1;

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

var path;
var minPathLength = 200;
function shootProjectile(x, y, scene) {
    if (path.getLength() > minPathLength) {
        var projectile = createProjectile(x,y,scene);
        socket.emit('projectileShot', { path: drawPath, playerId: socket.id, start: {x: player.x, y: player.y}});
        return projectile;
    }
    return; 
}

