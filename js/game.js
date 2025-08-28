import { Config } from './config.js';
import { FirebaseController } from './firebaseController.js';
import { GameLogic } from './gameLogic.js';
import { Drawing } from './drawing.js';
import { UI } from './ui.js';
import { InputHandler } from './inputHandler.js';

export const Game = {
    state: 'waiting', players: new Map(), localPlayer: null,
    bubbleRadius: 0, keys: { left: false, right: false }, spellIcons: {}, gameIntervals: [],
    shakeUntil: 0, shakeIntensity: 0, countdownInterval: null,
    lobbyMarbles: [],
    currentRotationSpeed: Config.LAUNCHER_ROTATION_SPEED,
    
    init() {
        this.initLobbyAnimation();
        UI.preloadSpellIcons(); 
        FirebaseController.init(); 
        InputHandler.init();
    },

    initLobbyAnimation() {
        const mainCanvas = document.getElementById('gameCanvas');
        if (!mainCanvas) return;
        setTimeout(() => {
            for (let i = 0; i < 30; i++) {
                const radius = Math.random() * 20 + 10;
                this.lobbyMarbles.push({
                    x: Math.random() * (mainCanvas.width || 400),
                    y: Math.random() * -800,
                    r: radius,
                    vy: Math.random() * 2 + 1,
                    color: Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)]
                });
            }
        }, 100);
    },
    
    start() {
        this.state = 'playing';
        this.gameIntervals.forEach(clearInterval); 
        this.gameIntervals = [];
        this.localPlayer = this.players.get(FirebaseController.auth.currentUser.uid); 
        if (!this.localPlayer) return;
        
        GameLogic.loadBubbles(this.localPlayer);
        FirebaseController.updatePlayerDoc(this.localPlayer.id, { isReady: false });
        this.gameIntervals.push(setInterval(GameLogic.levelUp, 30000));
        this.gameIntervals.push(setInterval(GameLogic.triggerGlobalAttack, 10000));
        
        UI.resizeAllCanvases();
    },

    resetForNewRound() {
        this.state = 'waiting';
        this.gameIntervals.forEach(clearInterval);
        this.gameIntervals = [];

        const newGrid = GameLogic.createInitialGrid();
        this.players.forEach(p => {
            p.resetForNewGame(newGrid);
        });

        this.localPlayer = this.players.get(FirebaseController.auth.currentUser.uid);
        
        UI.renderOpponents();
        UI.updatePlayerStats();
    },

    gameLoop() {
        if (this.state === 'waiting') {
            GameLogic.updateLobbyAnimation();
        } else if (this.state === 'playing') {
            GameLogic.updateLocalAnimations();
        }
        
        Drawing.drawAll();
        requestAnimationFrame(() => this.gameLoop());
    },
};