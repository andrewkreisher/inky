var socket;
var graphics;
var games = [];
var gamesChanged = false;
var joinedNow = true;

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
  }

  preload() {
    this.load.image('background', './assets/background.png');
  }

  create() {
    this.add.text(this.cameras.main.centerX/2 + 200, 50, 'Inky', { fill: '#000' }).setFont('100px Arial');
    var background = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);
    socket = this.game.socket;
    graphics = this.add.graphics();
    //button to create game
    let createGameText = this.add.text(this.cameras.main.centerX/2 + 250, 300, 'Create Game', { font: '50px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .setInteractive();
  
            createGameText.on('pointerdown', () => {
                //send socket event to create game
                socket.emit('createGame', socket.id);
              });
            
            createGameText.on('pointerover', () => {
                createGameText.setColor('#ff00ff');
            });
            
            createGameText.on('pointerout', () => {
                createGameText.setColor('#ff0000');
            });

    socket.emit('currentGames');

    socket.on('currentGames', (gamesData) => {
        if (joinedNow) {
            games = Object.values(gamesData);
            gamesChanged = true;
            joinedNow = false;
        }
    });
    
    socket.on('gameCreated', (game) => {
        console.log('added game')
        console.log(game);
        games.push(game);
        gamesChanged = true;
        console.log(games);
    });

    socket.on('gameRemoved', (gameId) => {
        games = games.filter(game => game.id !== gameId);
        console.log('removed game');
        gamesChanged = true;
    });
  }

  update() {
    if (gamesChanged) {
        console.log('games:', games);
        graphics.clear(); // Clear previous game list   
        games.forEach((game, index) => {
            let gameText = 'Game: ' + game.id + ' Players: (' + game.players.length + '/2)';
            let yPosition = 400 + (index * 50);
            let gameEntryText = this.add.text(50, yPosition, gameText, { font: '20px Arial', fill: '#000' }).setInteractive();

            if (game.id !== socket.id) {
                // Join game button
                gameEntryText.setText(gameText + ' (Join)').setFill('#000000');
                gameEntryText.on('pointerdown', () => {
                    socket.emit('joinGame', game.id);
                });
            } else {
                // Remove game button
                gameEntryText.setText(gameText + ' (Remove)').setFill('#000000');
                gameEntryText.on('pointerdown', () => {
                    socket.emit('removeGame', game.id);
                    games = games.filter(g => g.id !== game.id); // Remove game from local list
                });
            }
            
            gameEntryText.on('pointerover', () => gameEntryText.setFill('#ff00ff'));
            gameEntryText.on('pointerout', () => gameEntryText.setFill('#000'));
        });
        gamesChanged = false;
    }
}
}


function getGameText(gameData) {
    return 'Game: ' + gameData.id + ' Players: (' + gameData.players.length + '/2)';
}
