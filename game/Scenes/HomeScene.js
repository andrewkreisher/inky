export class HomeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomeScene' });
  }

  preload() {  
    this.load.image('background', './assets/background.png');
  }

  create() {
    this.add.text(this.cameras.main.centerX/2 +125, 50, 'Inky', { fill: '#000' }).setFont('200px Arial');
    var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);

    let startGameText = this.add.text(150, 450, 'Start Game', { font: '50px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .setInteractive();

    startGameText.on('pointerdown', () => {
            this.scene.start('MainScene'); // This will switch to your main game scene
        });
    startGameText.on('pointerover', () => {
        startGameText.setColor('#ff00ff');
    });
    startGameText.on('pointerout', () => {
        startGameText.setColor('#ff0000');
    });



    let joinGameText = this.add.text(150, 550, 'Join Game', { font: '50px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .setInteractive();

    joinGameText.on('pointerdown', () => {
            this.scene.start('LobbyScene'); // This will switch to your main game scene
        });
    joinGameText.on('pointerover', () => {
        joinGameText.setColor('#ff00ff');
    });
    joinGameText.on('pointerout', () => {
        joinGameText.setColor('#ff0000');
    });
    
  }
}