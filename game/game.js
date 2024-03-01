import {HomeScene} from './Scenes/HomeScene.js';
import {MainScene} from './Scenes/MainScene.js';
import {LobbyScene} from './Scenes/LobbyScene.js';


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
    scene: [HomeScene, LobbyScene, MainScene],
};

var game = new Phaser.Game(config);

game.socket = io('http://localhost:3000');
