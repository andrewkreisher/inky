export class HomeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomeScene' });
  }

  preload() {  
    this.load.image('background', './assets/dark_background.png');
  }

  create() {
    this.add.text(this.cameras.main.centerX/2 +125, 50, 'Inky', { fill: '#000' }).setFont('200px Arial');
    var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);

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