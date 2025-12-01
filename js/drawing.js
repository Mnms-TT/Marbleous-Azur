import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { Config } from "./config.js";

export const Drawing = {
  drawAll() {
    if (!Game.localPlayer) return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    // Le joueur principal
    this.drawPlayer(Game.localPlayer, mainCanvas.getContext("2d"), true);

    // Les adversaires
    Game.players.forEach((p) => {
      if (p.id !== Game.localPlayer.id && p.canvas)
        this.drawPlayer(p, p.ctx, false);
    });
  },

  drawPlayer(player, ctx, isMain) {
    const canvas = ctx.canvas;
    if (!canvas || canvas.width === 0 || !player) return;

    // 1. Fond du plateau
    // Couleur de fond légèrement différente selon si c'est nous ou l'ennemi (optionnel, ici uni)
    ctx.fillStyle = isMain ? "#b91c1c" : "#ea580c"; // Rouge foncé pour main, Orange pour ennemi (comme l'image)
    if (isMain) ctx.fillStyle = "#cd5c5c"; // Un rouge un peu plus "tapis de jeu"
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calcul du rayon basé sur la largeur pour que 8 boules rentrent parfaitement
    const rad = canvas.width / (Config.GRID_COLS * 2 + 1); // +1 pour le décalage hex

    // --- CALCUL DES ZONES (Structure Verticale) ---
    // La grille prend une hauteur fixe basée sur les boules
    const gridHeight = GameLogic.getBubbleCoords(Config.GRID_ROWS, 0, rad).y;
    const deadLineY = gridHeight + rad / 2; // La ligne noire est juste sous la dernière rangée possible

    // 2. Dessin des boules (Grille)
    if (Game.state === "playing" || (isMain && Game.state === "countdown")) {
      for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
          if (player.grid[r][c]) {
            const { x, y } = GameLogic.getBubbleCoords(r, c, rad);
            this.drawBubble(ctx, player.grid[r][c], rad, x, y);
          }
        }
      }

      // Boules qui tombent
      (player.fallingBubbles || []).forEach((b) =>
        this.drawBubble(ctx, b, rad, b.x, b.y)
      );

      // Effets (particules)
      (player.effects || []).forEach((e) => this.drawEffect(ctx, e));
    }

    // 3. Ligne de Mort (Noir Strict)
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = isMain ? 4 : 2;
    ctx.stroke();

    // 4. Zone Canon (Dashboard)
    // Elle commence sous la ligne noire et va jusqu'en bas (moins la zone de sorts)
    const dashboardY = deadLineY;
    const spellZoneHeight = isMain ? 40 : 0; // Espace pour les sorts en bas (visuel)
    const bottomY = canvas.height - spellZoneHeight;

    // Dessin du fond rouge arrondi (le tableau de bord)
    // On dessine un arc de cercle centré en bas
    ctx.save();
    ctx.fillStyle = "#991b1b"; // Rouge sombre style "plastique dur"
    ctx.beginPath();
    // Un grand arc qui dépasse en bas pour faire l'effet "dashboard"
    ctx.arc(
      canvas.width / 2,
      bottomY + rad * 2,
      canvas.width * 0.6,
      Math.PI,
      0
    );
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Zone Sortilèges (Fond noir en bas)
    if (isMain) {
      ctx.fillStyle = "#1f2937"; // Gris très foncé
      ctx.fillRect(
        0,
        canvas.height - spellZoneHeight,
        canvas.width,
        spellZoneHeight
      );
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.fillText("SORTILEGES", 5, canvas.height - 12);

      // Ici on pourrait dessiner les cases vides des sorts
      const slotSize = spellZoneHeight - 4;
      for (let i = 0; i < Config.MAX_SPELLS; i++) {
        ctx.strokeStyle = "#4b5563";
        ctx.strokeRect(
          80 + i * (slotSize + 2),
          canvas.height - spellZoneHeight + 2,
          slotSize,
          slotSize
        );
      }
    }
    ctx.restore();

    // 5. Le Canon et la Flèche
    if (isMain && player.isAlive && Game.state === "playing") {
      const pivotX = canvas.width / 2;
      const pivotY = bottomY - rad; // Le canon est posé sur le dashboard

      // La bulle à tirer (dans le canon)
      if (player.launcherBubble) {
        this.drawBubble(ctx, player.launcherBubble, rad, pivotX, pivotY, true);
      }

      // La bulle suivante (petite, à côté)
      if (player.nextBubble) {
        this.drawBubble(
          ctx,
          player.nextBubble,
          rad * 0.7,
          pivotX - rad * 3,
          pivotY + rad / 2
        );
        // Petit texte "NEXT"
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText("NEXT", pivotX - rad * 3, pivotY - rad / 2);
      }

      // L'aiguille du canon
      this.drawCannonNeedle(ctx, player, { x: pivotX, y: pivotY }, rad * 3); // Aiguille plus longue

      // La bulle tirée (en mouvement)
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

    // Game Over Overlay
    if (!player.isAlive && Game.state === "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = `bold ${canvas.width / 6}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("PERDU", canvas.width / 2, canvas.height / 2);
    }

    // Animation Lobby (si en attente)
    if (isMain && Game.state === "waiting") {
      this.drawLobbyAnimation(ctx, canvas);
    }
  },

  drawBubble(ctx, b, rad, x, y, isLauncher = false) {
    if (!isFinite(x) || !isFinite(y) || rad <= 0 || !b || !b.color) return;

    // Ombre (Effet 3D)
    ctx.fillStyle = b.color.shadow;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    ctx.fill();

    // Couleur principale (légèrement décalée pour l'effet de lumière)
    ctx.fillStyle = b.color.main;
    ctx.beginPath();
    ctx.arc(x - rad * 0.1, y - rad * 0.1, rad * 0.85, 0, 2 * Math.PI);
    ctx.fill();

    // Reflet blanc (Shine)
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.25, 0, 2 * Math.PI);
    ctx.fill();

    // Icône de sort si présent
    if (b.isSpellBubble && b.spell && Game.spellIcons[b.spell]) {
      const icon = Game.spellIcons[b.spell];
      if (icon && icon.complete && icon.naturalWidth !== 0) {
        const size = rad * 1.2;
        ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
      }
    }
  },

  drawEffect(ctx, e) {
    if (e.type === "pop") {
      ctx.beginPath();
      ctx.strokeStyle = e.color || `rgba(255, 255, 255, ${e.life / 10})`;
      ctx.lineWidth = 2;
      ctx.arc(e.x, e.y, e.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  },

  drawLobbyAnimation(ctx, canvas) {
    // Fond sombre
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    (Game.lobbyMarbles || []).forEach((marble) => {
      ctx.fillStyle = marble.color.main;
      ctx.beginPath();
      ctx.arc(marble.x, marble.y, marble.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold ${canvas.width / 8}px Arial`;
    ctx.fillText("PRÊT ?", canvas.width / 2, canvas.height / 2);
    ctx.font = `normal ${canvas.width / 20}px Arial`;
    ctx.fillStyle = "white";
    ctx.fillText(
      "Cliquez pour valider",
      canvas.width / 2,
      canvas.height / 2 + 40
    );
  },

  drawCannonNeedle(ctx, player, basePos, length) {
    ctx.save();
    ctx.translate(basePos.x, basePos.y);
    // + Math.PI / 2 car 0 est à droite en Canvas, et on veut que -PI/2 soit en haut
    ctx.rotate(player.launcher.angle + Math.PI / 2);

    // Dessin d'une flèche stylisée
    const width = length * 0.15;

    ctx.fillStyle = "#fbbf24"; // Or
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(0, -length); // Pointe vers le haut (négatif Y)
    ctx.closePath();
    ctx.fill();

    // Axe central
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.arc(0, 0, width / 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
