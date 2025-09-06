import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";

export const UI = {
  announcementTimeout: null,
  selectedSpellIndex: null,

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
      "opponent-view flex items-center justify-center text-center";
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
    slot.innerHTML = "";

    const title = document.createElement("p");
    title.className = "font-bold text-sm mb-1";
    title.textContent = "Changer d'équipe";
    slot.appendChild(title);

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "grid grid-cols-2 gap-2 w-max mx-auto";

    Config.TEAM_COLORS.filter((_, i) => i !== Game.localPlayer.team).forEach(
      (color) => {
        const teamIndex = Config.TEAM_COLORS.indexOf(color);
        const btn = document.createElement("button");
        btn.className = "team-choice-btn";
        btn.style.backgroundColor = color;
        btn.onclick = () =>
          FirebaseController.updatePlayerDoc(
            FirebaseController.auth.currentUser.uid,
            { team: teamIndex, lastActive: Date.now() }
          );
        buttonContainer.appendChild(btn);
      }
    );
    slot.appendChild(buttonContainer);
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

    const inv = document.getElementById("spellInventory");
    inv.innerHTML = "";
    for (let i = 0; i < Config.MAX_SPELLS; i++) {
      const slot = document.createElement("div");
      slot.className = "spell-slot";
      const spellName = Game.localPlayer.spells[i];

      if (spellName && Config.SPELLS[spellName]) {
        const spell = Config.SPELLS[spellName];
        slot.style.backgroundImage = `url("${spell.icon}")`;
        slot.title = spell.name;

        slot.onclick = () => {
          this.selectedSpellIndex = this.selectedSpellIndex === i ? null : i;
          this.updatePlayerStats();
          this.updateTargetingUI();
        };

        if (this.selectedSpellIndex === i) {
          slot.classList.add("active");
        }
      } else {
        slot.style.opacity = "0.3";
      }
      inv.appendChild(slot);
    }

    if (Game.bubbleRadius > 0) {
      const slotSize = Game.bubbleRadius * 1.5;
      inv.style.height = `${slotSize * 1.1}px`;
      const slots = inv.querySelectorAll(".spell-slot");
      slots.forEach((slot) => {
        slot.style.width = `${slotSize}px`;
        slot.style.height = `${slotSize}px`;
      });
    }

    this.updateBoardEffects();
    this.updateTargetingUI();
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

  updateTargetingUI() {
    if (!Game.localPlayer) return;
    const isAiming = this.selectedSpellIndex !== null;

    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.toggle("aiming", isAiming);

    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer.id && p.container) {
        p.container.classList.toggle("aiming", isAiming);
      }
    });
  },

  updateSpellAnnouncement(caster, spellInfo, target) {
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;
    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
    let icon = spellInfo.icon
      ? `<div class="spell-slot" style="background-color:${spellInfo.color};background-image:url('${spellInfo.icon}');margin:4px auto;width:30px;height:30px;"></div>`
      : "";
    slot.innerHTML = `<span class="font-bold">${caster}</span>${icon}<span class="font-bold">${
      spellInfo.name
    }</span><span class="font-bold">${target ? ` sur ${target}` : ""}</span>`;
    this.announcementTimeout = setTimeout(() => {
      if (slot && Game.state === "playing") {
        slot.innerHTML = "<span>Annonces</span>";
      }
    }, 4000);
  },

  resizeAllCanvases() {
    const mainCanvasCont = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");

    if (mainCanvas && mainCanvasCont) {
      const contW = mainCanvasCont.clientWidth;
      const contH = mainCanvasCont.clientHeight;

      // --- LA LOGIQUE FINALE ET CORRECTE, BASÉE SUR VOS INSTRUCTIONS ---
      const rowHeightFactor = 1.732;

      // 1. La GRILLE DE JEU a une hauteur de 12 rangées (0 à 11).
      const gridHeightInRows = Config.GAME_OVER_ROW + 1; // = 12

      // 2. La ZONE DE TIR a une hauteur de 3 rangées.
      const launcherHeightInRows = 3;

      // 3. La HAUTEUR TOTALE du contenu est de 12 + 3 = 15 rangées.
      const totalHeightInRows = gridHeightInRows + launcherHeightInRows;

      // 4. On calcule le ratio final à partir de ces règles.
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
