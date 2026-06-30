import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { FirebaseController } from "./firebaseController.js";
import { UI } from "./ui.js";
import { Config } from "./config.js";
import { BotManager } from "./bots.js";

export const InputHandler = {
  initialized: false,
  init() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
    // Visée aux flèches uniquement : pas de mousemove
    window.addEventListener("resize", UI.resizeAllCanvases);
    window.addEventListener("beforeunload", this.handleBeforeUnload.bind(this));

    const chatInput = document.getElementById("chat-input");
    if (chatInput)
      chatInput.addEventListener("keydown", this.handleChat.bind(this));

    // CLIC PRINCIPAL (Jeu ou Prêt ou Lancer sort)
    const canvas = document.getElementById("gameCanvas");
    if (canvas) {
      // Clic = Se mettre prêt OU Lancer le sort sur soi
      canvas.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = Game.localPlayer;
        if (!p) return;

        // Si en attente : Clic = Je suis prêt
        if (Game.state === "waiting") {
          const newReadyState = !p.isReady;
          p.isReady = newReadyState;

          FirebaseController.updatePlayerDoc(p.id, {
            isReady: newReadyState,
            lastActive: Date.now(),
          });
        }
        // Si en jeu : Clic = Lancer le sort sur soi-même (FIFO : le plus ancien)
        else if (Game.state === "playing" && p.isAlive) {
          if (p.spells && p.spells.length > 0) {
            GameLogic.castSpecificSpell(p, 0);
          }
        }
      });
    }

    // Clic Grille Adversaires (Pour lancer des sorts)
    const oppGrid = document.getElementById("opponents-grid");
    if (oppGrid) {
      oppGrid.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = Game.localPlayer;
        if (!p) return;

        // On cherche si on a cliqué sur une vue adversaire (pas l'annonce)
        const view = e.target.closest(".opponent-view");
        if (!view || !view.dataset.playerId || view.id === "spell-announcement") return;

        const targetPlayer = Game.players.get(view.dataset.playerId);
        if (!targetPlayer) return;

        // En jeu, vivant, avec un sort en main → on LANCE le sort (FIFO : le plus ancien)
        const peutLancer =
          Game.state === "playing" && p.isAlive && p.spells && p.spells.length > 0;

        if (peutLancer) {
          GameLogic.castSpecificSpell(targetPlayer, 0);
        } else {
          // Sinon (pas de sort, partie finie, mort...) → pré-remplir un MP
          const input = document.getElementById("chat-input");
          if (input) {
            input.value = `/${targetPlayer.name} `;
            input.focus();
          }
        }
      });
    }
  },

  handleKeyDown(e) {
    // Si on est en train d'ÉCRIRE un message (champ chat focalisé ET non vide),
    // on laisse le chat gérer les touches. Mais si le champ est focalisé mais
    // VIDE (ex: juste après avoir envoyé un message), les flèches/Espace
    // contrôlent quand même le canon → plus besoin de recliquer pour rejouer.
    const chatInput = document.getElementById("chat-input");
    const chatFocused = document.activeElement === chatInput;
    if (chatFocused && chatInput && chatInput.value !== "") return;

    if (e.key === "ArrowLeft") { Game.keys.left = true; if (chatFocused) e.preventDefault(); }
    if (e.key === "ArrowRight") { Game.keys.right = true; if (chatFocused) e.preventDefault(); }

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

  handleShoot() {
    GameLogic.shoot(Game.localPlayer);
  },

  handleChat(e) {
    if (e.key === "Enter") {
      const input = e.target;
      // On NE blur PAS : le focus reste dans le chat pour pouvoir enchaîner les
      // messages sans recliquer. Le canon répond quand même aux flèches/Espace
      // tant que le champ est vide (géré dans handleKeyDown).
      const msg = input.value.trim();
      if (msg && Game.localPlayer) {
        if (msg.startsWith("/canon ")) {
          const parts = msg.split(" ");
          if (parts.length === 2) {
            const val = parseFloat(parts[1]);
            if (!isNaN(val)) {
              Game.currentRotationSpeed =
                Config.LAUNCHER_ROTATION_SPEED * (val / 5);
              // Sauvegardé : conservé d'une salle à l'autre
              try { localStorage.setItem("marbleous_canon", String(val)); } catch (e) { /* ignore */ }
              UI.addChatMessage("Système", `Vitesse canon: ${val}`);
            }
          }
          input.value = "";
          return;
        }

        // Commande /fps pour régler les FPS (30-300)
        if (msg.toLowerCase().startsWith("/fps ")) {
          const parts = msg.split(" ");
          if (parts.length === 2) {
            const val = parseInt(parts[1]);
            if (!isNaN(val) && val >= 30 && val <= 300) {
              Game.targetFPS = val;
              // Sauvegardé : conservé d'une salle à l'autre
              try { localStorage.setItem("marbleous_fps", String(val)); } catch (e) { /* ignore */ }
              UI.addChatMessage("Système", `FPS réglés à ${val}`);
            } else {
              UI.addChatMessage("Système", "FPS doit être entre 30 et 300");
            }
          }
          input.value = "";
          return;
        }

        // Commande /bot x : ajoute/retire des bots (0-8)
        if (msg.toLowerCase().startsWith("/bot")) {
          const parts = msg.split(" ");
          const n = parseInt(parts[1]);
          if (isNaN(n) || n < 0 || n > 8) {
            UI.addChatMessage("Système", "Usage : /bot x (0 à 8 bots)");
          } else {
            BotManager.setCount(n);
          }
          input.value = "";
          return;
        }

        // MP : /pseudo message → visible uniquement par le destinataire
        if (msg.startsWith("/")) {
          const spaceIndex = msg.indexOf(" ");
          if (spaceIndex > 1) {
            const targetPseudo = msg.substring(1, spaceIndex);
            const messageText = msg.substring(spaceIndex + 1).trim();
            const target = Array.from(Game.players.values()).find(
              (p) =>
                p.id !== Game.localPlayer.id &&
                (p.name || "").toLowerCase() === targetPseudo.toLowerCase()
            );
            if (target && messageText) {
              FirebaseController.sendChatMessage(messageText, target.id, target.name);
            } else {
              UI.addChatMessage("Système", `Joueur "${targetPseudo}" introuvable dans la salle.`);
            }
            input.value = "";
            return;
          }
        }

        // Message public : envoyé à toute la salle via Firestore
        FirebaseController.sendChatMessage(msg);
        input.value = "";
      }
    }
  },

  handleBeforeUnload() {
    // Les bots partent avec leur hôte
    BotManager.removeAll();
    if (FirebaseController.auth.currentUser) {
      FirebaseController.deletePlayerDoc(
        FirebaseController.auth.currentUser.uid
      );
    }
  },
};
