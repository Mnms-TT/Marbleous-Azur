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

    // PENDANT QU'ON JOUE, notre état de jeu est géré LOCALEMENT (on en est
    // propriétaire) : grille, sorts, score, effets... ne doivent JAMAIS être
    // écrasés par l'écho serveur, souvent en retard d'une écriture. Sinon :
    // plateau qui saute, sorts ramassés qui disparaissent de l'inventaire,
    // clics de sort qui ne partent pas (inventaire transitoirement vide).
    // Les snapshots arrivent en continu (bots, adversaires) → l'écho est permanent.
    // data.grid arrive déjà décodée en tableau (RTDB → decodeGridTree).
    const isLocalPlaying =
      Game.state === "playing" && Game.localPlayer?.id === this.id;

    if (!isLocalPlaying) {
      this.grid = Array.isArray(data.grid) ? data.grid : GameLogic.createEmptyGrid();
      this.score = data.score || 0;
      this.isAlive = data.isAlive !== undefined ? data.isAlive : true;
      this.spells = data.spells || [];
      this.statusEffects = data.statusEffects || {};
      this.attackBubbleCounter = data.attackBubbleCounter || 0;
      this.level = data.level || 1;
    }

    // Champs sans enjeu de course (pas mutés localement en cours de partie)
    this.team = data.team ?? 0;
    this.isReady = data.isReady || false;
    this.isSpectator = data.isSpectator || false;
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
