import {HomeScene} from './Scenes/HomeScene.js';
import {MainScene} from './scenes/MainScene.js';
import {LobbyScene} from './Scenes/LobbyScene.js';

// Apply styles to prevent scrolling
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';

var config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
        min: {
            width: 800,
            height: 450
        },
        max: {
            width: 1600,
            height: 900
        }
    },
    backgroundColor: '#333333',
    disableVisibilityChange: true, 
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [HomeScene, LobbyScene, MainScene]
};

var game = new Phaser.Game(config);

game.socket = io('http://localhost:3000');
game.socket.on('connect', () => {
    game.socket.emit('setPlayerId', game.socket.id);
});

// Prevent spacebar from scrolling the page
window.addEventListener('keydown', function(e) {
    if(e.key === ' ' && e.target === document.body) {
        e.preventDefault();
    }
});