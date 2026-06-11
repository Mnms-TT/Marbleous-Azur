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

    // Préserver le slot d'annonces : renderOpponents est rappelé à chaque
    // snapshot Firestore et détruisait l'animation d'annonce en cours
    const existingAnn = document.getElementById("spell-announcement");
    grid.innerHTML = "";

    const opponents = Array.from(Game.players.values()).filter(
      (p) => p.id !== FirebaseController.auth?.currentUser?.uid
    );

    // 5×2 grid = 10 slots: 9 opponent + 1 announcement (at position 6)
    let oppIndex = 0;
    for (let i = 0; i < 10; i++) {
      if (i === 5) {
        // Position 6 (2nd row, 1st col == index 5) = announcement slot
        if (existingAnn) {
          grid.appendChild(existingAnn);
        } else {
          const ann = document.createElement("div");
          ann.id = "spell-announcement";
          ann.innerHTML = `<span>Annonces</span>`;
          grid.appendChild(ann);
        }
      } else {
        const p = opponents[oppIndex];
        const slot = p ? p.container : this.createEmptySlot();
        // L'id doit être sur le conteneur .opponent-view : c'est lui que
        // InputHandler retrouve via closest() pour lancer un sort au clic
        if (p) {
          p.container.dataset.playerId = p.id;
          p.canvas.dataset.playerId = p.id;
        }
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

  showAnnouncement(message, duration = 3000) {
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
    const spellSlots = document.querySelectorAll("#spells-bar .spell-slot");
    if (!spellSlots.length || !Game.localPlayer) return;

    const spells = Game.localPlayer.spells || [];
    const numSlots = spellSlots.length; // 8

    spellSlots.forEach((slot, i) => {
      slot.innerHTML = "";
      slot.className = "spell-slot";
      slot.style.backgroundColor = "transparent";
      slot.style.border = "";
      slot.style.boxShadow = "";

      // Les sorts remplissent de droite à gauche. Avec 7 slots, slot 6 (i=6) est tout à droite.
      // C'est le LIFO : le sort qu'on lancera est spells[spells.length - 1] (le dernier ajouté).
      // On veut que le sort à lancer apparaisse tout à droite (i=numSlots - 1).
      const spellIndex = spells.length - numSlots + i;

      // Le slot tout à droite (i = 6 pour 7 slots) est TOUJOURS le slot actif avec la bordure
      if (i === numSlots - 1) {
        slot.style.border = "2px solid white";
        slot.style.borderRadius = "4px";
      }

      if (spellIndex >= 0 && spellIndex < spells.length) {
        const spellName = spells[spellIndex];
        const spellInfo = Config.SPELLS[spellName];
        if (spellInfo) {
          slot.classList.add("has-spell");

          if (spellIndex === spells.length - 1) {
            slot.classList.add("active-spell");
          }

          // Render glossy 3D bubble using a small canvas inside the slot
          const canvas = document.createElement("canvas");
          const size = slot.clientWidth || 34; // La boule remplit le conteneur
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");

          let bubbleColorObj = Config.BUBBLE_COLORS[0];
          for (const [hex, spell] of Object.entries(Config.COLOR_TO_SPELL_MAP)) {
            if (spell === spellName) {
              bubbleColorObj = Config.BUBBLE_COLORS.find(c => c.main === hex) || bubbleColorObj;
              break;
            }
          }

          // Agrandir légèrement la boule pour qu'elle touche presque les bords du frame
          const radius = size / 2 * 0.95;
          const dummyBubble = {
            color: bubbleColorObj,
            isSpellBubble: true,
            spell: spellName
          };
          Drawing.drawBubble(ctx, dummyBubble, radius, size / 2, size / 2);

          slot.appendChild(canvas);
        }
      }
    });
  },

  // --- ANNONCES DE SORTS ANIMÉES ---
  // Lanceur en haut, receveur en bas, la boule du sort descend doucement
  // de l'un vers l'autre en ~3s. File d'attente (max 5) si plusieurs sorts.
  spellAnnounceQueue: [],
  spellAnnouncePlaying: false,
  currentAnnounceTimer: null,
  currentAnnounceAnim: null,

  queueSpellAnnouncement(casterName, spellKey, targetName) {
    if (this.spellAnnounceQueue.length >= 5) this.spellAnnounceQueue.shift();
    this.spellAnnounceQueue.push({ casterName, spellKey, targetName });
    if (!this.spellAnnouncePlaying) {
      this.playNextSpellAnnouncement();
    } else {
      // Un nouveau sort arrive : l'annonce en cours est expédiée (0,3s max)
      // pour rester à jour — seule la dernière de la file durera 2,5s
      this.fastForwardCurrentAnnouncement();
    }
  },

  fastForwardCurrentAnnouncement() {
    if (this.currentAnnounceTimer) clearTimeout(this.currentAnnounceTimer);
    if (this.currentAnnounceAnim) {
      try { this.currentAnnounceAnim.playbackRate = 9; } catch (e) { /* ignore */ }
    }
    this.currentAnnounceTimer = setTimeout(() => this.playNextSpellAnnouncement(), 300);
  },

  playNextSpellAnnouncement() {
    const slot = document.getElementById("spell-announcement");
    const next = this.spellAnnounceQueue.shift();

    if (!next || !slot) {
      this.spellAnnouncePlaying = false;
      // Retour à l'affichage normal
      if (slot) {
        if (Game.state === "playing") {
          slot.innerHTML = "<span class='text-white font-bold text-xs'>Annonces</span>";
        } else {
          this.checkVoteStatus();
        }
      }
      return;
    }

    this.spellAnnouncePlaying = true;

    slot.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:rgba(0,0,0,0.85);overflow:hidden;">
        <div style="position:absolute;top:3px;width:100%;text-align:center;font-size:11px;font-weight:bold;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(next.casterName)}</div>
        <div class="spell-fly" style="position:absolute;left:50%;transform:translateX(-50%);top:18px;"></div>
        <div style="position:absolute;bottom:3px;width:100%;text-align:center;font-size:11px;font-weight:bold;color:#fbbf24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(next.targetName)}</div>
      </div>`;

    // Boule du sort — même rendu que dans le jeu
    const holder = slot.querySelector(".spell-fly");
    const size = 34;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    let colorObj = Config.BUBBLE_COLORS[0];
    for (const [hex, sp] of Object.entries(Config.COLOR_TO_SPELL_MAP)) {
      if (sp === next.spellKey) {
        colorObj = Config.BUBBLE_COLORS.find(c => c.main === hex) || colorObj;
        break;
      }
    }
    Drawing.drawBubble(
      canvas.getContext("2d"),
      { color: colorObj, isSpellBubble: true, spell: next.spellKey },
      (size / 2) * 0.95, size / 2, size / 2
    );
    holder.appendChild(canvas);

    // Descente en 4 étapes glissées (haut → milieu-haut → milieu-bas → bas).
    // 2,5s pour la dernière annonce ; 0,3s en accéléré s'il en reste derrière,
    // pour que l'affichage reste à jour.
    const DUREE = this.spellAnnounceQueue.length > 0 ? 300 : 2500;
    const slotH = slot.clientHeight || 120;
    const pTop = 18;
    const pBottom = Math.max(24, slotH - size - 18);
    const p1 = pTop + (pBottom - pTop) / 3;
    const p2 = pTop + (2 * (pBottom - pTop)) / 3;

    this.currentAnnounceAnim = holder.animate(
      [
        { top: pTop + "px", offset: 0, easing: "ease-in-out" },
        { top: pTop + "px", offset: 0.16, easing: "ease-in-out" },
        { top: p1 + "px", offset: 0.28, easing: "ease-in-out" },
        { top: p1 + "px", offset: 0.44, easing: "ease-in-out" },
        { top: p2 + "px", offset: 0.56, easing: "ease-in-out" },
        { top: p2 + "px", offset: 0.72, easing: "ease-in-out" },
        { top: pBottom + "px", offset: 0.84, easing: "ease-in-out" },
        { top: pBottom + "px", offset: 1 }
      ],
      { duration: DUREE, fill: "forwards" }
    );

    if (this.currentAnnounceTimer) clearTimeout(this.currentAnnounceTimer);
    this.currentAnnounceTimer = setTimeout(() => this.playNextSpellAnnouncement(), DUREE);
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
  // Chat : messages réseau (Firestore) + messages système locaux, fusionnés par date
  remoteChat: [],
  localChat: [],

  addChatMessage(name, msg) {
    this.localChat.push({ author: name, text: msg, ts: Date.now(), local: true });
    if (this.localChat.length > 50) this.localChat.shift();
    this.renderChat();
  },

  escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  renderChat() {
    const chat = document.getElementById("chat-messages");
    if (!chat) return;

    const all = [...this.remoteChat, ...this.localChat].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    chat.innerHTML = all.map(m => {
      // Messages système locaux (annonces, /fps, /canon...) en doré
      if (m.local) {
        return `<div class="msg"><span style="color:#fbbf24;font-weight:bold">${this.escapeHtml(m.author)}:</span> ${this.escapeHtml(m.text)}</div>`;
      }
      const isDM = !!m.toUid;
      const color = (m.team !== null && m.team !== undefined)
        ? (Config.TEAM_COLORS[m.team] || "#93c5fd")
        : "#93c5fd";
      const prefix = isDM ? `<span style="color:#c084fc">[MP${m.toName ? ' à ' + this.escapeHtml(m.toName) : ''}]</span> ` : '';
      const style = isDM ? 'color:#a855f7;font-style:italic' : '';
      return `<div class="msg" style="${style}"><span style="color:${color};font-weight:bold">${this.escapeHtml(m.author)}:</span> ${prefix}${this.escapeHtml(m.text)}</div>`;
    }).join('');

    chat.scrollTop = chat.scrollHeight;
  },
  triggerScreenShake(intensity) {
    Game.shakeUntil = Date.now() + 500;
    Game.shakeIntensity = 5;
  },
};
