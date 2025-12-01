import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";

export const UI = {
  announcementTimeout: null,
  spellSlotSize: 0,

  // --- Gestion des Adversaires ---
  renderOpponents() {
    const grid = document.getElementById("opponents-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    // Création de la case Annonces au milieu
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex items-center justify-center text-center p-2";
    announcement.style.backgroundColor = "#d97706"; // Orange distinctif
    announcement.innerHTML = "<span>Annonces</span>";

    // Layout 3x3 : 4 adversaires, Annonce, 4 adversaires (Total 9 slots)
    // On remplit les slots
    for (let i = 0; i < 4; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    grid.appendChild(announcement);

    for (let i = 4; i < 8; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

    this.resizeAllCanvases();
  },

  createEmptySlot: () => {
    const s = document.createElement("div");
    s.className = "opponent-view empty-slot flex items-center justify-center";
    s.innerHTML = `<span class="text-gray-500 text-xs">En attente...</span>`;
    return s;
  },

  // --- Gestion du vote et countdown ---
  checkVoteStatus() {
    if (Game.state !== "waiting" || !Game.localPlayer) return;

    const ready = Array.from(Game.players.values()).filter(
      (p) => p.isReady
    ).length;
    const total = Game.players.size;

    // Majorité requise
    const required = total <= 1 ? 1 : Math.ceil(total / 2) + 1;

    if (!Game.localPlayer.isReady) {
      this.renderTeamSelectionInAnnouncementBox();
    } else {
      // Affichage simple du statut
      const slot = document.getElementById("spell-announcement");
      if (slot)
        slot.innerHTML = `<div class="flex flex-col"><span class="font-bold">Prêts: ${ready} / ${total}</span><span class="text-xs">(Majorité: ${required})</span></div>`;
    }

    // Overlay "Prêt" sur les joueurs
    Game.players.forEach((p) => {
      const container =
        p.id === Game.localPlayer.id
          ? document.getElementById("canvas-container")
          : p.container;
      if (container) {
        let overlay = container.querySelector(".ready-overlay");
        if (p.isReady) {
          if (!overlay) {
            overlay = document.createElement("div");
            overlay.className =
              "ready-overlay absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white font-bold text-2xl z-10";
            overlay.textContent = "PRÊT !";
            container.appendChild(overlay);
          }
        } else if (overlay) {
          overlay.remove();
        }
      }
    });

    // Lancement si majorité
    if (
      total > 0 &&
      ready >= required &&
      Game.localPlayer.id === Array.from(Game.players.keys())[0]
    ) {
      // Seul le "host" (premier joueur de la map) déclenche le countdown pour éviter les conflits
      FirebaseController.updateSessionDoc({ gameState: "countdown" });
    }
  },

  renderTeamSelectionInAnnouncementBox() {
    const slot = document.getElementById("spell-announcement");
    if (!slot || !Game.localPlayer) return;
    slot.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full">
        <p class="font-bold text-xs mb-1">Changer d'équipe</p>
        <div class="grid grid-cols-3 gap-1">
            ${Config.TEAM_COLORS.map((color, index) => {
              const isSelected = Game.localPlayer.team === index;
              return `<button style="background-color:${color}; width: 20px; height: 20px; border-radius: 50%; border: ${
                isSelected ? "2px solid white" : "none"
              }; box-shadow: ${
                isSelected ? "0 0 4px black" : "none"
              }" onclick="window.handleTeamChange(${index})"></button>`;
            }).join("")}
        </div>
        <p class="text-[10px] mt-1 text-white opacity-80">Cliquez pour Prêt</p>
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
    this.clearAllReadyOverlays(); // On enlève les overlays "PRET" pour voir le jeu

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
    update(); // 3 tout de suite
    Game.countdownInterval = setInterval(update, 1000);
  },

  stopCountdown() {
    if (Game.countdownInterval) {
      clearInterval(Game.countdownInterval);
      Game.countdownInterval = null;
    }
    const slot = document.getElementById("spell-announcement");
    if (slot) slot.innerHTML = "<span>Annonces</span>";
  },

  clearAllReadyOverlays() {
    document.querySelectorAll(".ready-overlay").forEach((el) => el.remove());
  },

  // --- Gestion de l'affichage des sorts ---
  updatePlayerStats() {
    if (!Game.localPlayer) return;
    const spellsContainer = document.getElementById("spells-container");
    // On dessine les sorts directement dans le Canvas maintenant,
    // mais on garde cette fonction si on veut mettre à jour d'autres stats HTML
  },

  // --- Redimensionnement ---
  resizeAllCanvases() {
    const playerColumn = document.getElementById("player-column");
    const canvasContainer = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");
    const spellsContainer = document.getElementById("spells-container");

    if (playerColumn && canvasContainer && mainCanvas) {
      // On cache le conteneur HTML des sorts car on les dessine dans le canvas désormais
      if (spellsContainer) spellsContainer.style.display = "none";
      canvasContainer.style.height = "100%";

      const contW = canvasContainer.clientWidth;
      const contH = canvasContainer.clientHeight;

      // CALCUL DU RATIO STRICT
      // On veut : 12 rangées de boules + Espace Ligne + Espace Canon + Espace Sorts
      // Une rangée ~ 1.732 * rayon. Largeur = 17 * rayon.
      // Ratio H/L approx = 1.6
      const idealRatio = 0.6; // Largeur / Hauteur (Format Portrait)

      let newW = contW;
      let newH = contH;

      // On s'assure que le canvas rentre dans le conteneur en gardant le ratio
      if (contW / contH > idealRatio) {
        newW = contH * idealRatio;
        newH = contH;
      } else {
        newW = contW;
        newH = contW / idealRatio;
      }

      mainCanvas.width = newW;
      mainCanvas.height = newH;
      mainCanvas.style.width = `${newW}px`;
      mainCanvas.style.height = `${newH}px`;

      // Recalcul du rayon des boules basé sur la largeur
      // 8 colonnes -> 16 unités de rayon + 1 de décalage = 17
      Game.bubbleRadius = (newW / 17) * 0.95;
    }

    // Redimensionnement des adversaires
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
        <div class="flex flex-col items-center animate-pulse">
            <span class="text-xs font-bold text-yellow-300">${caster} lance</span>
            <span class="font-bold text-sm text-white border-b border-white">${spellInfo.name}</span>
            <span class="text-xs text-red-300">sur ${targetName}</span>
        </div>
      `;

    this.announcementTimeout = setTimeout(() => {
      if (Game.state === "playing") slot.innerHTML = "<span>Annonces</span>";
    }, 3000);
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
      chat.innerHTML += `<div class="mb-1"><span class="font-bold" style="color:${
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
