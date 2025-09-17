import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";

export const UI = {
  announcementTimeout: null,
  spellSlotSize: 0, 

  clearAllReadyOverlays() {
    const overlays = document.querySelectorAll(".ready-overlay");
    overlays.forEach((overlay) => overlay.remove());
  },

  renderOpponents() {
    const grid = document.getElementById("opponents-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex items-center justify-center text-center p-2";
    announcement.innerHTML = "<span>Annonces</span>";

    for (let i = 0; i < 5; i++) {
      const p = opponents[i];
      const slot = p ? p.container : this.createEmptySlot();
      if (p) p.canvas.dataset.playerId = p.id;
      grid.appendChild(slot);
    }

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
    s.className = "opponent-view empty-slot flex items-center justify-center";
    s.innerHTML = `<span class="text-gray-500">En attente...</span>`;
    return s;
  },

  renderTeamSelectionInAnnouncementBox() {
    const slot = document.getElementById("spell-announcement");
    if (!slot || !Game.localPlayer) return;
    slot.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full">
        <p class="font-bold text-sm mb-1">Changer d'équipe</p>
        <div class="grid grid-cols-2 gap-2 w-max mx-auto">
            ${Config.TEAM_COLORS.filter((_, i) => i !== Game.localPlayer.team).map(color => {
                const teamIndex = Config.TEAM_COLORS.indexOf(color);
                return `<button class="team-choice-btn" style="background-color:${color}; width: 24px; height: 24px; border-radius: 50%;" onclick="window.handleTeamChange(${teamIndex})"></button>`
            }).join('')}
        </div>
    </div>`;
    // Attach the function to the window object to be accessible from the onclick attribute
    window.handleTeamChange = (teamIndex) => {
         FirebaseController.updatePlayerDoc(
            FirebaseController.auth.currentUser.uid,
            { team: teamIndex, lastActive: Date.now() }
          );
    };
  },

  checkVoteStatus() {
    if (Game.state !== "waiting" || !Game.localPlayer) return;

    const ready = Array.from(Game.players.values()).filter(
      (p) => p.isReady
    ).length;
    const total = Game.players.size;
    const required = total <= 1 ? 1 : Math.ceil(total / 2);

    if (!Game.localPlayer.isReady) {
      this.renderTeamSelectionInAnnouncementBox();
    } else {
      this.updateSpellAnnouncement(
        "Système",
        { name: `Prêts: ${ready} / ${total}` },
        null
      );
    }

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
            overlay.className = "ready-overlay";
            overlay.textContent = "Prêt!";
            container.appendChild(overlay);
          }
        } else if (overlay) {
          overlay.remove();
        }
      }
    });

    if (total > 0 && ready >= required) {
      FirebaseController.updateSessionDoc({ gameState: "countdown" });
    }
  },
  startCountdown() {
    if (Game.countdownInterval) clearInterval(Game.countdownInterval);

    this.clearAllReadyOverlays();

    const slot = document.getElementById("spell-announcement");
    if (!slot) return;
    let count = 3;
    const update = () => {
      if (count > 0) {
        slot.innerHTML = `<span class="text-4xl font-bold">${count}</span>`;
        count--;
      } else {
        slot.innerHTML = `<span class="text-2xl font-bold">GO!</span>`;
        clearInterval(Game.countdownInterval);
        if (Game.localPlayer)
          FirebaseController.updateSessionDoc({ gameState: "playing" });
      }
    };
    update();
    Game.countdownInterval = setInterval(update, 1000);
  },
  stopCountdown() {
    if (Game.countdownInterval) {
      clearInterval(Game.countdownInterval);
      Game.countdownInterval = null;
    }
  },

  updatePlayerStats() {
    if (!Game.localPlayer) return;
    const spellsContainer = document.getElementById("spells-container");
    if (!spellsContainer || this.spellSlotSize === 0) return;
  
    spellsContainer.innerHTML = "";
  
    Game.localPlayer.spells.forEach((spellName) => {
      if (Config.SPELLS[spellName]) {
        const spell = Config.SPELLS[spellName];
        const slot = document.createElement("div");
        slot.className = "spell-slot";
        slot.style.backgroundImage = `url("${spell.icon}")`;
        slot.title = spell.name;
        slot.style.width = `${this.spellSlotSize}px`;
        slot.style.height = `${this.spellSlotSize}px`;
        spellsContainer.prepend(slot);
      }
    });
  
    this.updateBoardEffects();
    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer.id && p.teamIndicator)
        p.teamIndicator.style.backgroundColor = Config.TEAM_COLORS[p.team];
    });
  },
  
  updateBoardEffects() {
    let transform = "";
    if (Game.localPlayer?.statusEffects.plateauIncline)
      transform += ` rotate(${
        Game.localPlayer.statusEffects.plateauIncline.direction * 7
      }deg)`;
    if (Game.shakeUntil && Date.now() < Game.shakeUntil) {
      const intensity = Game.shakeIntensity;
      transform += ` translate(${(Math.random() - 0.5) * intensity}px, ${
        (Math.random() - 0.5) * intensity
      }px)`;
    } else if (Game.shakeUntil) {
      Game.shakeUntil = 0;
      Game.shakeIntensity = 0;
    }
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.style.transform = transform.trim();
  },

  updateSpellAnnouncement(caster, spellInfo, target) {
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;
    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
  
    const iconHTML = spellInfo.icon
      ? `<div class="spell-slot" style="background-color:${spellInfo.color};background-image:url('${spellInfo.icon}');margin: 0 4px;width:24px;height:24px; flex-shrink:0;"></div>`
      : "";
    
    slot.innerHTML = `
      <div class="flex flex-col items-center justify-center w-full h-full text-xs sm:text-sm overflow-hidden p-1">
        <div class="flex items-center justify-center">
          <span class="font-bold whitespace-nowrap">${caster}</span>
          ${iconHTML}
          <span class="font-bold whitespace-nowrap">${spellInfo.name}</span>
        </div>
        ${target ? `<span class="font-bold whitespace-nowrap text-xs mt-1">sur ${target}</span>` : ""}
      </div>
    `;
  
    this.announcementTimeout = setTimeout(() => {
      if (slot && (Game.state === "playing" || Game.state === 'countdown')) {
        slot.innerHTML = "<span>Annonces</span>";
      }
    }, 4000);
  },

  resizeAllCanvases() {
    const playerColumn = document.getElementById("player-column");
    const canvasContainer = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");
    const spellsContainer = document.getElementById("spells-container");

    if (playerColumn && canvasContainer && mainCanvas && spellsContainer) {
      // CORRECTION DÉFINITIVE : La mise en page est maintenant entièrement contrôlée par JavaScript
      const gap = 4;
      this.spellSlotSize = (playerColumn.clientWidth - (Config.MAX_SPELLS - 1) * gap) / Config.MAX_SPELLS;
      
      spellsContainer.style.height = `${this.spellSlotSize}px`;
      spellsContainer.style.gap = `${gap}px`;
      
      canvasContainer.style.height = `calc(100% - ${this.spellSlotSize}px)`;

      const contW = canvasContainer.clientWidth;
      const contH = canvasContainer.clientHeight;

      const rowHeightFactor = 1.732;
      const gridHeightInRows = Config.GAME_OVER_ROW + 1;
      const launcherHeightInRows = 2;
      const totalHeightInRows = gridHeightInRows + launcherHeightInRows;
      const idealWidthUnits = Config.GRID_COLS * 2;
      const idealHeightUnits = totalHeightInRows * rowHeightFactor;
      const idealRatio = idealWidthUnits / idealHeightUnits;

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

      Game.bubbleRadius = (newW / (Config.GRID_COLS * 2 + 1)) * 0.95;
      
      this.updatePlayerStats();
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

  preloadSpellIcons: () => {
    const spellIcons = {
      plateauIncline: "icons/sort_tilt.png",
      canonEndommage: "icons/sort_canon.png",
      sabotageSorts: "icons/sort_cancel.png",
      canonArcEnCiel: "icons/sort_rainbow.png",
      monteeLignes: "icons/sort_addline.png",
      nukeBomb: "icons/sort_nuke.png",
      colonneMonochrome: "icons/sort_monocolor.png",
      disparitionLignes: "icons/sort_removeline.png",
    };

    for (const key in spellIcons) {
      if (Config.SPELLS[key]) {
        Config.SPELLS[key].icon = spellIcons[key];
        const img = new Image();
        img.src = spellIcons[key];
        Game.spellIcons[key] = img;
      }
    }
  },
};