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

    // --- 1. FOND PATCHWORK MOSAIQUE ---
    // On utilise de petits rectangles pour faire un effet "pixel"
    const tileW = canvas.width / 10;
    const tileH = tileW * 0.8;
    const rows = Math.ceil(canvas.height / tileH);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 10; c++) {
        // Formule pseudo-aléatoire pour mélanger les 4 nuances
        const idx = (Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
        const colorIndex = Math.floor(
          Math.abs(idx) * Config.PATCHWORK_ORANGES.length
        );
        ctx.fillStyle = Config.PATCHWORK_ORANGES[colorIndex];
        ctx.fillRect(c * tileW, r * tileH, tileW + 1, tileH + 1); // +1 pour éviter les lignes blanches
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
    // Voile pour atténuer le fond
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    (Game.lobbyMarbles || []).forEach((marble) => {
      this.drawBubble(ctx, marble, marble.r, marble.x, marble.y);
    });

    if (isMain) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      const w = canvas.width * 0.7;
      const h = canvas.height * 0.2;
      const x = (canvas.width - w) / 2;
      const y = canvas.height * 0.35;

      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "bold 26px Arial";

      // Texte avec ombre
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      if (player.isReady) {
        ctx.fillText("PRÊT", canvas.width / 2, y + h / 2 + 10);
      } else {
        ctx.fillText("Clic pour", canvas.width / 2, y + h / 2 - 15);
        ctx.fillText("démarrer", canvas.width / 2, y + h / 2 + 25);
      }
      ctx.shadowBlur = 0;
    }
  },

  drawGameState(ctx, canvas, player, rad, isMain) {
    // Calcul de la zone de jeu (70% max)
    // On force la ligne noire à 70% de la hauteur, peu importe le nombre de boules
    const deadLineY = canvas.height * 0.7;

    // Fond Dashboard (Rouge très sombre comme sur l'image)
    ctx.fillStyle = "#7f1d1d"; // Rouge bordeaux
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // --- CANON ---
    if (isMain) {
      const spellBarHeight = 40;
      const cannonPivotY = canvas.height - spellBarHeight;
      const centerX = canvas.width / 2;

      // Rayon canon = espace disponible
      const cannonRadius = cannonPivotY - deadLineY;

      ctx.beginPath();
      ctx.arc(centerX, cannonPivotY, cannonRadius, Math.PI, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

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

      Game.cannonPosition = { x: centerX, y: cannonPivotY };

      if (player.isAlive && !player.launcherBubble && !player.shotBubble) {
        GameLogic.loadBubbles(player);
      }

      this.drawCannonNeedle(ctx, player, Game.cannonPosition, cannonRadius);

      // Indicateur Équipe (Cercle coloré à gauche du canon)
      const teamColor = Config.TEAM_COLORS[player.team || 0];
      ctx.beginPath();
      // Positionné à gauche, dans la zone rouge
      ctx.arc(
        centerX - cannonRadius * 0.8,
        cannonPivotY - cannonRadius * 0.3,
        12,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = teamColor;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

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
        // NEXT à droite
        const nextX = Game.cannonPosition.x + rad * 4;
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

    // Ligne Blanche/Noire de délimitation
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "white"; // Blanc pour ressortir sur l'orange et le rouge
    ctx.lineWidth = 2;
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
    ctx.fillStyle = "rgba(255,255,255,0.5)";
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
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    ctx.lineTo(0, -length);
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
