import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { GameLogic } from "./gameLogic.js";
import { Drawing } from "./drawing.js";

export const UI = {
  announcementTimeout: null,
  roomRefreshPending: false,

  // Anti-lag : les snapshots RTDB arrivent en continu avec plusieurs joueurs ;
  // reconstruire le DOM des adversaires + resize + barre de sorts à chaque
  // événement écroule les performances. On regroupe tout (max ~5 fois/s).
  scheduleRoomRefresh() {
    if (this.roomRefreshPending) return;
    this.roomRefreshPending = true;
    setTimeout(() => {
      this.roomRefreshPending = false;
      this.renderOpponents();
      this.updatePlayerStats();
      this.checkVoteStatus();
      this.resizeAllCanvases();
    }, 200);
  },

  renderOpponents() {
    const grid = document.getElementById("opponents-grid");
    if (!grid) return;

    // Miniatures : uniquement les JOUEURS (pas les spectateurs), sauf soi.
    // Pour un spectateur, on exclut aussi le 1er joueur (affiché sur l'écran
    // principal) → on voit bien les 10 joueurs (9 ici + 1 à gauche).
    const myUid = FirebaseController.auth?.currentUser?.uid;
    const spectating = Game.state === "spectating" && Game.localPlayer?.isSpectator;
    const mainP = spectating ? Game.firstActivePlayer() : null;
    const opponents = Array.from(Game.players.values()).filter(
      (p) => !p.isSpectator && p.id !== myUid && p.id !== mainP?.id
    );

    // On ne reconstruit le DOM QUE si la composition des adversaires a changé.
    // Reconstruire à chaque snapshot (5×/s) volait les clics : si une
    // reconstruction tombait entre le mousedown et le mouseup, le navigateur
    // annulait le clic → le sort ne partait pas. Les scores/grilles sont
    // dessinés sur les canvas à chaque frame, le DOM n'a pas à bouger.
    const sig = opponents.map((p) => p.id).join(",");
    if (sig === this._lastOppSig && document.getElementById("spell-announcement")) {
      const countDisplay = document.getElementById("player-count-display");
      if (countDisplay) {
        countDisplay.textContent = `${Game.players.size} joueur${Game.players.size > 1 ? "s" : ""}`;
      }
      return;
    }
    this._lastOppSig = sig;

    // Préserver le slot d'annonces : il porte l'animation/le vote en cours
    const existingAnn = document.getElementById("spell-announcement");
    grid.innerHTML = "";

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
          ann.innerHTML = "";
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
    const slot = document.getElementById("spell-announcement");

    // Spectateur : il ne compte pas dans le vote, on lui propose de revenir
    if (Game.localPlayer.isSpectator) {
      this.renderSpectatorPanel();
      return;
    }

    // Seuls les JOUEURS (non spectateurs) comptent dans le vote
    const players = Array.from(Game.players.values()).filter((p) => !p.isSpectator);
    const ready = players.filter((p) => p.isReady).length;
    const total = players.length;
    // Majorité simple : plus de la moitié suffit (3 joueurs → 2 prêts, 5 → 3)
    const required = total <= 1 ? 1 : Math.floor(total / 2) + 1;

    if (!Game.localPlayer.isReady) {
      this.renderTeamSelectionInAnnouncementBox();
    } else {
      if (slot)
        slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;background:#15803d;"><span style="color:white;font-weight:bold;font-size:12px;">PRÊT ${ready}/${total}</span></div>`;
    }

    // L'hôte est le premier joueur HUMAIN non spectateur
    const hostId = Array.from(Game.players.values())
      .filter((p) => !p.id.startsWith("bot_") && !p.isSpectator)
      .map((p) => p.id)[0];
    if (total > 0 && ready >= required && Game.localPlayer.id === hostId) {
      FirebaseController.updateSessionDoc({ gameState: "countdown" });
    }
  },

  // Panneau affiché quand on est spectateur : bouton pour revenir en jeu
  renderSpectatorPanel() {
    const slot = document.getElementById("spell-announcement");
    if (!slot) return;
    slot.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  width:100%;height:100%;background:#374151;gap:6px;text-align:center;">
        <span style="color:#fff;font-size:11px;font-weight:bold;">👁️ Spectateur</span>
        <button onclick="window.handleRejoinFromSpectator()"
          style="background:#22c55e;border:2px solid #4ade80;color:#fff;font-size:11px;
                 font-weight:bold;padding:4px 10px;border-radius:5px;cursor:pointer;">
          Revenir en jeu
        </button>
      </div>`;

    window.handleRejoinFromSpectator = () => {
      // Refuser si la salle est déjà pleine de 10 joueurs actifs
      const activePlayers = Array.from(Game.players.values())
        .filter((p) => !p.isSpectator).length;
      if (activePlayers >= 10) {
        UI.addChatMessage("Système", "Salle pleine (10 joueurs), impossible de revenir pour l'instant.");
        return;
      }
      Game.localPlayer.isSpectator = false;
      Game.localPlayer.isAlive = true;
      Game.pausedSpectator = false;
      Game.state = "waiting";
      FirebaseController.updatePlayerDoc(FirebaseController.auth.currentUser.uid, {
        isSpectator: false, isAlive: true, isReady: false, lastActive: Date.now(),
      });
    };
  },

  renderTeamSelectionInAnnouncementBox() {
    const slot = document.getElementById("spell-announcement");
    if (!slot || !Game.localPlayer) return;

    const currentTeam = Game.localPlayer.team || 0;
    const teamNames = ['Jaune', 'Rouge', 'Vert', 'Bleu', 'Rose'];

    const otherTeams = Config.TEAM_COLORS
      .map((c, i) => ({ color: c, index: i, name: teamNames[i] }))
      .filter(t => t.index !== currentTeam);

    // 2×2 grid des équipes + bouton gris central "Spectateur" (mise en pause)
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
        <button onclick="window.handleSpectate()" title="Devenir spectateur (pause)"
          style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                 width:34px; height:34px; border-radius:50%; background:#9ca3af;
                 border:2px solid #fff; cursor:pointer; box-shadow:inset 0 -3px 5px rgba(0,0,0,0.3);
                 display:flex; align-items:center; justify-content:center; font-size:13px;">👁️</button>
    </div>`;

    window.handleTeamChange = (i) =>
      FirebaseController.updatePlayerDoc(
        FirebaseController.auth.currentUser.uid,
        { team: i, lastActive: Date.now() }
      );

    // Bouton gris : passer spectateur → libère une place de joueur
    window.handleSpectate = () => {
      Game.localPlayer.isSpectator = true;
      Game.localPlayer.isAlive = false;
      Game.localPlayer.isReady = false;
      Game.pausedSpectator = true;
      Game.state = "spectating";
      FirebaseController.updatePlayerDoc(FirebaseController.auth.currentUser.uid, {
        isSpectator: true, isAlive: false, isReady: false, lastActive: Date.now(),
      });
      UI.addChatMessage("Système", "Vous êtes spectateur. Cliquez sur « Revenir en jeu » pour rejouer.");
      UI.renderSpectatorPanel();
    };
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

        // Hôte = premier joueur HUMAIN (jamais un bot)
        const hostId = Array.from(Game.players.keys())
          .filter(id => !id.startsWith("bot_"))
          .sort()[0];
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
        "";
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
        slot.innerHTML = "";
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

      // FIFO mais aligné à DROITE : le sort actif (le plus ancien, spells[0])
      // reste tout à droite ; les sorts plus récents s'empilent vers la gauche,
      // de plus en plus loin.
      const spellIndex = (numSlots - 1) - i;

      // Le slot tout à droite est TOUJOURS le slot actif avec la bordure
      if (i === numSlots - 1) {
        slot.style.border = "2px solid white";
        slot.style.borderRadius = "4px";
      }

      if (spellIndex >= 0 && spellIndex < spells.length) {
        const spellName = spells[spellIndex];
        const spellInfo = Config.SPELLS[spellName];
        if (spellInfo) {
          slot.classList.add("has-spell");

          if (spellIndex === 0) {
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

  // Délai d'enchaînement entre deux annonces (quand il y a une file).
  // Dépend des fps (jeu plus rapide → enchaînement plus serré) mais jamais
  // instantané : on garde toujours le temps de VOIR chaque bandeau.
  announceChainMs() {
    const fps = Game.targetFPS || Config.DEFAULT_GAME_FPS || 140;
    return Math.round(Math.min(1400, Math.max(700, 120000 / fps)));
  },

  queueSpellAnnouncement(casterName, spellKey, targetName) {
    if (this.spellAnnounceQueue.length >= 8) this.spellAnnounceQueue.shift();
    this.spellAnnounceQueue.push({ casterName, spellKey, targetName });
    if (!this.spellAnnouncePlaying) {
      this.playNextSpellAnnouncement();
    } else {
      // Un nouveau sort attend : l'annonce en cours passe à la cadence
      // d'enchaînement (visible, pas instantanée) pour ne pas bloquer la file.
      this.chainCurrentAnnouncement();
    }
  },

  chainCurrentAnnouncement() {
    if (this.currentAnnounceTimer) clearTimeout(this.currentAnnounceTimer);
    const chain = this.announceChainMs();
    if (this.currentAnnounceAnim) {
      // Accélère l'animation pour qu'elle se termine pile dans le délai
      try { this.currentAnnounceAnim.playbackRate = Math.max(1, 2500 / chain); } catch (e) { /* ignore */ }
    }
    this.currentAnnounceTimer = setTimeout(() => this.playNextSpellAnnouncement(), chain);
  },

  playNextSpellAnnouncement() {
    const slot = document.getElementById("spell-announcement");
    const next = this.spellAnnounceQueue.shift();

    if (!next || !slot) {
      this.spellAnnouncePlaying = false;
      // Retour à l'affichage normal
      if (slot) {
        if (Game.state === "playing") {
          slot.innerHTML = "";
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
    // 2,5s pour la dernière annonce ; cadence d'enchaînement (visible, liée aux
    // fps) tant qu'il en reste derrière → les sorts défilent un par un, dans
    // l'ordre, sans être instantanés.
    const DUREE = this.spellAnnounceQueue.length > 0 ? this.announceChainMs() : 2500;
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

    // Amplitude dynamique basée sur l'intensité (secousse un peu plus forte)
    const amplitude = Math.min(intensity * 4.2, 40); // Max 40px

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

    // Appliquer l'animation : les répétitions couvrent TOUTE la durée demandée
    // (avant, le nombre d'itérations était calculé sur 300ms fixes : la secousse
    // s'arrêtait bien avant la fin, d'où l'impression de tremblement trop court)
    const animDur = Math.min(300, 100 + intensity * 20);
    const iterations = Math.max(1, Math.ceil(duration / animDur));
    canvas.style.animation = 'none';
    canvas.offsetHeight; // Force reflow
    canvas.style.animation = `${keyframeName} ${animDur}ms ease-in-out ${iterations}`;

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

      // Message privé : TOUT en rose (pseudo + préfixe + texte)
      if (isDM) {
        const prefix = `[MP${m.toName ? ' à ' + this.escapeHtml(m.toName) : ''}] `;
        return `<div class="msg" style="color:#ec4899;font-style:italic;">` +
          `<span style="font-weight:bold">${this.escapeHtml(m.author)}:</span> ${prefix}${this.escapeHtml(m.text)}</div>`;
      }

      // Message public : pseudo coloré selon l'équipe (gris si spectateur)
      const color = m.spectator
        ? "#9ca3af"
        : (m.team !== null && m.team !== undefined)
          ? (Config.TEAM_COLORS[m.team] || "#93c5fd")
          : "#93c5fd";
      return `<div class="msg"><span style="color:${color};font-weight:bold">${this.escapeHtml(m.author)}:</span> ${this.escapeHtml(m.text)}</div>`;
    }).join('');

    chat.scrollTop = chat.scrollHeight;
  },
  triggerScreenShake(intensity) {
    Game.shakeUntil = Date.now() + 500;
    Game.shakeIntensity = 5;
  },
};
