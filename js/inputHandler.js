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
    document
      .getElementById("chat-input")
      .addEventListener("keydown", this.handleChat.bind(this));

    document.getElementById("gameCanvas").addEventListener("click", () => {
      if (Game.state === "waiting" && Game.localPlayer) {
        const newReadyState = !Game.localPlayer.isReady;
        FirebaseController.updatePlayerDoc(
          FirebaseController.auth.currentUser.uid,
          {
            isReady: newReadyState,
            lastActive: Date.now(),
          }
        );
      } else if (
        Game.state === "playing" &&
        Game.localPlayer?.isAlive &&
        UI.selectedSpellIndex !== null
      ) {
        GameLogic.castSpecificSpell(Game.localPlayer, UI.selectedSpellIndex);
        UI.selectedSpellIndex = null;
        UI.updatePlayerStats();
      }
    });

    document.getElementById("opponents-grid").addEventListener("click", (e) => {
      if (
        Game.state === "playing" &&
        Game.localPlayer?.isAlive &&
        UI.selectedSpellIndex !== null
      ) {
        const opponentView = e.target.closest(".opponent-view");
        if (
          opponentView &&
          !opponentView.classList.contains("empty-slot") &&
          opponentView.id !== "spell-announcement"
        ) {
          const targetPlayerId = opponentView.id.replace("opponent-", "");
          const targetPlayer = Game.players.get(targetPlayerId);
          if (targetPlayer) {
            GameLogic.castSpecificSpell(targetPlayer, UI.selectedSpellIndex);
            UI.selectedSpellIndex = null;
            UI.updatePlayerStats();
          }
        }
      }
    });
  },
  handleKeyDown(e) {
    if (document.activeElement === document.getElementById("chat-input"))
      return;

    if (e.key === "ArrowLeft") Game.keys.left = true;
    if (e.key === "ArrowRight") Game.keys.right = true;

    if (Game.state !== "playing" || !Game.localPlayer?.isAlive) return;

    if (e.key === "ArrowUp") {
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
      Game.state !== "playing" ||
      UI.selectedSpellIndex !== null
    )
      return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;
    const rect = mainCanvas.getBoundingClientRect();
    // On ajuste les coordonnées de la souris pour qu'elles soient relatives au canvas lui-même
    const mouseX = e.clientX - rect.left,
      mouseY = e.clientY - rect.top;

    // --- CORRECTION : Le point de pivot du canon est maintenant en bas du canvas ---
    const launcherY = mainCanvas.height;

    Game.localPlayer.launcher.angle = Math.atan2(
      mouseY - launcherY,
      mouseX - mainCanvas.width / 2
    );
  },
  handleShoot() {
    const p = Game.localPlayer;
    if (
      Game.state !== "playing" ||
      !p?.isAlive ||
      !p.launcherBubble ||
      p.shotBubble ||
      UI.selectedSpellIndex !== null
    )
      return;

    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    p.shotBubble = p.launcherBubble;
    p.launcherBubble = null;
    const speed = Game.bubbleRadius * 1.2;
    p.shotBubble.isStatic = false;
    p.shotBubble.vx = Math.cos(p.launcher.angle) * speed;
    p.shotBubble.vy = Math.sin(p.launcher.angle) * speed;

    // --- CORRECTION : Le point de départ de la bulle correspond à sa position dessinée ---
    const launcherBubbleY = mainCanvas.height - Game.bubbleRadius * 2;
    p.shotBubble.x = mainCanvas.width / 2;
    p.shotBubble.y = launcherBubbleY;

    FirebaseController.updatePlayerDoc(p.id, { lastActive: Date.now() });

    GameLogic.loadBubbles(p);
  },
  handleChat(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (e.key === "Enter") {
      const input = e.target;
      const message = input.value.trim();
      if (!message || !Game.localPlayer) return;

      FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
        lastActive: Date.now(),
      });

      if (message.startsWith("/canon ")) {
        const parts = message.split(" ");
        if (parts.length === 2) {
          const speedValue = parseFloat(parts[1]);
          if (!isNaN(speedValue) && speedValue >= 1 && speedValue <= 10) {
            Game.currentRotationSpeed =
              Config.LAUNCHER_ROTATION_SPEED * (speedValue / 5);
            this.showLocalSystemMessage(
              `Vitesse du canon réglée sur ${speedValue}.`
            );
          } else {
            this.showLocalSystemMessage(
              "Erreur : utilisez /canon [un nombre entre 1 et 10]."
            );
          }
        }
        input.value = "";
        return;
      }

      UI.addChatMessage(Game.localPlayer.name, message);
      input.value = "";
    }
  },
  showLocalSystemMessage(msg) {
    const chat = document.getElementById("chat-messages");
    if (chat) {
      chat.innerHTML += `<p><em class="text-gray-400">${msg}</em></p>`;
      chat.scrollTop = chat.scrollHeight;
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
