import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { FirebaseController } from "./firebaseController.js";
import { UI } from "./ui.js";
import { Config } from "./config.js";

export const InputHandler = {
  init() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
    window.addEventListener("mousemove", this.handleMouseMove.bind(this));
    window.addEventListener("resize", UI.resizeAllCanvases);
    window.addEventListener("beforeunload", this.handleBeforeUnload.bind(this));

    const chatInput = document.getElementById("chat-input");
    if (chatInput)
      chatInput.addEventListener("keydown", this.handleChat.bind(this));

    // CLIC PRINCIPAL (Jeu ou Prêt)
    const canvas = document.getElementById("gameCanvas");
    if (canvas) {
      canvas.addEventListener("click", (e) => {
        const p = Game.localPlayer;
        if (!p) return;

        // Si en attente : Clic = Je suis prêt
        if (Game.state === "waiting") {
          const newReadyState = !p.isReady;
          // On met à jour l'objet local tout de suite pour réactivité immédiate
          p.isReady = newReadyState;

          FirebaseController.updatePlayerDoc(p.id, {
            isReady: newReadyState,
            lastActive: Date.now(),
          });

          // Petit son ou feedback visuel ici
          Drawing.drawAll();
        }
        // Si en jeu : Clic = Tirer
        else if (Game.state === "playing" && p.isAlive) {
          this.handleShoot();
        }
      });
    }

    // Clic Grille Adversaires (Pour lancer des sorts)
    const oppGrid = document.getElementById("opponents-grid");
    if (oppGrid) {
      oppGrid.addEventListener("click", (e) => {
        const p = Game.localPlayer;
        if (!p || Game.state !== "playing" || !p.isAlive) return;

        // On cherche si on a cliqué sur une vue adversaire
        const view = e.target.closest(".opponent-view");
        if (view && view.dataset.playerId) {
          const targetId = view.dataset.playerId;
          // Si on a des sorts, on lance le premier (FIFO)
          if (p.spells && p.spells.length > 0) {
            // Index 0 car FIFO
            const spellToCast = p.spells[0];
            GameLogic.castSpecificSpell(Game.players.get(targetId), 0);
          }
        }
      });
    }
  },

  handleKeyDown(e) {
    if (document.activeElement === document.getElementById("chat-input"))
      return;

    if (e.key === "ArrowLeft") Game.keys.left = true;
    if (e.key === "ArrowRight") Game.keys.right = true;

    if (Game.state !== "playing" || !Game.localPlayer?.isAlive) return;

    if (e.key === "ArrowUp" || e.code === "Space") {
      e.preventDefault();
      this.handleShoot();
    }
  },

  handleKeyUp(e) {
    if (e.key === "ArrowLeft") Game.keys.left = false;
    if (e.key === "ArrowRight") Game.keys.right = false;
  },

  handleMouseMove(e) {
    if (
      !Game.localPlayer?.isAlive ||
      Game.bubbleRadius === 0 ||
      Game.state !== "playing"
    )
      return;

    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    const rect = mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Utilise la position calculée par Drawing.js, sinon fallback centre/bas
    const cannonPos = Game.cannonPosition || {
      x: mainCanvas.width / 2,
      y: mainCanvas.height - 50,
    };

    let angle = Math.atan2(mouseY - cannonPos.y, mouseX - cannonPos.x);

    // Restrictions d'angle (ne pas tirer vers le bas)
    if (angle > -0.1) angle = -0.1;
    if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;

    Game.localPlayer.launcher.angle = angle;
  },

  handleShoot() {
    const p = Game.localPlayer;
    if (
      Game.state !== "playing" ||
      !p?.isAlive ||
      !p.launcherBubble ||
      p.shotBubble
    )
      return;

    const mainCanvas = document.getElementById("gameCanvas");

    p.shotBubble = p.launcherBubble;
    p.launcherBubble = null;

    const speed = Game.bubbleRadius * 1.5; // Vitesse rapide
    p.shotBubble.isStatic = false;
    p.shotBubble.vx = Math.cos(p.launcher.angle) * speed;
    p.shotBubble.vy = Math.sin(p.launcher.angle) * speed;

    // Départ du canon
    const startPos = Game.cannonPosition || {
      x: mainCanvas.width / 2,
      y: mainCanvas.height - 50,
    };
    p.shotBubble.x = startPos.x;
    p.shotBubble.y = startPos.y;

    FirebaseController.updatePlayerDoc(p.id, { lastActive: Date.now() });
    GameLogic.loadBubbles(p);
  },

  handleChat(e) {
    if (e.key === "Enter") {
      const input = e.target;
      const msg = input.value.trim();
      if (msg && Game.localPlayer) {
        if (msg.startsWith("/canon ")) {
          const parts = msg.split(" ");
          if (parts.length === 2) {
            const val = parseFloat(parts[1]);
            if (!isNaN(val)) {
              Game.currentRotationSpeed =
                Config.LAUNCHER_ROTATION_SPEED * (val / 5);
              UI.addChatMessage("Système", `Vitesse canon: ${val}`);
            }
          }
          input.value = "";
          return;
        }
        UI.addChatMessage(Game.localPlayer.name, msg);
        input.value = "";
      }
    }
  },

  handleBeforeUnload() {
    if (FirebaseController.auth.currentUser) {
      FirebaseController.deletePlayerDoc(
        FirebaseController.auth.currentUser.uid
      );
    }
  },
};
