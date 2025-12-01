import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";

export const UI = {
  announcementTimeout: null,
  spellSlotSize: 0,

  renderOpponents() {
    const grid = document.getElementById("opponents-grid");
    if (!grid) return;
    grid.innerHTML = "";

    // On force le style CSS Grid ici pour être sûr
    grid.className = "grid grid-cols-5 grid-rows-2 gap-1";
    // IMPORTANT : On retire 'h-full' qui causait l'étirement, on gérera la hauteur en JS

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    // --- Ligne 1 : 5 Adversaires ---
    for (let i = 0; i < 5; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    // --- Ligne 2 : Case Annonce + 4 Adversaires ---

    // 1. Case Annonce (Slot 6, premier de la ligne 2)
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex flex-col items-center justify-center text-center p-1 overflow-hidden relative";
    announcement.style.backgroundColor = "#ea580c"; // Orange
    announcement.style.border = "2px solid white";
    // Contenu par défaut
    announcement.innerHTML = `<span class="text-white font-bold text-sm">Annonces</span>`;
    grid.appendChild(announcement);

    // 2. Les 4 autres adversaires
    for (let i = 5; i < 9; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    // On force le redimensionnement pour tout aligner
    setTimeout(() => this.resizeAllCanvases(), 0);
  },

  createEmptySlot: () => {
    const s = document.createElement("div");
    // Style unifié pour que les cases vides aient la même structure que l'annonce
    s.className =
      "opponent-view empty-slot flex items-center justify-center bg-gray-900 border-2 border-dashed border-gray-600 opacity-50";
    s.innerHTML = `<span class="text-gray-500 text-[10px]">En attente...</span>`;
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
      if (slot) {
        slot.innerHTML = `
                <div class="flex flex-col justify-center items-center h-full w-full">
                    <span class="font-bold text-white text-lg leading-none mb-1">Prêts</span>
                    <span class="font-black text-3xl text-white leading-none">${ready}/${total}</span>
                    <span class="text-[10px] text-gray-200 mt-1">En attente...</span>
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

    // On utilise flex-wrap et gap-1 pour que ça rentre dans la petite case
    slot.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full p-1">
        <p class="font-bold text-[10px] text-white uppercase mb-1">Équipe</p>
        <div class="flex flex-wrap justify-center gap-1 w-full max-w-[80px]">
            ${Config.TEAM_COLORS.map((color, index) => {
              const isSelected = Game.localPlayer.team === index;
              // Boutons plus petits pour être sûr qu'ils rentrent
              return `<button style="background-color:${color}; width: 16px; height: 16px; border-radius: 50%; border: ${
                isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.2)"
              }; transform: ${
                isSelected ? "scale(1.2)" : "scale(1)"
              }" onclick="window.handleTeamChange(${index})"></button>`;
            }).join("")}
        </div>
        <div class="mt-2 bg-black bg-opacity-40 rounded px-2 py-1 cursor-pointer hover:bg-opacity-60 transition" onclick="document.getElementById('gameCanvas').click()">
            <span class="text-[9px] font-bold text-white leading-tight block">CLIQUER<br>LE JEU</span>
        </div>
    </div>`;

    window.handleTeamChange = (teamIndex) => {
      FirebaseController.updatePlayerDoc(
        FirebaseController.auth.currentUser.uid,
        { team: teamIndex, lastActive: Date.now() }
      );
    };
  },

  startCountdown() {
    if (Game.countdownInterval) clearInterval(Game.countdownInterval);
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;

    let count = 3;
    const update = () => {
      // Ajustement de la taille de police pour que ça rentre
      slot.innerHTML = `
        <div class="flex items-center justify-center h-full w-full bg-orange-700">
            <span class="text-5xl font-black text-white drop-shadow-lg">${count}</span>
        </div>`;

      if (count <= 0) {
        slot.innerHTML = `
        <div class="flex items-center justify-center h-full w-full bg-green-600">
            <span class="text-4xl font-black text-white">GO!</span>
        </div>`;
        clearInterval(Game.countdownInterval);
      }
      count--;
    };
    update();
    Game.countdownInterval = setInterval(update, 1000);
  },

  stopCountdown() {
    if (Game.countdownInterval) {
      clearInterval(Game.countdownInterval);
      Game.countdownInterval = null;
    }
    const slot = document.getElementById("spell-announcement");
    if (slot)
      slot.innerHTML =
        "<span class='text-white font-bold text-sm'>Annonces</span>";
  },

  updatePlayerStats() {},

  resizeAllCanvases() {
    const canvasContainer = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");
    const spellsContainer = document.getElementById("spells-container");
    const opponentsGrid = document.getElementById("opponents-grid");

    if (canvasContainer && mainCanvas) {
      if (spellsContainer) spellsContainer.style.display = "none";

      // On prend toute la hauteur disponible du parent
      canvasContainer.style.height = "100%";

      const contW = canvasContainer.clientWidth;
      const contH = canvasContainer.clientHeight;

      // Ratio strict du jeu (Portrait)
      const idealRatio = 0.6;

      let newW, newH;

      if (contW / contH > idealRatio) {
        newH = contH;
        newW = newH * idealRatio;
      } else {
        newW = contW;
        newH = newW / idealRatio;
      }

      // Appliquer les dimensions au Canvas du joueur
      mainCanvas.width = newW;
      mainCanvas.height = newH;
      mainCanvas.style.width = `${newW}px`;
      mainCanvas.style.height = `${newH}px`;

      // --- CORRECTION CRITIQUE : SYNCHRONISATION DE LA GRILLE ---
      // On force la grille des adversaires à avoir exactement la même hauteur que le canvas
      if (opponentsGrid) {
        opponentsGrid.style.height = `${newH}px`;
        // On centre verticalement la grille si le container est plus grand
        opponentsGrid.style.marginTop = `${(contH - newH) / 2}px`;
      }

      // Calcul du rayon des boules
      const radW = newW / 17;
      const radH = newH / 26;
      Game.bubbleRadius = Math.min(radW, radH) * 0.95;
    }

    // Redimensionnement des canvas adverses
    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer?.id && p.canvas) {
        const oppCont = p.canvas.parentElement;
        if (oppCont) {
          // Les canvas adverses prennent 100% de leur slot CSS grid
          p.canvas.width = oppCont.clientWidth;
          p.canvas.height = oppCont.clientHeight;
        }
      }
    });
  },

  updateSpellAnnouncement(caster, spellInfo, targetName) {
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;
    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);

    // Affichage compact pour que ça rentre
    slot.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-1 bg-red-900 border-2 border-yellow-400 animate-pulse">
            <span class="text-[10px] font-bold text-yellow-300 truncate w-full text-center">${caster}</span>
            <div style="background-image:url('${spellInfo.icon}'); background-size:cover; width:20px; height:20px; margin: 2px 0;"></div>
            <span class="text-[9px] text-white leading-none text-center">sur<br>${targetName}</span>
        </div>
      `;

    this.announcementTimeout = setTimeout(() => {
      if (Game.state === "playing")
        slot.innerHTML =
          "<span class='text-white font-bold text-sm'>Annonces</span>";
    }, 4000);
  },

  preloadSpellIcons: () => {
    const spellIcons = Config.SPELLS;
    for (const key in spellIcons) {
      const img = new Image();
      img.src = spellIcons[key].icon;
      Game.spellIcons[key] = img;
    }
  },

  addChatMessage(name, msg) {
    const chat = document.getElementById("chat-messages");
    if (chat) {
      chat.innerHTML += `<div class="mb-1 text-xs"><span class="font-bold" style="color:${
        Game.localPlayer?.team !== undefined
          ? Config.TEAM_COLORS[Game.localPlayer.team]
          : "white"
      }">${name}:</span> <span class="text-gray-200">${msg}</span></div>`;
      chat.scrollTop = chat.scrollHeight;
    }
  },
  triggerScreenShake(intensity) {
    Game.shakeUntil = Date.now() + 500;
    Game.shakeIntensity = intensity === "high" ? 10 : 5;
  },
};
