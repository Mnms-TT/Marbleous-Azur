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

    // 5×2 grid = 10 slots: 9 opponent + 1 announcement (at position 6)
    let oppIndex = 0;
    for (let i = 0; i < 10; i++) {
      if (i === 5) {
        // Position 6 (2nd row, 1st col == index 5) = announcement slot
        const ann = document.createElement("div");
        ann.id = "spell-announcement";
        ann.innerHTML = `<span>Annonces</span>`;
        grid.appendChild(ann);
      } else {
        const p = opponents[oppIndex];
        const slot = p ? p.container : this.createEmptySlot();
        if (p) p.canvas.dataset.playerId = p.id;
        grid.appendChild(slot);
        oppIndex++;
      }
    }

    // Update player count display
    const countDisplay = document.getElementById("player-count-display");
    if (countDisplay) {
      countDisplay.textContent = `${Game.players.size} joueur${Game.players.size > 1 ? 's' : ''}`;
    }

    requestAnimationFrame(() => this.resizeAllCanvases());
  },

  createEmptySlot: () => {
    const s = document.createElement("div");
    s.className = "opponent-view empty";
    s.innerHTML = `<span>Libre</span>`;
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
        slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;background:#15803d;"><span style="color:white;font-weight:bold;font-size:12px;">PRÊT ${ready}/${total}</span></div>`;
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

    const otherTeams = Config.TEAM_COLORS
      .map((c, i) => ({ color: c, index: i, name: teamNames[i] }))
      .filter(t => t.index !== currentTeam);

    // 2×2 grid layout — one ball per quadrant (like reference)
    slot.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;
                width:100%; height:100%; background:#FFB864; position:relative;">
        ${otherTeams.slice(0, 4).map(t => `
          <div style="display:flex; align-items:center; justify-content:center;">
            <button 
              style="width:40px; height:40px; border-radius:50%; background:${t.color}; 
                     border:2px solid rgba(0,0,0,0.3); 
                     cursor:pointer; box-shadow:inset 0 -3px 5px rgba(0,0,0,0.3);"
              onclick="window.handleTeamChange(${t.index})"
              title="Équipe ${t.name}"
            ></button>
          </div>
        `).join("")}
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    font-size:9px; color:#333; font-weight:bold; text-align:center;
                    pointer-events:none; line-height:1.2; text-shadow:0 0 3px #FFB864, 0 0 6px #FFB864;">Choix de<br>l'équipe</div>
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
      slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#581c87;"><span style="color:white;font-weight:900;font-size:18px;">${count}</span></div>`;
      if (count <= 0) {
        slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#16a34a;"><span style="color:white;font-weight:900;font-size:16px;">GO!</span></div>`;
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

  showAnnouncement(message, duration = 2000) {
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;

    slot.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; background:rgba(0,0,0,0.8);">
      <span style="color:#fbbf24; font-weight:bold; font-size:14px; text-shadow:0 0 10px #fbbf24;">${message}</span>
    </div>`;

    // Revenir à l'affichage normal après la durée
    setTimeout(() => {
      if (Game.state === "playing") {
        slot.innerHTML = "<span class='text-white font-bold text-xs'>Annonces</span>";
      } else {
        this.checkVoteStatus();
      }
    }, duration);
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
    const slot = document.getElementById("active-spell-slot");
    if (!slot || !Game.localPlayer) return;

    const spells = Game.localPlayer.spells || [];
    slot.innerHTML = "";
    slot.style.backgroundColor = "#1e3a5f";

    // Afficher le premier sort FIFO (le prochain à lancer)
    if (spells.length > 0) {
      const spellName = spells[0];
      const spellInfo = Config.SPELLS[spellName];
      if (spellInfo) {
        const icon = Game.spellIcons[spellName];
        if (icon && icon.complete) {
          const img = document.createElement("img");
          img.src = icon.src;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "contain";
          img.style.display = "block";
          slot.appendChild(img);
        } else {
          slot.style.backgroundColor = spellInfo.color;
        }
      }
    }
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

  // Déclenche un tremblement exponentiel sur le canvas du joueur
  triggerShake(intensity = 1, duration = 500) {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    // Amplitude dynamique basée sur l'intensité (1-8)
    const amplitude = Math.min(intensity * 3, 25); // Max 25px

    // Créer une animation CSS dynamique
    const keyframeName = `shake_${Date.now()}`;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ${keyframeName} {
        0%, 100% { transform: translate(0, 0); }
        10% { transform: translate(${amplitude}px, ${-amplitude * 0.5}px); }
        20% { transform: translate(${-amplitude}px, ${amplitude * 0.3}px); }
        30% { transform: translate(${amplitude * 0.7}px, ${amplitude}px); }
        40% { transform: translate(${-amplitude * 0.8}px, ${-amplitude * 0.6}px); }
        50% { transform: translate(${amplitude * 0.5}px, ${-amplitude * 0.4}px); }
        60% { transform: translate(${-amplitude * 0.3}px, ${amplitude * 0.7}px); }
        70% { transform: translate(${amplitude * 0.6}px, ${-amplitude * 0.3}px); }
        80% { transform: translate(${-amplitude * 0.4}px, ${amplitude * 0.5}px); }
        90% { transform: translate(${amplitude * 0.3}px, ${-amplitude * 0.2}px); }
      }
    `;
    document.head.appendChild(style);

    // Appliquer l'animation
    canvas.style.animation = 'none';
    canvas.offsetHeight; // Force reflow
    canvas.style.animation = `${keyframeName} ${Math.min(300, 100 + intensity * 20)}ms ease-in-out ${Math.ceil(duration / 300)}`;

    // Nettoyer après la durée
    setTimeout(() => {
      canvas.style.animation = '';
      style.remove();
    }, duration);
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
      let color;
      // System messages in gold
      if (name === 'Système' || name === '🏆 Système' || name === '⚔️ Sort') {
        color = '#fbbf24';
      } else {
        color = Game.localPlayer?.team !== undefined
          ? Config.TEAM_COLORS[Game.localPlayer.team]
          : "#93c5fd";
      }
      chat.innerHTML += `<div class="mb-1"><span class="font-bold" style="color:${color}">${name}:</span> ${msg}</div>`;
      chat.scrollTop = chat.scrollHeight;
    }
  },
  triggerScreenShake(intensity) {
    Game.shakeUntil = Date.now() + 500;
    Game.shakeIntensity = 5;
  },
};
