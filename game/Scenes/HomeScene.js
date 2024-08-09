export class HomeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomeScene' });
    this.GAME_WIDTH = 1280;
    this.GAME_HEIGHT = 720;
  }

  preload() {  
    this.load.image('background', './assets/dark_background.png');
  }

  create() {

    this.add.image(this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2, 'background').setDisplaySize(this.GAME_WIDTH, this.GAME_HEIGHT);
    this.add.text(this.cameras.main.centerX/2 +125, 50, 'Inky', { fill: '#000' }).setFont('200px Arial');
    let joinGameText = this.add.text(150, 550, 'Join Game', { font: '50px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .setInteractive();

    joinGameText.on('pointerdown', () => {
            this.scene.start('LobbyScene'); 
        });
    joinGameText.on('pointerover', () => {
        joinGameText.setColor('#ff00ff');
    });
    joinGameText.on('pointerout', () => {
        joinGameText.setColor('#ff0000');
    });
    
  }
}