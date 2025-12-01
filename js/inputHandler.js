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

    // Clic principal
    document.getElementById("gameCanvas").addEventListener("click", (e) => {
      const p = Game.localPlayer;
      if (!p) return;

      if (Game.state === "waiting") {
        const newReadyState = !p.isReady;
        FirebaseController.updatePlayerDoc(p.id, {
          isReady: newReadyState,
          lastActive: Date.now(),
        });
      } else if (Game.state === "playing" && p.isAlive) {
        // Tir avec la souris au clic (optionnel, sinon flèche haut)
        this.handleShoot();
      }
    });

    // Clic adversaires (pour lancer des sorts plus tard)
    document.getElementById("opponents-grid").addEventListener("click", (e) => {
      // Logique sorts à venir
    });
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

    // CORRECTION : On utilise la position réelle du canon définie par Drawing
    // Si pas encore définie (premier frame), on prend une valeur par défaut
    const launcherX = Game.cannonPosition
      ? Game.cannonPosition.x
      : mainCanvas.width / 2;
    const launcherY = Game.cannonPosition
      ? Game.cannonPosition.y
      : mainCanvas.height - 50;

    // Calcul de l'angle
    // atan2(dy, dx)
    // On veut que -PI/2 soit "Haut".
    let angle = Math.atan2(mouseY - launcherY, mouseX - launcherX);

    // On limite l'angle pour ne pas tirer vers le bas ou trop plat
    // Plage acceptée : de -PI (gauche) à 0 (droite), mais on restreint un peu
    // ex: -3.0 (gauche max) à -0.1 (droite max)
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
    if (!mainCanvas) return;

    // Transfert de la bulle lanceur vers la bulle tirée
    p.shotBubble = p.launcherBubble;
    p.launcherBubble = null;

    const speed = Game.bubbleRadius * 1.5; // Vitesse de tir
    p.shotBubble.isStatic = false;

    // Calcul Vecteur Vitesse
    // Utilise l'angle actuel du lanceur
    p.shotBubble.vx = Math.cos(p.launcher.angle) * speed;
    p.shotBubble.vy = Math.sin(p.launcher.angle) * speed;

    // Position de départ : Celle du canon
    p.shotBubble.x = Game.cannonPosition
      ? Game.cannonPosition.x
      : mainCanvas.width / 2;
    p.shotBubble.y = Game.cannonPosition
      ? Game.cannonPosition.y
      : mainCanvas.height - 50;

    FirebaseController.updatePlayerDoc(p.id, { lastActive: Date.now() });

    // Recharger la prochaine bulle tout de suite (visuel)
    GameLogic.loadBubbles(p);
  },

  handleChat(e) {
    if (e.key === "Enter") {
      const input = e.target;
      const msg = input.value.trim();
      if (msg && Game.localPlayer) {
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
