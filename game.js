var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 900,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
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
var projectiles;
var spacebar;
var graphics;
var drawPath = [];
var isDrawing = false;

function preload() {
    this.load.image('player', 'assets/sprite.png');
    this.load.image('link', 'assets/link.png');
    this.load.image('background', 'assets/background.png');
    this.load.image('projectile', 'assets/square.png'); // Load your projectile image
}

function create() {
    graphics = this.add.graphics(); // Initialize graphics here
    link = this.physics.add.sprite(400, 50, 'link');
    link.setScale(0.2);

    player = this.physics.add.sprite(400, 300, 'player');
    player.setScale(0.2);
    cursors = this.input.keyboard.createCursorKeys();
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });
    
    spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointerdown', function (pointer) {
        isDrawing = true;
        drawPath = [];
        drawPath.push({ x: pointer.x, y: pointer.y });
        path = new Phaser.Curves.Path(pointer.x, pointer.y);
    });

    this.input.on('pointerup', function () {
        isDrawing = false;
        // createProjectilePath(drawPath); // Once drawing is done, create the path
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
    

    projectiles = this.physics.add.group();

    // Optional: Add collision between projectiles and world bounds
    projectiles.runChildUpdate = true; // Allows update method of children (projectiles) to be called

    this.physics.add.overlap(projectiles, link, function(projectile, target) {
        target.destroy(); // Remove the target sprite
        projectile.destroy(); // Optionally, remove the projectile as well
    }, null, this);

    //background
    var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background');

    // Set the scale to cover the entire canvas
    background.setScale(1.2); // Adjust the scale as needed

    // Make the background the lowest layer
    player.setDepth(-1);
    background.setDepth(-2);
}

function update() {
    player.setVelocity(0);

    // Player movement
    if (cursors.left.isDown) {
        player.setVelocityX(-160);
    } else if (cursors.right.isDown) {
        player.setVelocityX(160);
    }

    if (cursors.up.isDown) {
        player.setVelocityY(-160);
    } else if (cursors.down.isDown) {
        player.setVelocityY(160);
    }

    // Shooting
    if (Phaser.Input.Keyboard.JustDown(spacebar)) {
        if (path) {
            shootProjectile(player.x, player.y, this);
        }
        
    }
    

    
    // Calculate the angle between the sprite and the mouse pointer
    var angle = Phaser.Math.Angle.Between(player.x, player.y, this.input.mousePointer.x, this.input.mousePointer.y);

    // Rotate the path around the sprite
    if (path && !isDrawing) {
        if (path2) {
            graphics.clear()
            path2.destroy()
        }
        if (drawPath) {
            rotatePath(path, Phaser.Math.RadToDeg(angle), player.x, player.y);
        }
        
    }

    
    

    // Update projectiles
    projectiles.getChildren().forEach(function(projectile) {

    });
}

var path2; 

function rotatePath(path, angle, pivotX, pivotY) {
    var radians = Phaser.Math.DegToRad(angle);
    path2 = new Phaser.Curves.Path(player.x, player.y);

    

    for (var i = 1; i < drawPath.length; i++) {
        
        point = drawPath[i]
        center = player.getCenter()
        var translatedX = point.x - drawPath[0].x  + center.x;
        var translatedY = point.y - drawPath[0].y + center.y;

        // var rotatedX = translatedX * Math.cos(radians) - translatedY * Math.sin(radians);
        // var rotatedY = translatedX * Math.sin(radians) + translatedY * Math.cos(radians);

        // point.x = rotatedX + pivotX;
        // point.y = rotatedY + pivotY;
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
    // for (var i = 1; i < drawPath.length; i++) {
    //     path2.lineTo(drawPath[i].x, drawPath[i].y);
    // }
    pts = ogPath.getPoints()
    for (let i = 1; i < pts.length; i++) {
        path2.lineTo(pts[i].x, pts[i].y);
    }
    return copy
    
}

var followSpeed = 0.3       ;

function createProjectile(x,y,scene) {
    var projectile = scene.add.follower(path, 0, 0, 'projectile');
    projectile.setPosition(x, y); // Set the starting position
    projectile.setScale(0.1);
   
    projectile.startFollow({
        duration: path.getLength() / followSpeed,
        repeat: 0, // Set to 0 for no repeat
        rotateToPath: true, // If you want the projectile to rotate in the direction of the path
        yoyo: false,
        onComplete: function() {
            projectile.destroy(); // Remove the projectile at the end of the path
        }
    });

    projectiles.add(projectile)


    return projectile;
}
var path;

function createProjectilePath(drawPath) {
    path = new Phaser.Curves.Path(drawPath[0].x, drawPath[0].y);

    for (var i = 1; i < drawPath.length; i++) {
        path.lineTo(drawPath[i].x, drawPath[i].y);
    }

    graphics.clear();
    graphics.lineStyle(4, 0xff0000, 1);
    path.draw(graphics);
}




function shootProjectile(x, y, scene) {
    var projectile = createProjectile(x,y,scene);
    return projectile;
}
