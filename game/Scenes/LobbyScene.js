var socket;
var games = [];
var gameTextObjects = [];

export class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
    }

    preload() {
        this.load.image('background', './assets/dark_background.png');
    }

    create() {
        this.add.text(this.cameras.main.centerX / 2 + 200, 50, 'Inky', { fill: '#000' }).setFont('100px Arial');
        this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'background').setScale(1.2).setDepth(-2);
        
        socket = this.game.socket;

        this.createGameButton();
        this.setupSocketListeners();
    }

    createGameButton() {
        let createGameText = this.add.text(this.cameras.main.centerX / 2 + 250, 300, 'Create Game', {
            font: '50px Arial',
            fill: '#ff0000'
        }).setOrigin(0.5).setInteractive();
    
        createGameText.on('pointerdown', () => {
            socket.emit('createGame', socket.id);
        }).on('pointerover', () => {
            createGameText.setColor('#ff00ff');
        }).on('pointerout', () => {
            createGameText.setColor('#ff0000');
        });
    }

    setupSocketListeners() {
        socket.emit('currentGames')
        socket.on('currentGames', (gamesData) => {
            games = Object.values(gamesData);
            this.updateGameDisplay();
        });

        socket.on('gameCreated', (game) => {
            games.push(game);
            this.updateGameDisplay();
        });

        socket.on('gameRemoved', (gameId) => {
            let index = games.findIndex(game => game.id === gameId);
            if (index === -1) {
                console.log("game does not exist: " + gameId)
                return;
            }
            console.log('game removed: ' + games[gameId])
            games = games.filter(game => game.id !== gameId);
            this.updateGameDisplay();
        });

        socket.on('gameJoined', (game) => {
            let index = games.findIndex(g => g.id === game.id);
            console.log('emitted')
            if (index !== -1) {
                games[index] = game;
                console.log('game joined: ' + game.id)
            }
            this.updateGameDisplay();
        });

        socket.on('startGame', (game) => {
            console.log('Received startGame event:', game);
            if (game.players.includes(socket.id)) {
                console.log('Starting MainScene for player', socket.id);
                this.scene.start('MainScene', { game: game });
            } else {
                console.log('This player is not in the game players list');
            }
        });
    }

    updateGameDisplay() {
        this.clearGameTextObjects();

        games.forEach((game, index) => {
            this.displayGame(game, 400 + (index * 50));
        });
    }

    clearGameTextObjects() {
        gameTextObjects.forEach(text => text.destroy());
        gameTextObjects = [];
    }

    displayGame(game, yPosition) {
        let gameText = getGameText(game);
        let gameEntryText = this.add.text(50, yPosition, gameText, {
            font: '20px Arial',
            fill: '#000'
        }).setInteractive();

        this.setGameEntryInteractions(gameEntryText, game);

        gameTextObjects.push(gameEntryText);
    }

    setGameEntryInteractions(gameEntryText, game) {
        gameEntryText.on('pointerover', () => gameEntryText.setFill('#ff00ff'))
                     .on('pointerout', () => gameEntryText.setFill('#000'));
    
        if (!game.players.includes(socket.id)) {
            gameEntryText.setText(gameEntryText.text + ' (Join)');
            gameEntryText.on('pointerdown', () => {
                socket.emit('joinGame', { gameId: game.id, playerId: socket.id });
            });
        } else {
            gameEntryText.setText(gameEntryText.text + ' (Remove)');
            gameEntryText.on('pointerdown', () => {
                games = games.filter(g => g.id !== game.id);
                this.updateGameDisplay();
                socket.emit('removeGame', game.id);
            });
        }
    }
}

function getGameText(game) {
    return `Game: ${game.id} Players: (${game.players.length}/2)`;
}
