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

    const rad = isMain ? Game.bubbleRadius : (canvas.width / 17) * 0.95;
    if (!rad || rad < 1) return;

    // FOND DAMIER
    const tileSize = canvas.width / 8;
    const rows = Math.ceil(canvas.height / tileSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle =
          (r + c) % 2 === 0
            ? Config.BACKGROUND_CHECKER.light
            : Config.BACKGROUND_CHECKER.dark;
        ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }
    }

    const isGameActive = Game.state === "playing" || Game.state === "countdown";

    if (!isGameActive) {
      this.drawLobbyState(ctx, canvas, player, isMain);
    } else {
      this.drawGameState(ctx, canvas, player, rad, isMain);
    }

    if (isMain) this.drawSpellBar(ctx, canvas, player);
  },

  drawLobbyState(ctx, canvas, player, isMain) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    (Game.lobbyMarbles || []).forEach((marble) => {
      this.drawBubble(ctx, marble, marble.r, marble.x, marble.y);
    });

    if (isMain) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 4;
      const w = canvas.width * 0.8;
      const h = canvas.height * 0.15;
      const x = (canvas.width - w) / 2;
      const y = canvas.height * 0.4;

      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "bold 24px Arial";

      if (player.isReady) {
        ctx.fillText("PRÊT", canvas.width / 2, y + h / 2 + 8);
      } else {
        ctx.fillText("Clic pour démarrer", canvas.width / 2, y + h / 2 + 8);
      }
    }
  },

  drawGameState(ctx, canvas, player, rad, isMain) {
    // Calcul de la Ligne Noire (Basée sur la grille)
    const gridPixelHeight = Config.GAME_OVER_ROW * (rad * 1.732) + rad;
    const deadLineY = gridPixelHeight + 10;

    // Fond Dashboard (Zone Morte)
    ctx.fillStyle = "#9a3412"; // Orange sombre
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // --- CANON ADAPTATIF ---
    // On calcule l'espace disponible entre la ligne noire et la barre de sorts
    const spellBarHeight = 40;
    const availableHeight = canvas.height - deadLineY - spellBarHeight;
    const cannonPivotY = canvas.height - spellBarHeight;
    const centerX = canvas.width / 2;

    // Le rayon du canon doit toucher la ligne noire
    // Donc rayon = distance entre pivot et ligne noire
    const cannonRadius = Math.abs(cannonPivotY - deadLineY);

    if (isMain) {
      // Dessin de l'éventail (Arc de cercle)
      ctx.beginPath();
      ctx.arc(centerX, cannonPivotY, cannonRadius, Math.PI, 0); // Demi-cercle
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rayons décoratifs
      for (let i = 0; i <= 6; i++) {
        const angle = Math.PI + (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(centerX, cannonPivotY);
        ctx.lineTo(
          centerX + Math.cos(angle) * cannonRadius,
          cannonPivotY + Math.sin(angle) * cannonRadius
        );
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Mise à jour de la logique
      Game.cannonPosition = { x: centerX, y: cannonPivotY };

      if (player.isAlive && !player.launcherBubble && !player.shotBubble) {
        GameLogic.loadBubbles(player);
      }

      // Aiguille (Touche la ligne noire)
      this.drawCannonNeedle(ctx, player, Game.cannonPosition, cannonRadius);

      // Boules Canon
      if (player.launcherBubble)
        this.drawBubble(
          ctx,
          player.launcherBubble,
          rad,
          Game.cannonPosition.x,
          Game.cannonPosition.y,
          true
        );
      if (player.nextBubble) {
        const nextX = Game.cannonPosition.x + rad * 3;
        const nextY = Game.cannonPosition.y - 15;
        this.drawBubble(ctx, player.nextBubble, rad * 0.8, nextX, nextY);
      }
      if (player.shotBubble)
        this.drawBubble(
          ctx,
          player.shotBubble,
          rad,
          player.shotBubble.x,
          player.shotBubble.y
        );
    }

    // Ligne Noire (Par dessus le tout)
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Grille
    if (player.grid) {
      for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
          if (player.grid[r][c]) {
            const { x, y } = GameLogic.getBubbleCoords(r, c, rad);
            this.drawBubble(ctx, player.grid[r][c], rad, x, y);
          }
        }
      }
    }

    (player.fallingBubbles || []).forEach((b) =>
      this.drawBubble(ctx, b, rad, b.x, b.y)
    );
    (player.effects || []).forEach((e) => this.drawEffect(ctx, e));

    if (!player.isAlive) this.drawOverlayText(ctx, canvas, "PERDU", "red");
  },

  drawSpellBar(ctx, canvas, player) {
    const spellH = 40;
    const spellY = canvas.height - spellH;
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, spellY, canvas.width, spellH);
    ctx.fillStyle = "white";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SORTILEGES", 2, spellY + 24);

    const startX = 75;
    const size = spellH - 6;
    for (let i = 0; i < Config.MAX_SPELLS; i++) {
      const sx = startX + i * (size + 3);
      const sy = spellY + 3;
      ctx.strokeStyle = "#334155";
      ctx.strokeRect(sx, sy, size, size);
      if (player.spells && player.spells[i]) {
        const s = Config.SPELLS[player.spells[i]];
        if (s) {
          const icon = Game.spellIcons[player.spells[i]];
          if (icon && icon.complete) ctx.drawImage(icon, sx, sy, size, size);
          else {
            ctx.fillStyle = s.color;
            ctx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
          }
        }
      }
    }
  },

  drawBubble(ctx, b, rad, x, y) {
    if (!b || !b.color) return;
    const grad = ctx.createRadialGradient(
      x - rad / 3,
      y - rad / 3,
      rad / 4,
      x,
      y,
      rad
    );
    grad.addColorStop(0, b.color.main);
    grad.addColorStop(1, b.color.shadow);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(
      x - rad * 0.3,
      y - rad * 0.3,
      rad * 0.25,
      rad * 0.15,
      Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (b.isSpellBubble && b.spell && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon.complete)
        ctx.drawImage(icon, x - rad * 0.7, y - rad * 0.7, rad * 1.4, rad * 1.4);
    }
  },

  drawCannonNeedle(ctx, player, pos, length) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2);

    // Aiguille
    ctx.fillStyle = "#10b981"; // Vert
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    ctx.lineTo(0, -length); // Utilise la longueur calculée (rayon canon)
    ctx.fill();

    // Base
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, -length * 0.2);
    ctx.fill();

    ctx.restore();
  },

  drawEffect(ctx, e) {
    if (e.type === "pop") {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "white";
      ctx.stroke();
    }
  },

  drawOverlayText(ctx, canvas, mainText, color) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 30px Arial";
    ctx.fillText(mainText, canvas.width / 2, canvas.height / 2);
  },
};
