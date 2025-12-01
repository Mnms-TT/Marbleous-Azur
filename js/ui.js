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

    // On s'assure que la grille CSS est bien configurée pour 5 colonnes
    grid.className = "grid grid-cols-5 grid-rows-2 gap-1 h-full";

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    // LOGIQUE DE PLACEMENT 5x2 (10 slots au total)
    // Ligne 1 : 5 Adversaires
    // Ligne 2 : 1 Annonce (Gauche) + 4 Adversaires

    // 1. Remplir la première ligne (Indices 0 à 4)
    for (let i = 0; i < 5; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    // 2. Placer la case ANNONCES (Premier slot de la ligne 2 -> Index 5)
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex items-center justify-center text-center p-1";
    announcement.style.backgroundColor = "#ea580c"; // Orange distinctif (comme photo)
    announcement.style.border = "2px solid white";
    announcement.innerHTML =
      "<span class='text-white font-bold'>Annonces</span>";
    grid.appendChild(announcement);

    // 3. Remplir le reste de la ligne 2 (Indices 5 à 8 des opposants)
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
      "opponent-view empty-slot flex items-center justify-center bg-gray-900 border-2 border-dashed border-gray-600";
    s.innerHTML = `<span class="text-gray-500 text-xs">En attente...</span>`;
    return s;
  },

  checkVoteStatus() {
    if (Game.state !== "waiting" || !Game.localPlayer) return;

    const ready = Array.from(Game.players.values()).filter(
      (p) => p.isReady
    ).length;
    const total = Game.players.size;
    const required = total <= 1 ? 1 : Math.ceil(total / 2) + 1;

    // Mise à jour de la case Annonces
    if (!Game.localPlayer.isReady) {
      this.renderTeamSelectionInAnnouncementBox();
    } else {
      const slot = document.getElementById("spell-announcement");
      if (slot)
        slot.innerHTML = `<div class="flex flex-col text-white"><span class="font-bold text-lg">Prêts: ${ready}/${total}</span><span class="text-xs text-gray-200">En attente...</span></div>`;
    }

    // Affichage "PRET" sur le canvas du joueur
    // Note : Le dessin "PRET" est géré dans drawing.js, ici on gère juste le changement d'état
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

    // Interface de choix d'équipe dans la case orange
    slot.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full p-1">
        <p class="font-bold text-xs text-white mb-1">Choix Équipe</p>
        <div class="flex flex-wrap justify-center gap-1 mb-1">
            ${Config.TEAM_COLORS.map((color, index) => {
              const isSelected = Game.localPlayer.team === index;
              return `<button style="background-color:${color}; width: 18px; height: 18px; border-radius: 50%; border: ${
                isSelected ? "2px solid white" : "1px solid rgba(0,0,0,0.3)"
              }; transform: ${
                isSelected ? "scale(1.2)" : "scale(1)"
              }" onclick="window.handleTeamChange(${index})"></button>`;
            }).join("")}
        </div>
        <div class="bg-black bg-opacity-30 rounded px-2 py-1 mt-1 animate-pulse cursor-pointer" onclick="document.getElementById('gameCanvas').click()">
            <span class="text-[10px] font-bold text-white">CLIQUEZ LE JEU<br>POUR ÊTRE PRÊT</span>
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
      slot.innerHTML = `<span class="text-6xl font-black text-white drop-shadow-md">${count}</span>`;
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
    if (Game.countdownInterval) {
      clearInterval(Game.countdownInterval);
      Game.countdownInterval = null;
    }
    const slot = document.getElementById("spell-announcement");
    if (slot)
      slot.innerHTML = "<span class='text-white font-bold'>Annonces</span>";
  },

  updatePlayerStats() {
    // Géré par le canvas maintenant
  },

  resizeAllCanvases() {
    const canvasContainer = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");
    const spellsContainer = document.getElementById("spells-container");

    if (canvasContainer && mainCanvas) {
      if (spellsContainer) spellsContainer.style.display = "none"; // On cache l'ancien HTML
      canvasContainer.style.height = "100%";

      const contW = canvasContainer.clientWidth;
      const contH = canvasContainer.clientHeight;

      // RATIO STRICT TYPE "Bust-A-Move"
      // Hauteur = 12 lignes + Ligne + Canon + Sorts. C'est très vertical.
      // Ratio L/H environ 0.6
      const idealRatio = 0.6;

      let newW, newH;

      if (contW / contH > idealRatio) {
        newH = contH;
        newW = newH * idealRatio;
      } else {
        newW = contW;
        newH = newW / idealRatio;
      }

      mainCanvas.width = newW;
      mainCanvas.height = newH;
      mainCanvas.style.width = `${newW}px`;
      mainCanvas.style.height = `${newH}px`;

      // CALCUL DU RAYON (Vital)
      // On prend la plus petite valeur pour être sûr que ça rentre
      // 17 unités en largeur (8 boules * 2 + 1)
      // 25 unités en hauteur (12 lignes + canon)
      const radW = newW / 17;
      const radH = newH / 26; // Un peu plus de marge verticale

      Game.bubbleRadius = Math.min(radW, radH) * 0.95;
    }

    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer?.id && p.canvas) {
        const oppCont = p.canvas.parentElement;
        if (oppCont) {
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

    slot.innerHTML = `
        <div class="flex flex-col items-center">
            <span class="text-xs font-bold text-yellow-300">${caster}</span>
            <div style="background-image:url('${spellInfo.icon}'); background-size:cover; width:24px; height:24px;"></div>
            <span class="font-bold text-xs text-white">${spellInfo.name}</span>
            <span class="text-[10px] text-red-200">-> ${targetName}</span>
        </div>
      `;

    this.announcementTimeout = setTimeout(() => {
      if (Game.state === "playing")
        slot.innerHTML = "<span class='text-white font-bold'>Annonces</span>";
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
