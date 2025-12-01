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
    announcement.className = "opponent-view flex flex-col items-center justify-center text-center p-1 overflow-hidden relative";
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
    s.className = "opponent-view flex items-center justify-center bg-slate-900 opacity-50";
    s.innerHTML = `<span class="text-slate-600 text-[10px]">Libre</span>`;
    return s;
  },

  checkVoteStatus() {
    if (Game.state !== "waiting" || !Game.localPlayer) return;
    const ready = Array.from(Game.players.values()).filter((p) => p.isReady).length;
    const total = Game.players.size;
    const required = total <= 1 ? 1 : Math.ceil(total / 2) + 1;

    const slot = document.getElementById("spell-announcement");
    
    if (!Game.localPlayer.isReady) {
        this.renderTeamSelectionInAnnouncementBox();
    } else {
        if(slot) slot.innerHTML = `<div class="flex flex-col items-center justify-center h-full bg-green-700 animate-pulse text-white"><span class="font-bold text-sm">PRÊT</span><span class="text-[10px]">${ready}/${total}</span></div>`;
    }

    if (total > 0 && ready >= required && Game.localPlayer.id === Array.from(Game.players.keys())[0]) {
        FirebaseController.updateSessionDoc({ gameState: "countdown" });
    }
  },

  renderTeamSelectionInAnnouncementBox() {
    const slot = document.getElementById("spell-announcement");
    if (!slot || !Game.localPlayer) return;
    
    slot.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full h-full bg-orange-600 p-1">
        <div class="flex flex-wrap justify-center gap-1 mb-1">
            ${Config.TEAM_COLORS.map((c, i) => `<button style="background:${c}; width:12px; height:12px; border-radius:50%; border:${Game.localPlayer.team===i?'2px solid white':'none'}" onclick="window.handleTeamChange(${i})"></button>`).join('')}
        </div>
        <button class="bg-black/40 hover:bg-black/60 text-white text-[9px] font-bold px-2 py-1 rounded border border-white/20" onclick="document.getElementById('gameCanvas').click()">GO</button>
    </div>`;
    
    window.handleTeamChange = (i) => FirebaseController.updatePlayerDoc(FirebaseController.auth.currentUser.uid, { team: i, lastActive: Date.now() });
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
    if(slot) slot.innerHTML = "<span class='text-white font-bold text-xs'>Annonces</span>";
  },

  updatePlayerStats() {},

  resizeAllCanvases() {
    const container = document.getElementById("canvas-container");
    const mainCanvas = document.getElementById("gameCanvas");

    if (container && mainCanvas) {
      // 1. On prend la taille réelle du conteneur (définie par le CSS/HTML)
      const w = container.clientWidth;
      const h = container.clientHeight;
      
      // 2. On applique cette taille au canvas
      mainCanvas.width = w;
      mainCanvas.height = h;
      
      // 3. On calcule le rayon des boules pour qu'elles rentrent TOUTES
      // - 17 unités de large (8 colonnes + décalage)
      // - 25 unités de haut (12 lignes + canon + marges)
      const radFromWidth = w / 17;
      const radFromHeight = h / 26; // Un peu de marge verticale
      
      // On prend le plus petit rayon pour être sûr que ça ne déborde jamais
      Game.bubbleRadius = Math.min(radFromWidth, radFromHeight) * 0.95;
    }

    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer?.id && p.canvas) {
        const parent = p.canvas.parentElement;
        if(parent) {
            p.canvas.width = parent.clientWidth;
            p.canvas.height = parent.clientHeight;
        }
      }
    });
  },
  
  updateSpellAnnouncement(caster, spellInfo, target) {},
  preloadSpellIcons: () => Object.values(Config.SPELLS).forEach(s => { const i = new Image(); i.src = s.icon; Game.spellIcons[s.name] = i; }),
  addChatMessage(name, msg) {
      const chat = document.getElementById('chat-messages');
      if(chat) {
          const color = Game.localPlayer?.team !== undefined ? Config.TEAM_COLORS[Game.localPlayer.team] : '#93c5fd';
          chat.innerHTML += `<div class="mb-1"><span class="font-bold" style="color:${color}">${name}:</span> ${msg}</div>`;
          chat.scrollTop = chat.scrollHeight;
      }
  },
  triggerScreenShake(intensity) { Game.shakeUntil = Date.now() + 500; Game.shakeIntensity = 5; }
};