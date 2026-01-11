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

    // --- Effacer le canvas (transparent pour voir le fond orange CSS) ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (Game.state === "countdown") {
      // Pendant le countdown, afficher un écran noir avec le compte
      this.drawCountdownScreen(ctx, canvas);
    } else if (Game.state === "playing") {
      this.drawGameState(ctx, canvas, player, rad, isMain);
    } else if (Game.state === "spectating") {
      // Spectateur : afficher l'animation lobby + message
      this.drawLobbyState(ctx, canvas, player, isMain);
      this.drawSpectatorOverlay(ctx, canvas);
    } else {
      this.drawLobbyState(ctx, canvas, player, isMain);
    }
  },

  drawSpectatorOverlay(ctx, canvas) {
    // Overlay semi-transparent avec message
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 16px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("⏳ PARTIE EN COURS", canvas.width / 2, canvas.height / 2 - 15);

    ctx.font = "12px 'Outfit', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("Vous rejoindrez à la prochaine manche", canvas.width / 2, canvas.height / 2 + 10);
  },

  drawCountdownScreen(ctx, canvas) {
    // Fond semi-transparent noir
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Message "Préparation..."
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Préparation...", canvas.width / 2, canvas.height / 2);
  },

  drawLobbyState(ctx, canvas, player, isMain) {
    // Le fond orange est géré par le CSS, pas besoin de dessiner de fond

    // Animation de pluie de billes
    if (Game.lobbyMarbles && Game.lobbyMarbles.length > 0) {
      Game.lobbyMarbles.forEach((marble) => {
        const grad = ctx.createRadialGradient(
          marble.x - marble.r / 3,
          marble.y - marble.r / 3,
          marble.r / 4,
          marble.x,
          marble.y,
          marble.r
        );
        grad.addColorStop(0, marble.color.main);
        grad.addColorStop(1, marble.color.shadow);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(marble.x, marble.y, marble.r, 0, Math.PI * 2);
        ctx.fill();

        // Reflet
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.ellipse(
          marble.x - marble.r * 0.3,
          marble.y - marble.r * 0.3,
          marble.r * 0.2,
          marble.r * 0.1,
          Math.PI / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    }

    // Affichage du statut du joueur (principal uniquement)
    if (isMain && player) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Cadre de statut
      const boxWidth = canvas.width * 0.8;
      const boxHeight = 120;
      const boxX = centerX - boxWidth / 2;
      const boxY = centerY - boxHeight / 2;

      // Fond du cadre
      ctx.fillStyle = player.isReady
        ? "rgba(34, 197, 94, 0.9)"
        : "rgba(251, 146, 60, 0.9)";
      this.roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 12);
      ctx.fill();

      // Bordure
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Nom du joueur
      ctx.fillStyle = "white";
      ctx.font = "bold 18px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(player.name || "Joueur", centerX, boxY + 35);

      // Statut
      ctx.font = "bold 24px Inter, Arial, sans-serif";
      const statusText = player.isReady ? "✓ PRÊT" : "Cliquez pour être PRÊT";
      ctx.fillText(statusText, centerX, boxY + 75);

      // Indicateur d'équipe
      if (player.team !== undefined) {
        const teamColor = Config.TEAM_COLORS[player.team] || "#3B82F6";
        ctx.beginPath();
        ctx.arc(boxX + 25, boxY + 25, 12, 0, Math.PI * 2);
        ctx.fillStyle = teamColor;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Indicateur d'équipe pour les miniatures d'adversaires
    if (!isMain && player) {
      const teamColor = Config.TEAM_COLORS[player.team || 0];

      // Petit cercle coloré en bas à droite avec le nom
      const dotX = canvas.width - 8;
      const dotY = canvas.height - 8;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = teamColor;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nom du joueur en bas
      ctx.fillStyle = "white";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "black";
      ctx.shadowBlur = 2;
      ctx.fillText(player.name || "Joueur", canvas.width / 2, canvas.height - 2);
      ctx.shadowBlur = 0;

      // Indicateur PRÊT si applicable
      if (player.isReady) {
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PRÊT", canvas.width / 2, 12);
      }
    }
  },

  drawGameState(ctx, canvas, player, rad, isMain) {
    // Calcul de la ligne de séparation (entre rangée 10 et 11)
    const deadLineY = (Config.GAME_OVER_ROW) * (rad * 1.732) + rad;

    // Le fond orange est géré par CSS, pas de dashboard dessiné ici

    // --- CANON (Viseur Radar) ---
    if (isMain) {
      // Le canon est positionné dans la zone dashboard
      // On le centre horizontalement
      const centerX = canvas.width / 2;
      // Le pivot est en bas du canvas avec une petite marge
      const cannonPivotY = canvas.height - 15;

      // Rayon du radar : Doit tenir entre la ligne noire et le pivot
      // On le limite pour qu'il ne soit pas trop grand
      const maxRadius = Math.min(120, cannonPivotY - deadLineY - 15);
      const cannonRadius = Math.max(40, maxRadius);

      // 1. Fond semi-transparent (Eventail)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, cannonPivotY);
      ctx.arc(centerX, cannonPivotY, cannonRadius, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fill();

      // Bordure éventail
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Rayons blancs
      const rays = 6;
      for (let i = 0; i <= rays; i++) {
        const angle = Math.PI + (i * Math.PI) / rays;
        ctx.beginPath();
        ctx.moveTo(centerX, cannonPivotY);
        const x = centerX + Math.cos(angle) * cannonRadius;
        const y = cannonPivotY + Math.sin(angle) * cannonRadius;
        ctx.lineTo(x, y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.stroke();
      }
      ctx.restore();

      // Logique Canon
      Game.cannonPosition = { x: centerX, y: cannonPivotY };
      if (player.isAlive && !player.launcherBubble && !player.shotBubble) {
        GameLogic.loadBubbles(player);
      }

      // Aiguille
      this.drawCannonNeedle(ctx, player, Game.cannonPosition, cannonRadius);

      // Indicateur Equipe
      const teamColor = Config.TEAM_COLORS[player.team || 0];
      ctx.beginPath();
      ctx.arc(
        centerX - cannonRadius - 20,
        cannonPivotY - 20,
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
        const nextX = centerX + cannonRadius + 20;
        const nextY = cannonPivotY - 20;
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

    // --- Effet de rotation du plateau (plateauRenverse) ---
    // Appliqué UNIQUEMENT à la grille et aux éléments du plateau, pas au canon
    let rotationApplied = false;
    if (isMain && Game.localPlayer?.statusEffects?.plateauRenverse) {
      const rotAngle = Game.localPlayer.statusEffects.plateauRenverse.angle || 0;
      ctx.save();
      // Rotation autour du centre du canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotAngle * Math.PI / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      rotationApplied = true;
    }

    // --- LIGNE BLANCHE (Barre de Game Over) ---
    ctx.beginPath();
    ctx.moveTo(0, deadLineY);
    ctx.lineTo(canvas.width, deadLineY);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1; // Ligne très fine
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

    // Dessiner les bulles entrantes (sort boulesSupplementaires)
    (player.incomingBubbles || []).forEach((b) =>
      this.drawBubble(ctx, b, rad, b.x, b.y)
    );

    (player.effects || []).forEach((e) => this.drawEffect(ctx, e));

    if (!player.isAlive) this.drawOverlayText(ctx, canvas, "PERDU", "red");

    if (rotationApplied) ctx.restore();
  },

  drawSpellBar(ctx, canvas, player) {
    const spellH = 40;
    const spellY = canvas.height - spellH;

    // Fond semi-transparent
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, spellY, canvas.width, spellH);

    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SORTILEGES", 5, spellY + 24);

    const startX = 90;
    const size = spellH - 6;
    for (let i = 0; i < Config.MAX_SPELLS; i++) {
      const sx = startX + i * (size + 4);
      const sy = spellY + 3;

      ctx.strokeStyle = "#475569";
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

    // Contour fin (style Bust-A-Move classique)
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = "#222";
    ctx.fill();

    // Bulle principale avec dégradé simple
    const grad = ctx.createRadialGradient(
      x - rad * 0.3,
      y - rad * 0.3,
      rad * 0.1,
      x,
      y,
      rad * 0.95
    );
    // Couleur vive puis ombre sur le bord
    grad.addColorStop(0, b.color.main);
    grad.addColorStop(0.85, b.color.main);
    grad.addColorStop(1, b.color.shadow);

    ctx.beginPath();
    ctx.arc(x, y, rad * 0.96, 0, Math.PI * 2); // Bordure très fine (4%)
    ctx.fillStyle = grad;
    ctx.fill();

    // Reflet brillant (ovale en haut à gauche)
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(
      x - rad * 0.25,
      y - rad * 0.3,
      rad * 0.22,
      rad * 0.12,
      Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Indicateur visuel de sort (étoile blanche)
    if (b.isSpellBubble && b.spell) {
      // Dessiner une étoile blanche sur la bulle
      ctx.fillStyle = "white";
      ctx.font = `bold ${rad * 0.8}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", x, y);

      // Dessiner aussi l'icône si disponible
      const icon = Game.spellIcons[b.spell];
      if (icon && icon.complete) {
        ctx.drawImage(icon, x - rad * 0.5, y - rad * 0.5, rad, rad);
      }
    }
  },

  drawCannonNeedle(ctx, player, pos, length) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.launcher.angle + Math.PI / 2);

    // Couleur de l'aiguille : Noir par défaut, Vert si sous sort jaune (canonCasse)
    const hasCanonCasse = player.statusEffects?.canonCasse;
    const needleColor = hasCanonCasse ? "#10b981" : "#1a1a1a"; // Vert ou Noir

    // Aiguille Triangulaire
    ctx.fillStyle = needleColor;
    ctx.beginPath();
    ctx.moveTo(0, -length); // Pointe
    ctx.lineTo(-5, 0); // Base gauche
    ctx.lineTo(5, 0); // Base droite
    ctx.closePath();
    ctx.fill();

    // Contour
    ctx.strokeStyle = hasCanonCasse ? "#064e3b" : "#000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Base pivot
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
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
      const alpha = Math.max(0, e.life / 10);

      // Cercle extérieur en expansion
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cercle intérieur coloré
      if (e.color) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.hexToRgb(e.color)}, ${alpha * 0.5})`;
        ctx.fill();
      }

      // Particules (étoiles)
      const particleCount = 6;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 / particleCount) * i + e.radius * 0.1;
        const px = e.x + Math.cos(angle) * e.radius;
        const py = e.y + Math.sin(angle) * e.radius;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }
    }
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
      `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
      "255, 255, 255";
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
