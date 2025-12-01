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

    // 1. FOND
    ctx.fillStyle = isMain ? "#1e293b" : "#334155";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rad = isMain ? Game.bubbleRadius : (canvas.width / 17) * 0.95;

    // Si le rayon est invalide (0 ou NaN), on arrête tout pour éviter les bugs
    if (!rad || rad < 1) return;

    // Calcul Hauteur Grille
    const gridPixelHeight = Config.GAME_OVER_ROW * (rad * 1.732) + rad * 2;
    const deadLineY = gridPixelHeight + 5;

    // 2. DASHBOARD (Fond rouge bas)
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // Demi-cercle
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2,
      canvas.height + rad * 2,
      canvas.width * 0.6,
      Math.PI,
      0
    );
    ctx.fillStyle = "#991b1b";
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. LIGNE NOIRE
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = isMain ? 4 : 2;
    ctx.stroke();

    // 4. BOULES (Correction : On dessine TOUJOURS si la grille existe)
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

    // Effets & Boules tombantes
    (player.fallingBubbles || []).forEach((b) =>
      this.drawBubble(ctx, b, rad, b.x, b.y)
    );
    (player.effects || []).forEach((e) => this.drawEffect(ctx, e));

    // 5. CANON (Seulement joueur principal et vivant)
    if (isMain && player.isAlive) {
      const cannonY = deadLineY + (canvas.height - deadLineY) / 2;
      Game.cannonPosition = { x: canvas.width / 2, y: cannonY };

      this.drawCannonNeedle(ctx, player, Game.cannonPosition, deadLineY);

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
        const nextX = Game.cannonPosition.x - rad * 3;
        const nextY = Game.cannonPosition.y + rad;
        this.drawBubble(ctx, player.nextBubble, rad * 0.8, nextX, nextY);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText("NEXT", nextX, nextY - rad - 2);
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

    // 6. SORTS
    if (isMain) {
      const spellH = 40;
      const spellY = canvas.height - spellH;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, spellY, canvas.width, spellH);
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("SORTILEGES", 5, spellY + 25);

      const startX = 90;
      const size = spellH - 4;
      for (let i = 0; i < Config.MAX_SPELLS; i++) {
        const sx = startX + i * (size + 4);
        const sy = spellY + 2;
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
    }

    // 7. OVERLAYS
    if (!player.isAlive && Game.state === "playing") {
      this.drawOverlayText(ctx, canvas, "PERDU", "red");
    } else if (isMain && Game.state === "waiting") {
      if (player.isReady)
        this.drawOverlayText(ctx, canvas, "PRÊT !", "#22c55e");
      else this.drawOverlayText(ctx, canvas, "CLIQUEZ", "white", "POUR JOUER");
    }
  },

  drawBubble(ctx, b, rad, x, y, isLauncher = false) {
    if (!b || !b.color) return;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = b.color.main;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill();

    if (b.isSpellBubble && b.spell && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon.complete)
        ctx.drawImage(icon, x - rad, y - rad, rad * 2, rad * 2);
    }
  },

  drawCannonNeedle(ctx, player, pos, limitY) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2);
    const len = pos.y - limitY - 5;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, -len);
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

  drawOverlayText(ctx, canvas, mainText, color, subText = "") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 40px Arial";
    ctx.fillText(mainText, canvas.width / 2, canvas.height / 2);
    if (subText) {
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(subText, canvas.width / 2, canvas.height / 2 + 30);
    }
  },
};
