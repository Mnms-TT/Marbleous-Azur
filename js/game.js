import { Config } from "./config.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";
import { Drawing } from "./drawing.js";
import { UI } from "./ui.js";
import { InputHandler } from "./inputHandler.js";

export const Game = {
  state: "waiting",
  players: new Map(),
  localPlayer: null,
  bubbleRadius: 0,
  keys: { left: false, right: false },
  spellIcons: {},
  gameIntervals: [],
  shakeUntil: 0,
  shakeIntensity: 0,
  countdownInterval: null,
  lobbyMarbles: [],
  currentRotationSpeed: Config.LAUNCHER_ROTATION_SPEED,
  targetFPS: Config.DEFAULT_GAME_FPS,
  lastFrameTime: 0,
  gameEndAnnounced: false,

  init() {
    this.initLobbyAnimation();
    UI.preloadSpellIcons();
    FirebaseController.init();
    InputHandler.init();
  },

  initLobbyAnimation() {
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;
    setTimeout(() => {
      for (let i = 0; i < 20; i++) {
        const radius = (this.bubbleRadius || 14) * 1.8;
        this.lobbyMarbles.push({
          x: Math.random() * (mainCanvas.width || 400),
          y: Math.random() * -800,
          r: radius,
          vy: Math.random() * 1 + 0.5,
          color:
            Config.BUBBLE_COLORS[
            Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
            ],
        });
      }
    }, 100);
  },

  start() {
    this.state = "playing";
    this.gameEndAnnounced = false;
    this.gameIntervals.forEach(clearInterval);
    this.gameIntervals = [];
    this.localPlayer = this.players.get(
      FirebaseController.auth.currentUser.uid
    );
    if (!this.localPlayer) return;

    GameLogic.loadBubbles(this.localPlayer);
    FirebaseController.updatePlayerDoc(this.localPlayer.id, { isReady: false });
    this.gameIntervals.push(setInterval(() => GameLogic.levelUp(), 30000)); // Niveau monte toutes les 30s
    this.gameIntervals.push(setInterval(() => GameLogic.triggerGlobalAttack(), 5000)); // Attaque toutes les 5s

    UI.resizeAllCanvases();
  },

  resetForNewRound() {
    this.state = "waiting";
    this.gameEndAnnounced = false;
    this.gameIntervals.forEach(clearInterval);
    this.gameIntervals = [];

    const newGrid = GameLogic.createInitialGrid();
    this.players.forEach((p) => {
      p.resetForNewGame(newGrid);
    });

    this.localPlayer = this.players.get(
      FirebaseController.auth.currentUser.uid
    );

    // Sync to Firebase so everyone can ready up again
    if (this.localPlayer) {
      FirebaseController.updatePlayerDoc(this.localPlayer.id, {
        isAlive: true,
        isReady: false,
        grid: JSON.stringify(newGrid),
        score: 0,
        level: 1,
        spells: [],
        statusEffects: {}
      });
    }

    UI.renderOpponents();
    UI.updatePlayerStats();
    UI.checkVoteStatus();
  },

  gameLoop(timestamp = 0) {
    // Pas de simulation fixe : la vitesse du jeu = targetFPS (réglable via /fps 30-300).
    // Comme dans le jeu original, tout est calé sur les frames : plus de fps = jeu plus rapide.
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    let elapsed = timestamp - this.lastFrameTime;
    if (elapsed > 250) elapsed = 250; // onglet inactif : pas de rattrapage massif
    this.lastFrameTime = timestamp;

    this.accumulator = (this.accumulator || 0) + elapsed;
    const stepMs = 1000 / this.targetFPS;
    let steps = 0;
    while (this.accumulator >= stepMs && steps < 30) {
      if (this.state === "waiting" || this.state === "spectating") {
        GameLogic.updateLobbyAnimation();
      } else if (this.state === "playing") {
        GameLogic.updateLocalAnimations();
      }
      this.accumulator -= stepMs;
      steps++;
    }
    if (steps >= 30) this.accumulator = 0;

    Drawing.drawAll();
    requestAnimationFrame((t) => this.gameLoop(t));
  },
};
