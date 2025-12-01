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

    // Le grid layout est géré par le CSS (grid-cols-5)

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    // Ligne 1
    for (let i = 0; i < 5; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    // Ligne 2 : Annonce + 4 autres
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex flex-col items-center justify-center text-center p-1 overflow-hidden relative";
    announcement.style.backgroundColor = "#ea580c";
    announcement.style.border = "2px solid white";
    announcement.innerHTML = `<span class="text-white font-bold">Annonces</span>`;
    grid.appendChild(announcement);

    for (let i = 5; i < 9; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    requestAnimationFrame(() => this.resizeAllCanvases());
  },

  createEmptySlot: () => {
    const s = document.createElement("div");
    s.className =
      "opponent-view flex items-center justify-center bg-slate-900 border-2 border-dashed border-slate-700 opacity-40";
    s.innerHTML = `<span class="text-slate-500 text-xs">Libre</span>`;
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
                <div class="flex flex-col justify-center items-center h-full w-full bg-green-800 animate-pulse">
                    <span class="font-bold text-white text-xl mb-1">PRÊT</span>
                    <div class="w-2/3 h-0.5 bg-white/30 my-1"></div>
                    <span class="text-xs text-white/80">Joueurs: ${ready}/${total}</span>
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
    <div class="flex flex-col items-center justify-center w-full h-full bg-orange-600 p-1">
        <p class="font-bold text-xs text-white mb-1 uppercase tracking-wide">Équipe</p>
        <div class="flex flex-wrap justify-center gap-1.5 mb-2">
            ${Config.TEAM_COLORS.map((c, i) => {
              const isSelected = Game.localPlayer.team === i;
              return `<button style="background:${c}; width:18px; height:18px; border-radius:50%; border:${
                isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.2)"
              }; transform:${
                isSelected ? "scale(1.2)" : "scale(1)"
              }; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" onclick="window.handleTeamChange(${i})"></button>`;
            }).join("")}
        </div>
        <div class="bg-black/40 hover:bg-black/60 transition px-3 py-1.5 rounded cursor-pointer border border-white/20" onclick="document.getElementById('gameCanvas').click()">
            <span class="text-[10px] font-bold text-white block leading-tight">CLIQUER<br>LE JEU</span>
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
      // Utilisation de flex et taille responsive pour que ça rentre
      slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-purple-700 text-white font-black text-7xl shadow-inner">${count}</div>`;
      if (count <= 0) {
        slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-green-500 text-white font-black text-5xl animate-bounce">GO!</div>`;
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
    const canvasContainer = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");
    const playerCol = document.getElementById("player-column");

    if (canvasContainer && mainCanvas) {
      // 1. On récupère la hauteur disponible dans le conteneur parent (#top-area)
      const availableHeight = canvasContainer.clientHeight;

      // 2. On calcule la largeur idéale pour le joueur (Ratio 0.6)
      let width = availableHeight * 0.6;

      // 3. On applique cette largeur à la colonne du joueur
      // Cela va pousser la colonne des adversaires qui prendra le reste
      playerCol.style.flex = `0 0 ${width}px`;

      // 4. On dimensionne le canvas interne
      mainCanvas.width = width;
      mainCanvas.height = availableHeight;
      mainCanvas.style.width = "100%";
      mainCanvas.style.height = "100%";

      // 5. Calcul du rayon des boules (Crucial pour le dessin)
      // 17 unités de large (8 boules * 2 + 1 décalage)
      const radW = width / 17;
      Game.bubbleRadius = radW * 0.95;
    }

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
