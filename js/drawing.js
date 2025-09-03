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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rad = isMain
      ? Game.bubbleRadius
      : (canvas.width / (Config.GRID_COLS * 2 + 1)) * 0.95;
    if (rad <= 0) return;

    const gameOverLineY =
      GameLogic.getBubbleCoords(Config.GAME_OVER_ROW, 0, rad).y - rad;

    if (isMain && Game.state === "waiting") {
      this.drawLobbyAnimation(ctx, canvas);
    } else if (
      Game.state === "playing" ||
      (isMain && Game.state === "countdown")
    ) {
      if (Game.state === "playing") {
        for (let r = 0; r < Config.GRID_ROWS; r++)
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (player.grid[r][c]) {
              const { x, y } = GameLogic.getBubbleCoords(r, c, rad);
              this.drawBubble(ctx, player.grid[r][c], rad, x, y);
            }
        (player.fallingBubbles || []).forEach((b) =>
          this.drawBubble(ctx, b, rad, b.x, b.y)
        );
        (player.effects || []).forEach((e) => this.drawEffect(ctx, e));

        if (isMain && player.isAlive) {
          const launcherX = canvas.width / 2;
          const baseY = canvas.height;

          const launcherBubbleY = baseY - rad;

          // --- CHANGEMENT ORDRE DE DESSIN ET POSITION ---
          // 1. On dessine la bulle principale un peu plus grosse et "derrière"
          if (player.launcherBubble)
            this.drawBubble(
              ctx,
              player.launcherBubble,
              rad * 1.05, // Légèrement plus grosse
              launcherX,
              launcherBubbleY,
              true
            );

          // 2. On dessine la base du canon par-dessus
          this.drawCannonBase(ctx, launcherX, baseY, rad);

          // 3. On dessine la prochaine bulle, petite et à l'intérieur de la base
          if (player.nextBubble)
            this.drawBubble(
              ctx,
              player.nextBubble,
              rad * 0.6, // Plus petite
              launcherX + rad * 1.5,
              baseY - rad * 0.5
            );

          // 4. On dessine l'aiguille en dernier
          this.drawCannonNeedle(
            ctx,
            player,
            { x: launcherX, y: baseY },
            gameOverLineY
          );

          // 5. La bulle tirée est toujours au premier plan
          if (player.shotBubble)
            this.drawBubble(
              ctx,
              player.shotBubble,
              rad,
              player.shotBubble.x,
              player.shotBubble.y
            );
        }
      }
      if (isMain) {
        this.drawGameOverLine(ctx, canvas.width, gameOverLineY);
      }
    }

    if (!player.isAlive && Game.state === "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = `bold ${canvas.width / 8}px Inter`;
      ctx.textAlign = "center";
      ctx.fillText("PERDU", canvas.width / 2, canvas.height / 2);
    }
  },

  drawLobbyAnimation(ctx, canvas) {
    (Game.lobbyMarbles || []).forEach((marble) => {
      ctx.fillStyle = marble.color.main;
      ctx.beginPath();
      ctx.arc(marble.x, marble.y, marble.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `bold ${canvas.width / 7}px Inter`;
    ctx.fillText("Marbleous", canvas.width / 2, canvas.height / 2);
    ctx.font = `normal ${canvas.width / 20}px Inter`;
    ctx.fillText(
      "Cliquez pour être prêt",
      canvas.width / 2,
      canvas.height / 2 + 40
    );
  },

  drawBubble(ctx, b, rad, x, y, isLauncher = false) {
    if (
      !isFinite(x) ||
      !isFinite(y) ||
      !isFinite(rad) ||
      rad <= 0 ||
      !b ||
      !b.color
    )
      return;
    ctx.fillStyle = b.color.shadow;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = b.color.main;
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.9, 0, 2 * Math.PI);
    ctx.fill();
    if (!isLauncher) {
      const grad = ctx.createRadialGradient(
        x - rad * 0.4,
        y - rad * 0.4,
        0,
        x,
        y,
        rad
      );
      grad.addColorStop(0, "rgba(255,255,255,0.2)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.9, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (b.isSpellBubble && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon && icon.complete && icon.naturalWidth !== 0) {
        const size = rad * 1.4;
        ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
      }
    }
  },
  drawEffect(ctx, e) {
    if (e.type === "pop") {
      ctx.beginPath();
      ctx.strokeStyle = e.color || `rgba(255, 255, 224, ${e.life / 10})`;
      ctx.lineWidth = 3;
      ctx.arc(e.x, e.y, e.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  },

  drawGameOverLine(ctx, w, y) {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  },

  drawCannonBase(ctx, x, y, rad) {
    ctx.fillStyle = "#E5E7EB";
    ctx.beginPath();
    // On garde un rayon plus petit pour la base
    ctx.arc(x, y, rad * 1.1, Math.PI, 0);
    ctx.fill();
  },

  drawCannonNeedle(ctx, player, basePos, lineY) {
    ctx.save();
    ctx.translate(basePos.x, basePos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2);
    const length = basePos.y - lineY;
    ctx.fillStyle = "#374151";
    ctx.fillRect(-2, 0, 4, -length);
    ctx.restore();
  },
};
