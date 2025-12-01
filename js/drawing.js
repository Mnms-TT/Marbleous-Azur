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

    // --- 1. FOND PATCHWORK ORGANIQUE ---
    // On utilise un bruit sinusoïdal pour grouper les couleurs
    const tileW = canvas.width / 8;
    const tileH = tileW * 0.8;
    const rows = Math.ceil(canvas.height / tileH);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 8; c++) {
        // Cette formule crée des "vagues" de couleurs plutôt qu'un bruit pur
        // Les cases adjacentes ont des valeurs proches
        const noise = Math.sin(c * 0.5) + Math.cos(r * 0.5);

        // On normalise le bruit pour choisir une couleur (0 à 3)
        let colorIndex =
          Math.floor(Math.abs(noise * 10)) % Config.PATCHWORK_ORANGES.length;

        ctx.fillStyle = Config.PATCHWORK_ORANGES[colorIndex];
        ctx.fillRect(c * tileW, r * tileH, tileW + 1, tileH + 1);
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
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 4;
      // Cadre arrondi
      this.roundRect(
        ctx,
        canvas.width * 0.15,
        canvas.height * 0.35,
        canvas.width * 0.7,
        canvas.height * 0.2,
        20
      );
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "bold 28px Arial";

      if (player.isReady) {
        ctx.fillText("PRÊT", canvas.width / 2, canvas.height * 0.45 + 10);
      } else {
        ctx.fillText("Clic pour", canvas.width / 2, canvas.height * 0.45 - 15);
        ctx.fillText("démarrer", canvas.width / 2, canvas.height * 0.45 + 25);
      }
    }
  },

  drawGameState(ctx, canvas, player, rad, isMain) {
    const gridPixelHeight = Config.GAME_OVER_ROW * (rad * 1.732) + rad;
    const deadLineY = gridPixelHeight + 10;

    // --- DASHBOARD (Zone sous la ligne noire) ---
    // Dégradé vertical pour effet volume
    const grad = ctx.createLinearGradient(0, deadLineY, 0, canvas.height);
    grad.addColorStop(0, "#9f1239"); // Rouge/Rose foncé en haut
    grad.addColorStop(1, "#881337"); // Plus sombre en bas
    ctx.fillStyle = grad;
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // --- CANON (Viseur Éventail) ---
    if (isMain) {
      const spellBarHeight = 40;
      const cannonPivotY = canvas.height - spellBarHeight;
      const centerX = canvas.width / 2;
      const cannonRadius = cannonPivotY - deadLineY;

      // 1. Fond semi-transparent
      ctx.beginPath();
      ctx.moveTo(centerX, cannonPivotY);
      ctx.arc(centerX, cannonPivotY, cannonRadius, Math.PI, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();

      // 2. Les Secteurs (Lignes blanches rayonnantes)
      // On dessine 6 secteurs (180 degrés / 6 = 30 degrés par secteur)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;

      for (let i = 0; i <= 6; i++) {
        const angle = Math.PI + (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(centerX, cannonPivotY);
        const x = centerX + Math.cos(angle) * cannonRadius;
        const y = cannonPivotY + Math.sin(angle) * cannonRadius;
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // 3. Arc de cercle extérieur
      ctx.beginPath();
      ctx.arc(centerX, cannonPivotY, cannonRadius, Math.PI, 0);
      ctx.stroke();

      // Logique Canon
      Game.cannonPosition = { x: centerX, y: cannonPivotY };
      if (player.isAlive && !player.launcherBubble && !player.shotBubble) {
        GameLogic.loadBubbles(player);
      }

      // Aiguille
      this.drawCannonNeedle(ctx, player, Game.cannonPosition, cannonRadius);

      // Indicateur Equipe (Gauche)
      const teamColor = Config.TEAM_COLORS[player.team || 0];
      ctx.beginPath();
      ctx.arc(
        centerX - cannonRadius * 0.7,
        cannonPivotY - cannonRadius * 0.4,
        14,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = teamColor;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "white";
      ctx.stroke();

      // Boules
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
        // Next à droite
        const nextX = Game.cannonPosition.x + rad * 3;
        const nextY = Game.cannonPosition.y - 10;
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

    // --- LIGNE NOIRE (Barre de Game Over) ---
    // Dessinée bien épaisse par-dessus le dashboard
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Petite ligne blanche fine par dessus pour le style
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
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
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SORTILEGES", 3, spellY + 24);

    const startX = 80;
    const size = spellH - 6;
    for (let i = 0; i < Config.MAX_SPELLS; i++) {
      const sx = startX + i * (size + 3);
      const sy = spellY + 3;
      ctx.strokeStyle = "#475569";
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

    // Aiguille noire fine
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -length);
    ctx.stroke();

    // Pointe verte
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(0, -length, 4, 0, Math.PI * 2);
    ctx.fill();

    // Base
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // Utilitaire pour rectangle arrondi
  roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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
