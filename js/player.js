import { GameLogic } from './gameLogic.js';
import { Game } from './game.js';
import { UI } from './ui.js'; // LA CORRECTION EST ICI

export class Player {
    constructor(id, data) {
       this.id = id; this.launcher = { angle: -Math.PI / 2 }; this.launcherBubble = null;
       this.shotBubble = null; this.nextBubble = null; this.fallingBubbles = []; this.effects = [];
       this.variationColorTimer = 0;
       this.update(data);
   }

   createOpponentUI() {
       this.container = document.createElement('div'); this.container.id = `opponent-${this.id}`;
       this.container.className = 'opponent-view game-area-bg';
       this.canvas = document.createElement('canvas'); this.canvas.className = 'opponent-canvas';
       this.ctx = this.canvas.getContext('2d');
       this.teamIndicator = document.createElement('div'); this.teamIndicator.className = 'team-indicator';
       this.container.appendChild(this.canvas); this.container.appendChild(this.teamIndicator);

       this.container.addEventListener('click', () => {
           if (Game.localPlayer?.isAlive && UI.selectedSpellIndex !== null) {
               GameLogic.castSpecificSpell(this, UI.selectedSpellIndex);
               UI.selectedSpellIndex = null;
               UI.updatePlayerStats();
           }
       });
   }

   update(data) {
       this.name = data.name || `Joueur_${this.id.substring(0, 4)}`;
       this.grid = data.grid ? JSON.parse(data.grid) : GameLogic.createEmptyGrid();
       this.score = data.score || 0; this.isAlive = data.isAlive !== undefined ? data.isAlive : true;
       this.spells = data.spells || []; this.statusEffects = data.statusEffects || {};
       this.attackBubbleCounter = data.attackBubbleCounter || 0; this.team = data.team ?? 0;
       this.level = data.level || 1;
       this.isReady = data.isReady || false;
   }

   resetForNewGame(grid) {
       this.grid = grid; this.isAlive = true; this.score = 0; this.level = 1; this.spells = []; this.statusEffects = {};
       this.attackBubbleCounter = 0; this.launcherBubble = null; this.shotBubble = null; this.nextBubble = null;
       this.fallingBubbles = []; this.effects = []; this.isReady = false;
   }
}