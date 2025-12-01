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

    // IMPORTANT: On enlève les contraintes de hauteur CSS pour laisser JS gérer
    grid.className = "grid grid-cols-5 grid-rows-2 gap-2";

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

    // Ligne 2 : Annonces + 4 adversaires
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex items-center justify-center p-1 bg-orange-600 border-2 border-white";
    announcement.innerHTML =
      "<span class='text-white font-bold'>Annonces</span>";
    grid.appendChild(announcement);

    for (let i = 5; i < 9; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    this.resizeAllCanvases();
  },

  createEmptySlot: () => {
    const s = document.createElement("div");
    s.className =
      "opponent-view empty-slot flex items-center justify-center bg-slate-800 border-2 border-dashed border-slate-600";
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

    if (!Game.localPlayer.isReady) {
      this.renderTeamSelectionInAnnouncementBox();
    } else {
      const slot = document.getElementById("spell-announcement");
      if (slot)
        slot.innerHTML = `<div class="text-center text-white"><div class="font-bold text-xl">${ready}/${total}</div><div class="text-[10px]">Prêts</div></div>`;
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
    <div class="flex flex-col items-center justify-center w-full h-full">
        <div class="flex flex-wrap justify-center gap-1 mb-1 px-2">
            ${Config.TEAM_COLORS.map(
              (c, i) =>
                `<button style="background:${c}; width:16px; height:16px; border-radius:50%; border:${
                  Game.localPlayer.team === i ? "2px solid white" : "none"
                }" onclick="window.handleTeamChange(${i})"></button>`
            ).join("")}
        </div>
        <div class="bg-black/40 px-2 py-1 rounded cursor-pointer hover:bg-black/60" onclick="document.getElementById('gameCanvas').click()">
            <span class="text-[10px] text-white font-bold block leading-tight">CLIQUER<br>LE JEU</span>
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
      slot.innerHTML = `<span class="text-5xl font-black text-white drop-shadow">${count}</span>`;
      if (count <= 0) {
        slot.innerHTML = `<span class="text-4xl font-bold text-green-300">GO!</span>`;
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
    const mainCanvas = document.getElementById("gameCanvas");
    const playerCol = document.getElementById("player-column");
    const grid = document.getElementById("opponents-grid");

    if (mainCanvas && playerCol) {
      // 1. On dimensionne le canvas à la taille réelle de sa colonne
      const w = playerCol.clientWidth;
      const h = playerCol.clientHeight;

      mainCanvas.width = w;
      mainCanvas.height = h;
      mainCanvas.style.width = w + "px";
      mainCanvas.style.height = h + "px";

      // 2. Calcul du rayon basé sur la largeur (17 unités)
      const radW = w / 17;
      Game.bubbleRadius = radW * 0.95;

      // 3. On synchronise la hauteur de la grille adverses avec le joueur
      // La grille a 2 rangées. La colonne joueur a 1 rangée (le jeu).
      // On veut que la grille ne dépasse pas la hauteur du joueur.
      if (grid) {
        // On force la grille à ne pas dépasser la hauteur du joueur
        grid.style.height = h + "px";
      }
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
