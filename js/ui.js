import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";

export const UI = {
  announcementTimeout: null,

  renderOpponents() {
    const grid = document.getElementById("opponents-grid");
    if (!grid) return;
    grid.innerHTML = "";

    // Le CSS grid est géré par la classe HTML/CSS maintenant, plus besoin de forcer ici
    // sauf pour s'assurer qu'il est propre.

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    // Ligne 1 (5 slots)
    for (let i = 0; i < 5; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    // Ligne 2 (1 Annonce + 4 slots)
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex flex-col items-center justify-center text-center p-1 overflow-hidden relative";
    announcement.style.backgroundColor = "#ea580c";
    announcement.style.border = "2px solid white";
    announcement.innerHTML = `<span class="text-white font-bold text-sm">Annonces</span>`;
    grid.appendChild(announcement);

    for (let i = 5; i < 9; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    // Appel différé pour s'assurer que le DOM est prêt
    requestAnimationFrame(() => this.resizeAllCanvases());
  },

  createEmptySlot: () => {
    const s = document.createElement("div");
    s.className =
      "opponent-view flex items-center justify-center bg-slate-900 border-2 border-dashed border-slate-700 opacity-50";
    s.innerHTML = `<span class="text-slate-500 text-[10px]">Vide</span>`;
    return s;
  },

  checkVoteStatus() {
    if (Game.state !== "waiting" || !Game.localPlayer) return;
    const ready = Array.from(Game.players.values()).filter(
      (p) => p.isReady
    ).length;
    const total = Game.players.size;
    const required = total <= 1 ? 1 : Math.ceil(total / 2) + 1;

    const slot = document.getElementById("spell-announcement");

    if (!Game.localPlayer.isReady) {
      this.renderTeamSelectionInAnnouncementBox();
    } else {
      if (slot) {
        slot.innerHTML = `
                <div class="flex flex-col justify-center items-center h-full w-full animate-pulse bg-green-800">
                    <span class="font-bold text-white text-lg leading-none mb-1">PRÊT !</span>
                    <div class="w-1/2 h-px bg-white my-1 opacity-50"></div>
                    <span class="text-[10px] text-white">Attente...</span>
                    <span class="font-black text-xl text-white leading-none">${ready}/${total}</span>
                </div>`;
      }
    }

    if (
      total > 0 &&
      ready >= required &&
      Game.localPlayer.id === Array.from(Game.players.keys())[0]
    ) {
      FirebaseController.updateSessionDoc({ gameState: "countdown" });
    }
  },

  renderTeamSelectionInAnnouncementBox() {
    const slot = document.getElementById("spell-announcement");
    if (!slot || !Game.localPlayer) return;

    slot.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full p-1 bg-orange-600">
        <p class="font-bold text-[10px] text-white uppercase mb-1">Équipe</p>
        <div class="flex flex-wrap justify-center gap-1 w-full px-1">
            ${Config.TEAM_COLORS.map((c, i) => {
              const isSelected = Game.localPlayer.team === i;
              return `<button style="background:${c}; width:14px; height:14px; border-radius:50%; border:${
                isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.3)"
              }; transform:${
                isSelected ? "scale(1.3)" : "scale(1)"
              }" onclick="window.handleTeamChange(${i})"></button>`;
            }).join("")}
        </div>
        <div class="mt-2 bg-black/30 px-3 py-1 rounded cursor-pointer hover:bg-black/50 shadow border border-white/20" onclick="document.getElementById('gameCanvas').click()">
            <span class="text-[9px] font-bold text-white leading-tight block">CLIQUER<br>LE JEU</span>
        </div>
    </div>`;

    window.handleTeamChange = (i) =>
      FirebaseController.updatePlayerDoc(
        FirebaseController.auth.currentUser.uid,
        { team: i, lastActive: Date.now() }
      );
  },

  startCountdown() {
    if (Game.countdownInterval) clearInterval(Game.countdownInterval);
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;
    let count = 3;
    const update = () => {
      slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-purple-700 text-white font-black text-6xl">${count}</div>`;
      if (count <= 0) {
        slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-green-600 text-white font-black text-4xl">GO!</div>`;
        clearInterval(Game.countdownInterval);
      }
      count--;
    };
    update();
    Game.countdownInterval = setInterval(update, 1000);
  },

  stopCountdown() {
    if (Game.countdownInterval) clearInterval(Game.countdownInterval);
    const slot = document.getElementById("spell-announcement");
    if (slot)
      slot.innerHTML = "<span class='text-white font-bold'>Annonces</span>";
  },

  updatePlayerStats() {},

  resizeAllCanvases() {
    const topArea = document.getElementById("top-area");
    const mainCanvas = document.getElementById("gameCanvas");
    const playerCol = document.getElementById("player-column");
    const opponentsCol = document.getElementById("opponents-column");

    if (topArea && mainCanvas && playerCol && opponentsCol) {
      // 1. Hauteur Maximale disponible
      const availableHeight = topArea.clientHeight;

      // 2. Définition du Ratio du Jeu (Mode Portrait type mobile/arcade)
      // Largeur = 0.58 * Hauteur (Approx Bust-a-move)
      const gameRatio = 0.58;

      // 3. Calcul de la largeur du joueur
      let playerWidth = availableHeight * gameRatio;

      // Appliquer les dimensions au conteneur du joueur
      playerCol.style.width = `${playerWidth}px`;
      playerCol.style.flex = "0 0 auto"; // Fixe

      // 4. Appliquer les dimensions au Canvas (interne)
      mainCanvas.width = playerWidth;
      mainCanvas.height = availableHeight;
      mainCanvas.style.width = "100%";
      mainCanvas.style.height = "100%";

      // 5. Calcul de la largeur de la grille adverses
      // La grille a 5 colonnes. Le joueur en a (visuellement) environ 3 équivalentes en largeur.
      // On veut que la hauteur de la grille (2 rangées) soit égale à la hauteur du jeu ?
      // NON, votre demande est : "De la même hauteur que les deux miniatures de droite"
      // -> Cela signifie que la colonne de droite doit avoir la MÊME HAUTEUR TOTALE que la colonne de gauche.
      // C'est déjà le cas grâce au Flexbox du parent #top-area.

      // Calcul du rayon des boules basé sur la nouvelle largeur
      const radW = playerWidth / 17;
      Game.bubbleRadius = radW * 0.95;
    }

    // Redimensionnement des canvas adverses
    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer?.id && p.canvas) {
        const parent = p.canvas.parentElement;
        p.canvas.width = parent.clientWidth;
        p.canvas.height = parent.clientHeight;
      }
    });
  },

  updateSpellAnnouncement(caster, spellInfo, target) {},
  preloadSpellIcons: () =>
    Object.values(Config.SPELLS).forEach((s) => {
      const i = new Image();
      i.src = s.icon;
      Game.spellIcons[s.name] = i;
    }),
  addChatMessage(name, msg) {
    const chat = document.getElementById("chat-messages");
    if (chat) {
      chat.innerHTML += `<div class="mb-1 text-xs"><span class="font-bold text-blue-300">${name}:</span> ${msg}</div>`;
      chat.scrollTop = chat.scrollHeight;
    }
  },
  triggerScreenShake(intensity) {
    Game.shakeUntil = Date.now() + 500;
    Game.shakeIntensity = 5;
  },
};
