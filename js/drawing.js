import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { Config } from "./config.js";

export const Drawing = {
  drawAll() {
    if (!Game.localPlayer) return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;
    this.drawPlayer(Game.localPlayer, mainCanvas.getContext("2d"), true);
    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer.id && p.canvas)
        this.drawPlayer(p, p.ctx, false);
    });
  },

  drawPlayer(player, ctx, isMain) {
    const canvas = ctx.canvas;
    if (!canvas || canvas.width === 0 || !player) return;

    // 1. Fond
    ctx.fillStyle = isMain ? "#1e293b" : "#475569"; // Bleu nuit pour fond de jeu
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculs de dimensions
    const rad = isMain ? Game.bubbleRadius : (canvas.width / 17) * 0.95;

    // La ligne de mort est JUSTE après la dernière rangée jouable (row 11)
    // Coordonnée Y de la rangée 11 + un peu de marge
    const lastRowY = GameLogic.getBubbleCoords(Config.GAME_OVER_ROW, 0, rad).y;
    const deadLineY = lastRowY + rad;

    // 2. Dessin du Dashboard (Le bas de l'écran)
    // On dessine le fond du dashboard (zone morte)
    ctx.fillStyle = "#991b1b"; // Rouge sombre
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // Le demi-cercle décoratif
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height, canvas.width * 0.6, Math.PI, 0);
    ctx.fillStyle = "#b91c1c"; // Rouge un peu plus clair
    ctx.fill();
    ctx.strokeStyle = "#7f1d1d";
    ctx.stroke();

    // 3. Ligne de Mort (DESSINÉE APRÈS LE FOND POUR ÊTRE VISIBLE)
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "#000000"; // NOIR
    ctx.lineWidth = 4; // ÉPAIS
    ctx.stroke();

    // 4. Boules (Grille)
    if (Game.state === "playing" || (isMain && Game.state === "countdown")) {
      // Grille statique
      for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
          if (player.grid[r][c]) {
            const { x, y } = GameLogic.getBubbleCoords(r, c, rad);
            this.drawBubble(ctx, player.grid[r][c], rad, x, y);
          }
        }
      }
      // Boules tombantes
      (player.fallingBubbles || []).forEach((b) =>
        this.drawBubble(ctx, b, rad, b.x, b.y)
      );
      // Effets
      (player.effects || []).forEach((e) => this.drawEffect(ctx, e));
    }

    // 5. Canon et Tir (Uniquement pour le joueur principal)
    if (isMain && player.isAlive && Game.state === "playing") {
      // POSITION DU CANON : Fixée visuellement au milieu de la zone dashboard
      const cannonY = deadLineY + (canvas.height - deadLineY) / 2;

      // On sauvegarde cette position dans Game pour que InputHandler puisse l'utiliser !
      Game.cannonPosition = { x: canvas.width / 2, y: cannonY };

      // Aiguille
      this.drawCannonNeedle(ctx, player, Game.cannonPosition, deadLineY);

      // Bulle dans le canon (Launcher)
      if (player.launcherBubble) {
        this.drawBubble(
          ctx,
          player.launcherBubble,
          rad,
          Game.cannonPosition.x,
          Game.cannonPosition.y,
          true
        );
      }

      // Bulle suivante (Next)
      if (player.nextBubble) {
        const nextX = Game.cannonPosition.x - rad * 3;
        const nextY = Game.cannonPosition.y + rad;
        this.drawBubble(ctx, player.nextBubble, rad * 0.8, nextX, nextY);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "10px Arial";
        ctx.fillText("NEXT", nextX - 10, nextY - rad);
      }

      // Bulle tirée (Shot)
      if (player.shotBubble) {
        this.drawBubble(
          ctx,
          player.shotBubble,
          rad,
          player.shotBubble.x,
          player.shotBubble.y
        );
      }
    }

    // 6. Zone Sorts (Tout en bas)
    if (isMain) {
      const spellH = 40;
      const spellY = canvas.height - spellH;

      ctx.fillStyle = "#111827"; // Fond noir barre sorts
      ctx.fillRect(0, spellY, canvas.width, spellH);

      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("SORTILEGES", 10, spellY + 25);

      // Dessin des slots
      const startX = 100;
      const gap = 5;
      const size = spellH - 4;

      for (let i = 0; i < Config.MAX_SPELLS; i++) {
        const sx = startX + i * (size + gap);
        const sy = spellY + 2;

        // Cadre vide
        ctx.strokeStyle = "#4b5563";
        ctx.strokeRect(sx, sy, size, size);

        // Si on a un sort
        if (player.spells && player.spells[i]) {
          const spellName = player.spells[i];
          if (Config.SPELLS[spellName]) {
            const icon = Game.spellIcons[spellName];
            if (icon && icon.complete) {
              ctx.drawImage(icon, sx, sy, size, size);
            } else {
              // Fallback couleur si icone pas chargée
              ctx.fillStyle = Config.SPELLS[spellName].color;
              ctx.fillRect(sx + 2, sy + 2, size - 4, size - 4);
            }
          }
        }
      }
    }

    // Game Over Text
    if (!player.isAlive && Game.state === "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "bold 40px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PERDU", canvas.width / 2, canvas.height / 2);
    }

    // Lobby Text
    if (isMain && Game.state === "waiting") {
      this.drawLobbyAnimation(ctx, canvas);
    }
  },

  drawBubble(ctx, b, rad, x, y, isLauncher = false) {
    if (!b || !b.color) return;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = b.color.main;
    ctx.fill();

    // Effet reflet
    ctx.beginPath();
    ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill();

    // Sort
    if (b.isSpellBubble && b.spell && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon.complete) {
        ctx.drawImage(icon, x - rad, y - rad, rad * 2, rad * 2);
      }
    }
  },

  drawCannonNeedle(ctx, player, pos, limitY) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2); // Ajustement angle

    const len = pos.y - limitY - 10; // Longueur jusqu'à la ligne

    ctx.fillStyle = "#fbbf24"; // Aiguille or
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, -len);
    ctx.fill();

    ctx.restore();
  },

  drawEffect(ctx, e) {
    if (e.type === "pop") {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = e.color || "white";
      ctx.stroke();
    }
  },

  drawLobbyAnimation(ctx, canvas) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "20px Arial";
    ctx.fillText("En attente...", canvas.width / 2, canvas.height / 2);
  },
};
