import { GameLogic } from "./gameLogic.js";
import { Game } from "./game.js";
import { UI } from "./ui.js";

export class Player {
  constructor(id, data) {
    this.id = id;
    this.launcher = { angle: -Math.PI / 2 };
    this.launcherBubble = null;
    this.shotBubble = null;
    this.nextBubble = null;
    this.fallingBubbles = [];
    this.incomingBubbles = [];
    this.effects = [];
    this.variationColorTimer = 0;
    this.update(data);
  }

  createOpponentUI() {
    this.container = document.createElement("div");
    this.container.id = `opponent-${this.id}`;
    this.container.className = "opponent-view game-area-bg";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "opponent-canvas";
    this.ctx = this.canvas.getContext("2d");
    this.teamIndicator = document.createElement("div");
    this.teamIndicator.className = "team-indicator";
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.teamIndicator);
    // Le lancement de sorts au clic est géré par InputHandler (délégation
    // sur #opponents-grid, LIFO) — pas de listener ici.
  }

  update(data) {
    this.name = data.name || `Joueur_${this.id.substring(0, 4)}`;
    const newGrid = data.grid ? JSON.parse(data.grid) : GameLogic.createEmptyGrid();

    // Boules reçues des adversaires : elles arrivent en volant par la gauche
    // au lieu d'apparaître de nulle part (uniquement pour le joueur local).
    // Nos propres tirs sont déjà dans la grille locale, donc pas re-détectés ici.
    if (
      this.grid &&
      Game.state === "playing" &&
      Game.localPlayer?.id === this.id &&
      this.isAlive
    ) {
      const added = [];
      for (let r = 0; r < newGrid.length; r++) {
        for (let c = 0; c < newGrid[r].length; c++) {
          if (newGrid[r][c] && !this.grid[r]?.[c]) added.push({ r, c });
        }
      }
      // Au-delà de 16 nouvelles cases (ex: rangées décalées par un sort),
      // on applique directement, sinon on anime l'arrivée en file indienne.
      if (added.length > 0 && added.length <= 16) {
        this.incomingBubbles = this.incomingBubbles || [];
        added.forEach(({ r, c }, i) => {
          const b = newGrid[r][c];
          const { y } = GameLogic.getBubbleCoords(r, c, Game.bubbleRadius);
          this.incomingBubbles.push({
            ...b,
            targetRow: r,
            targetCol: c,
            x: -Game.bubbleRadius * (2 + i * 2.5),
            y,
            vx: Game.bubbleRadius * 0.45,
            fromLeft: true,
          });
          newGrid[r][c] = null; // caché tant que la boule n'est pas arrivée
        });
      }
    }

    this.grid = newGrid;
    this.score = data.score || 0;
    this.isAlive = data.isAlive !== undefined ? data.isAlive : true;
    this.spells = data.spells || [];
    this.statusEffects = data.statusEffects || {};
    this.attackBubbleCounter = data.attackBubbleCounter || 0;
    this.team = data.team ?? 0;
    this.level = data.level || 1;
    this.isReady = data.isReady || false;
  }

  resetForNewGame(grid) {
    this.grid = grid;
    this.isAlive = true;
    this.score = 0;
    this.level = 1;
    this.spells = [];
    this.statusEffects = {};
    this.attackBubbleCounter = 0;
    this.launcherBubble = null;
    this.shotBubble = null;
    this.nextBubble = null;
    this.fallingBubbles = [];
    this.incomingBubbles = [];
    this.effects = [];
    this.isReady = false;
  }
}
