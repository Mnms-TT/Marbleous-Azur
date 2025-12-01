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

    // Grid layout géré par CSS maintenant

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

    // Ligne 2 (Annonces au début)
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex flex-col items-center justify-center text-center p-1 overflow-hidden relative";
    announcement.style.backgroundColor = "#ea580c";
    announcement.style.border = "2px solid white";
    announcement.innerHTML = `<span class="text-white font-bold" style="font-size:1.5vh">Annonces</span>`;
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
    s.innerHTML = `<span class="text-slate-500" style="font-size:1.2vh">Vide</span>`;
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
                    <span class="font-bold text-white mb-1" style="font-size:2vh">PRÊT</span>
                    <div class="w-2/3 h-px bg-white/30 my-1"></div>
                    <span class="text-white/80" style="font-size:1.2vh">Joueurs: ${ready}/${total}</span>
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

    // Style adaptatif en vh pour que ça rentre toujours
    slot.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full bg-orange-600 p-1">
        <p class="font-bold text-white mb-1 uppercase tracking-wide" style="font-size:1.2vh">Équipe</p>
        <div class="flex flex-wrap justify-center gap-1 mb-2">
            ${Config.TEAM_COLORS.map((c, i) => {
              const isSelected = Game.localPlayer.team === i;
              return `<button style="background:${c}; width:2vh; height:2vh; border-radius:50%; border:${
                isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.2)"
              }; transform:${
                isSelected ? "scale(1.2)" : "scale(1)"
              }; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" onclick="window.handleTeamChange(${i})"></button>`;
            }).join("")}
        </div>
        <div class="bg-black/40 hover:bg-black/60 transition px-2 py-1 rounded cursor-pointer border border-white/20" onclick="document.getElementById('gameCanvas').click()">
            <span class="font-bold text-white block leading-tight text-center" style="font-size:1.1vh">CLIQUER<br>LE JEU</span>
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
      slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-purple-700 text-white font-black shadow-inner" style="font-size:6vh">${count}</div>`;
      if (count <= 0) {
        slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-green-500 text-white font-black animate-bounce" style="font-size:4vh">GO!</div>`;
        clearInterval(Game.countdownInterval);

        // >>> CORRECTION MAJEURE : On lance le jeu ici ! <<<
        // Seul le joueur "hôte" (le premier) envoie le signal pour éviter les doublons
        const hostId = Array.from(Game.players.keys()).sort()[0];
        if (Game.localPlayer.id === hostId) {
          FirebaseController.updateSessionDoc({ gameState: "playing" });
        }
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
      slot.innerHTML =
        "<span class='text-white font-bold' style='font-size:1.5vh'>Annonces</span>";
  },

  updatePlayerStats() {},

  resizeAllCanvases() {
    const canvasContainer = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");

    if (canvasContainer && mainCanvas) {
      // Le HTML gère le layout rigide maintenant (Game Scaler).
      // Le JS n'a plus qu'à dire au canvas : "Prends toute la place qu'on te donne".
      const w = canvasContainer.clientWidth;
      const h = canvasContainer.clientHeight;

      mainCanvas.width = w;
      mainCanvas.height = h;
      // Important : ne pas forcer de style.width/height en px, laisser le CSS faire 100%

      // Calcul du rayon (8 colonnes -> 17 unités)
      const radW = w / 17;
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
      const color =
        Game.localPlayer?.team !== undefined
          ? Config.TEAM_COLORS[Game.localPlayer.team]
          : "#93c5fd";
      chat.innerHTML += `<div class="mb-1"><span class="font-bold" style="color:${color}">${name}:</span> ${msg}</div>`;
      chat.scrollTop = chat.scrollHeight;
    }
  },
  triggerScreenShake(intensity) {
    Game.shakeUntil = Date.now() + 500;
    Game.shakeIntensity = 5;
  },
};
