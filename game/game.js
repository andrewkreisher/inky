var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 900,
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
var spacebar;
var graphics;
var drawPath = [];
var isDrawing = false;

function preload() {
    this.load.image('player', 'assets/sprite.png');
    this.load.image('background', 'assets/dark_background.png');
    this.load.image('barrier', 'assets/barrier.png');
    this.load.image('projectile', 'assets/projectile.png'); // Load your projectile image
}

function create() {

    graphics = this.add.graphics();

    var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);

    player = this.physics.add.sprite(400, 300, 'player').setScale(0.2).setCollideWorldBounds(true).setDepth(-1);

    barrier = this.physics.add.sprite(600, 400, 'barrier').setScale(0.5).setImmovable(true);
    this.physics.add.collider(player, barrier);

    projectiles = this.physics.add.group({ runChildUpdate: true });
    this.physics.add.overlap(projectiles, barrier, (barrier, projectile) => projectile.destroy());


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

var velocity = 300;

function update() {
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

function handlePlayerMovement() {
    // Player movement
    if (cursors.left.isDown) {
        player.setVelocityX(-velocity);
    } else if (cursors.right.isDown) {
        player.setVelocityX(velocity);
    }

    if (cursors.up.isDown) {
        player.setVelocityY(-velocity);
    } else if (cursors.down.isDown) {
        player.setVelocityY(velocity);
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

var followSpeed = 1      ;

function createProjectile(x,y,scene) {
    var projectile = scene.add.follower(path, 0, 0, 'projectile');
    projectile.setPosition(x, y); // Set the starting position
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
    }

    return projectile;
}

