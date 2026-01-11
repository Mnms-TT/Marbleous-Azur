import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";
import { Drawing } from "./drawing.js";

export const UI = {
  announcementTimeout: null,

  renderOpponents() {
    const grid = document.getElementById("opponents-grid");
    if (!grid) return;
    grid.innerHTML = "";

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

    // Ligne 2 : Annonces
    const announcement = document.createElement("div");
    announcement.id = "spell-announcement";
    announcement.className =
      "opponent-view flex flex-col items-center justify-center text-center p-1 overflow-hidden relative";
    announcement.style.backgroundColor = "#c2410c";
    announcement.style.border = "2px solid white";
    announcement.innerHTML = `<span class="text-white font-bold text-xs">Annonces</span>`;
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
      "opponent-view flex items-center justify-center bg-slate-900 opacity-50";
    s.innerHTML = `<span class="text-slate-600 text-[10px]">Libre</span>`;
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
      if (slot)
        slot.innerHTML = `<div class="flex flex-col items-center justify-center h-full bg-green-700 animate-pulse text-white"><span class="font-bold text-sm">PRÊT</span><span class="text-[10px]">${ready}/${total}</span></div>`;
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

    const currentTeam = Game.localPlayer.team || 0;
    const teamNames = ['Jaune', 'Rouge', 'Vert', 'Bleu', 'Rose'];

    // Filtrer pour ne montrer que les 4 autres couleurs (pas la couleur actuelle)
    const otherTeams = Config.TEAM_COLORS
      .map((c, i) => ({ color: c, index: i, name: teamNames[i] }))
      .filter(t => t.index !== currentTeam);

    // Créer la grille 2x2 de couleurs (4 autres) - prend toute la place
    slot.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; width:100%; height:100%; background:#FFB864; padding:3px; gap:3px;">
        ${otherTeams.map(t => `
          <button 
            style="width:100%; height:100%; border-radius:50%; background:${t.color}; 
                   border:2px solid rgba(0,0,0,0.3); 
                   cursor:pointer; box-shadow:inset 0 -3px 6px rgba(0,0,0,0.3);"
            onclick="window.handleTeamChange(${t.index})"
            title="Équipe ${t.name}"
          ></button>
        `).join("")}
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
      slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-purple-800 text-white font-black text-4xl">${count}</div>`;
      if (count <= 0) {
        slot.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-green-600 text-white font-black text-2xl">GO!</div>`;
        clearInterval(Game.countdownInterval);

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
        "<span class='text-white font-bold text-xs'>Annonces</span>";
  },

  updatePlayerStats() { },

  resizeAllCanvases() {
    const container = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");

    if (container && mainCanvas) {
      // Le canvas prend TOUTE la largeur et hauteur du conteneur
      const canvasW = container.clientWidth;
      const canvasH = container.clientHeight;

      if (mainCanvas.width !== canvasW || mainCanvas.height !== canvasH) {
        mainCanvas.width = canvasW;
        mainCanvas.height = canvasH;

        // Calculer le rayon pour que les bulles remplissent toute la LARGEUR
        // La grille de 8 colonnes + offset nécessite 17 rayons de large
        const radius = canvasW / 17;

        Game.bubbleRadius = radius;
        Drawing.drawAll();
      }
    }

    // Redimensionner les canvas des adversaires
    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer?.id && p.canvas) {
        const parent = p.canvas.parentElement;
        if (parent) {
          const w = parent.clientWidth;
          const h = parent.clientHeight;
          if (p.canvas.width !== w || p.canvas.height !== h) {
            p.canvas.width = w;
            p.canvas.height = h;
          }
        }
      }
    });

    // Mettre à jour la barre de sorts
    this.updateSpellsBar();
  },

  updateSpellsBar() {
    const spellSlots = document.querySelectorAll("#spells-bar .spell-slot");
    if (!spellSlots.length || !Game.localPlayer) return;

    const spells = Game.localPlayer.spells || [];
    const numSlots = spellSlots.length;

    // LIFO: le dernier sort (index length-1) doit être à DROITE (dernier slot)
    // On affiche les sorts de gauche à droite, les plus récents à droite
    spellSlots.forEach((slot, i) => {
      slot.innerHTML = "";
      slot.style.backgroundColor = "rgba(30, 41, 59, 0.8)";

      // Calculer l'index du sort pour ce slot (les sorts les plus anciens à gauche)
      // Slot 0 = sort le plus ancien, Slot 6 = sort le plus récent
      const spellIndex = spells.length - numSlots + i;

      if (spellIndex >= 0 && spellIndex < spells.length) {
        const spellName = spells[spellIndex];
        const spellInfo = Config.SPELLS[spellName];
        if (spellInfo) {
          const icon = Game.spellIcons[spellName];
          if (icon && icon.complete) {
            const img = document.createElement("img");
            img.src = icon.src;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "contain";
            slot.appendChild(img);
          } else {
            slot.style.backgroundColor = spellInfo.color;
          }
        }
      }
    });
  },

  updateSpellAnnouncement(caster, spellInfo, target) {
    const announcement = document.getElementById("spell-announcement");
    if (!announcement || !spellInfo) return;

    // Format: Caster (haut), Spell (milieu), Target (bas)
    announcement.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:2px;text-align:center;">
        <div style="font-size:10px;color:#94a3b8;">⚔️ ${caster}</div>
        <div style="font-size:14px;font-weight:bold;color:${spellInfo.color || '#fff'}">${spellInfo.name}</div>
        <div style="font-size:10px;color:#fbbf24;">→ ${target}</div>
      </div>
    `;

    // Effacer après 3 secondes
    setTimeout(() => {
      if (announcement) announcement.innerHTML = "";
    }, 3000);
  },

  // Déclenche un tremblement sur le canvas du joueur
  triggerShake(intensity = 1) {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    // Nettoyer l'animation précédente
    canvas.classList.remove("shaking", "shaking-intense");

    if (intensity >= 3) {
      canvas.classList.add("shaking-intense");
      setTimeout(() => canvas.classList.remove("shaking-intense"), intensity * 500);
    } else {
      canvas.classList.add("shaking");
      setTimeout(() => canvas.classList.remove("shaking"), 500);
    }
  },
  preloadSpellIcons: () =>
    Object.entries(Config.SPELLS).forEach(([key, spell]) => {
      const i = new Image();
      i.src = spell.icon;
      Game.spellIcons[key] = i; // Utiliser la clé (ex: "plateauRenverse") pas le nom affiché
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
