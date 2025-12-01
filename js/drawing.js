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

    // Calcul dimensions (Ratio 8 colonnes)
    // On divise par 17 pour avoir la largeur exacte d'une boule
    const rad = isMain ? Game.bubbleRadius : (canvas.width / 17) * 0.95;
    if (!rad || rad < 1) return;

    // --- 1. FOND PATCHWORK (DAMIER ORANGE) ---
    const tileSize = canvas.width / 8; // 8 colonnes de fond
    const rows = Math.ceil(canvas.height / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 8; c++) {
        // Alternance des couleurs damier
        ctx.fillStyle =
          (r + c) % 2 === 0
            ? Config.BACKGROUND_CHECKER.light
            : Config.BACKGROUND_CHECKER.dark;
        ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }
    }

    // --- ETATS ---
    const isGameActive = Game.state === "playing" || Game.state === "countdown";

    if (!isGameActive) {
      this.drawLobbyState(ctx, canvas, player, isMain);
    } else {
      this.drawGameState(ctx, canvas, player, rad, isMain);
    }

    // --- BARRE DE SORTS (Bas de l'écran) ---
    if (isMain) this.drawSpellBar(ctx, canvas, player);
  },

  drawLobbyState(ctx, canvas, player, isMain) {
    // Ombre légère sur le damier
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    (Game.lobbyMarbles || []).forEach((marble) => {
      this.drawBubble(ctx, marble, marble.r, marble.x, marble.y);
    });

    // Overlay Texte
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    if (player.isReady) {
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 30px Arial";
      ctx.fillText("PRÊT", canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(
        "Attente des autres...",
        canvas.width / 2,
        canvas.height / 2 + 30
      );
    } else {
      if (isMain) {
        // Cadre "Clic pour démarrer"
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          canvas.width * 0.15,
          canvas.height * 0.35,
          canvas.width * 0.7,
          canvas.height * 0.2
        );

        ctx.fillStyle = "white";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.font = "bold 28px Arial";
        ctx.fillText("Clic pour", canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText("démarrer", canvas.width / 2, canvas.height / 2 + 25);
        ctx.shadowBlur = 0;
      }
    }
  },

  drawGameState(ctx, canvas, player, rad, isMain) {
    // Calcul de la ligne de mort
    // 12 lignes * hauteur d'une ligne hex
    const gridPixelHeight = Config.GAME_OVER_ROW * (rad * 1.732) + rad;
    // La ligne noire est placée juste après la 12ème ligne potentielle
    const deadLineY = gridPixelHeight + 10;

    // --- DASHBOARD (Zone sous la ligne noire) ---
    // On remplit le bas en orange foncé uni pour le contraste
    ctx.fillStyle = "#c2410c"; // Orange brûlé
    ctx.fillRect(0, deadLineY, canvas.width, canvas.height - deadLineY);

    // --- CANON TYPE "ÉVENTAIL" ---
    if (isMain) {
      const cannonY = canvas.height - 45; // Juste au dessus de la barre de sorts
      const centerX = canvas.width / 2;

      // 1. L'arc de fond (demi-cercle blanc transparent)
      ctx.beginPath();
      ctx.arc(centerX, cannonY + 10, rad * 3.5, Math.PI, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Les rayons (Spokes) de l'éventail
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const angle = Math.PI + (i * Math.PI) / 6;
        const rLen = rad * 3.5;
        const x = centerX + Math.cos(angle) * rLen;
        const y = cannonY + 10 + Math.sin(angle) * rLen;
        ctx.moveTo(centerX, cannonY + 10);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // --- LIGNE NOIRE ---
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "black"; // Ligne blanche sur fond coloré ressort mieux, ou noir selon image
    ctx.strokeStyle = "white"; // Je tente blanc pour le contraste "ligne de délimitation"
    ctx.lineWidth = 3;
    ctx.stroke();

    // --- BOULES ---
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

    // --- ÉLÉMENTS ACTIFS CANON ---
    if (isMain && player.isAlive) {
      const cannonY = canvas.height - 45;
      Game.cannonPosition = { x: canvas.width / 2, y: cannonY };

      // Force reload si bug
      if (!player.launcherBubble && !player.shotBubble) {
        GameLogic.loadBubbles(player);
      }

      // Aiguille
      this.drawCannonNeedle(ctx, player, Game.cannonPosition, rad * 3);

      // Indicateur d'équipe (Pastille colorée en bas à gauche)
      const teamColor = Config.TEAM_COLORS[player.team || 0];
      ctx.beginPath();
      ctx.arc(30, canvas.height - 70, 10, 0, Math.PI * 2);
      ctx.fillStyle = teamColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "white";
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
        // Affichage "Next" à droite ou gauche
        const nextX = Game.cannonPosition.x + rad * 3;
        const nextY = Game.cannonPosition.y + 10;
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

    if (!player.isAlive) this.drawOverlayText(ctx, canvas, "GAME OVER", "red");
  },

  drawSpellBar(ctx, canvas, player) {
    const spellH = 40;
    const spellY = canvas.height - spellH;

    // Fond barre sorts (Bleu foncé pour contraster avec l'orange)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, spellY, canvas.width, spellH);

    ctx.fillStyle = "white";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SORTILEGES", 5, spellY + 24);

    const startX = 85;
    const size = spellH - 6;
    for (let i = 0; i < Config.MAX_SPELLS; i++) {
      const sx = startX + i * (size + 3);
      const sy = spellY + 3;
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
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

    // 1. Cercle principal (Couleur + dégradé léger)
    const grad = ctx.createRadialGradient(
      x - rad / 3,
      y - rad / 3,
      rad / 4,
      x,
      y,
      rad
    );
    grad.addColorStop(0, b.color.main); // Centre clair
    grad.addColorStop(1, b.color.shadow); // Bord sombre (simule 3D)

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();

    // 2. Reflet brillant (Le point blanc "Glossy")
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    // Petit ovale en haut à gauche
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

    // 3. Contour fin pour détacher du fond orange
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icone de sort
    if (b.isSpellBubble && b.spell && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon.complete)
        ctx.drawImage(icon, x - rad * 0.6, y - rad * 0.6, rad * 1.2, rad * 1.2);
    }
  },

  drawCannonNeedle(ctx, player, pos, length) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2);

    // Aiguille noire/verte style radar
    ctx.fillStyle = "#10b981"; // Pointe verte
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    ctx.lineTo(0, -length);
    ctx.fill();

    // Base noire
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, -length * 0.3);
    ctx.fill();

    // Pivot central
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  drawEffect(ctx, e) {
    if (e.type === "pop") {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  drawOverlayText(ctx, canvas, mainText, color, subText = "") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 40px Arial";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(mainText, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    if (subText) {
      ctx.fillStyle = "white";
      ctx.font = "18px Arial";
      ctx.fillText(subText, canvas.width / 2, canvas.height / 2 + 35);
    }
  },
};
