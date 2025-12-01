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

    // 1. FOND DE JEU (Zone des boules)
    ctx.fillStyle = isMain ? "#334155" : "#475569"; // Gris/Bleu ardoise
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rad = isMain ? Game.bubbleRadius : (canvas.width / 17) * 0.95;

    // HAUTEUR DE LA GRILLE (12 lignes)
    // 11 intervals verticaux complets + 1 rayon
    const gridPixelHeight = Config.GAME_OVER_ROW * (rad * 1.732) + rad * 2;
    const deadLineY = gridPixelHeight + 10; // Petite marge

    // 2. ZONE MORTE / DASHBOARD (Fond rouge bas)
    // On remplit tout ce qui est en dessous de la ligne noire
    ctx.fillStyle = "#7f1d1d"; // Rouge très sombre
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // Décoration : Demi-cercle rouge plus clair pour le canon
    ctx.beginPath();
    const arcHeight = canvas.height - deadLineY;
    ctx.arc(
      canvas.width / 2,
      canvas.height + rad,
      canvas.width * 0.55,
      Math.PI,
      0
    );
    ctx.fillStyle = "#991b1b";
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. LIGNE NOIRE (Game Over)
    // Dessinée bien épaisse
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 5;
    ctx.stroke();

    // 4. BOULES (Le Jeu)
    // On dessine toujours les boules s'il y en a, même en attente (pour voir le plateau)
    for (let r = 0; r < Config.GRID_ROWS; r++) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (player.grid[r][c]) {
          const { x, y } = GameLogic.getBubbleCoords(r, c, rad);
          this.drawBubble(ctx, player.grid[r][c], rad, x, y);
        }
      }
    }

    // Effets visuels
    (player.effects || []).forEach((e) => this.drawEffect(ctx, e));
    (player.fallingBubbles || []).forEach((b) =>
      this.drawBubble(ctx, b, rad, b.x, b.y)
    );

    // 5. CANON (Uniquement joueur principal)
    if (isMain && player.isAlive) {
      // Position du pivot du canon
      const cannonY = deadLineY + (canvas.height - deadLineY) / 2;
      Game.cannonPosition = { x: canvas.width / 2, y: cannonY };

      // Aiguille
      this.drawCannonNeedle(ctx, player, Game.cannonPosition, deadLineY);

      // Bulle à tirer
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

      // Bulle suivante (à gauche du canon)
      if (player.nextBubble) {
        const nextX = Game.cannonPosition.x - rad * 3;
        const nextY = Game.cannonPosition.y + rad;
        this.drawBubble(ctx, player.nextBubble, rad * 0.8, nextX, nextY);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText("NEXT", nextX, nextY - rad - 2);
      }

      // Bulle en vol
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

    // 6. BARRE DE SORTS (Tout en bas)
    if (isMain) {
      const spellH = 40;
      const spellY = canvas.height - spellH;

      ctx.fillStyle = "#0f172a"; // Fond noir/bleu
      ctx.fillRect(0, spellY, canvas.width, spellH);

      // Label
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("SORTILEGES", 8, spellY + 24);

      // Cases
      const startX = 90;
      const gap = 4;
      const size = spellH - 4;

      for (let i = 0; i < Config.MAX_SPELLS; i++) {
        const sx = startX + i * (size + gap);
        const sy = spellY + 2;

        // Bordure case
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, size, size);

        // Contenu
        if (player.spells && player.spells[i]) {
          const spellName = player.spells[i];
          const spellConf = Config.SPELLS[spellName];
          if (spellConf) {
            const icon = Game.spellIcons[spellName];
            if (icon && icon.complete) {
              ctx.drawImage(icon, sx, sy, size, size);
            } else {
              ctx.fillStyle = spellConf.color;
              ctx.fillRect(sx + 2, sy + 2, size - 4, size - 4);
            }
          }
        }
      }
    }

    // 7. OVERLAYS (Texte par dessus tout)
    if (!player.isAlive && Game.state === "playing") {
      this.drawOverlayText(ctx, canvas, "PERDU", "red");
    } else if (isMain && Game.state === "waiting") {
      if (player.isReady) {
        this.drawOverlayText(
          ctx,
          canvas,
          "PRÊT !",
          "#22c55e",
          "Attente des autres..."
        );
      } else {
        this.drawOverlayText(ctx, canvas, "CLIQUEZ", "white", "POUR JOUER");
      }
    }
  },

  drawBubble(ctx, b, rad, x, y, isLauncher = false) {
    if (!b || !b.color) return;

    // Bulle principale
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = b.color.main;
    ctx.fill();

    // Ombre interne
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Reflet (Shine)
    ctx.beginPath();
    ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();

    // Icone de sort sur la bulle
    if (b.isSpellBubble && b.spell && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon.complete) {
        ctx.drawImage(icon, x - rad * 0.7, y - rad * 0.7, rad * 1.4, rad * 1.4);
      }
    }
  },

  drawCannonNeedle(ctx, player, pos, limitY) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2);

    const len = pos.y - limitY - 5; // Pointe vers la ligne noire

    // Aiguille dorée
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, -len);
    ctx.closePath();
    ctx.fill();

    // Base ronde
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  drawEffect(ctx, e) {
    if (e.type === "pop") {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = e.color || "white";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  drawOverlayText(ctx, canvas, mainText, color, subText = "") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = "bold 30px Arial";
    ctx.fillText(mainText, canvas.width / 2, canvas.height / 2);

    if (subText) {
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(subText, canvas.width / 2, canvas.height / 2 + 30);
    }
  },
};
