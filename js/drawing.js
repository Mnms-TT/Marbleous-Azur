import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { Config } from "./config.js";

export const Drawing = {
  pixelatedBubbleCache: {},

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


    // --- FPS COUNTER (fixed display) ---
    if (isMain) {
      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#0f0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Game.targetFPS} fps`, 8, canvas.height - 4);
      ctx.restore();
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

    // --- LIGNES VERTICALES DE GRILLE ---
    this.drawGridLines(ctx, canvas, rad);

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
    if (player.hasWon) this.drawOverlayText(ctx, canvas, "GAGNÉ", "#22c55e");

    // Overlays for opponent mini-boards
    if (!isMain) {
      if (!player.isAlive) {
        this.drawOverlayText(ctx, canvas, "GAME OVER", "#ef4444");
      } else if (Game.state === "waiting" && player.isReady) {
        this.drawOverlayText(ctx, canvas, "Prêt", "#22c55e");
      }
    }

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
          if (icon && icon.complete) {
            ctx.drawImage(icon, sx, sy, size, size);
          } else {
            ctx.fillStyle = s.color;
            ctx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
          }
        }
      }
    }
  },

  drawBubble(ctx, b, rad, x, y) {
    if (!b || !b.color) return;

    const diameter = Math.round(rad * 2);
    const colorKey = b.color.main;
    const cacheKey = b.isSpellBubble && b.spell ? `spell_${b.spell}_${colorKey}` : `norm_${colorKey}`;

    // Target pixel size for the pixelated look (e.g., 18px diameter)
    const pixelatedSize = 20;

    // Create or get from cache
    if (!this.pixelatedBubbleCache[cacheKey]) {
      const offCanvas = document.createElement("canvas");
      offCanvas.width = pixelatedSize;
      offCanvas.height = pixelatedSize;
      const offCtx = offCanvas.getContext("2d");
      const r = pixelatedSize / 2;
      const cx = r;
      const cy = r;

      // Draw the 3D bubble on the small canvas
      // 1. Base gradient
      const grad = offCtx.createRadialGradient(
        cx - r * 0.35, cy - r * 0.35, r * 0.05,
        cx + r * 0.1, cy + r * 0.1, r
      );
      grad.addColorStop(0, this.lightenColor(b.color.main, 90));
      grad.addColorStop(0.25, this.lightenColor(b.color.main, 40));
      grad.addColorStop(0.6, b.color.main);
      grad.addColorStop(1, b.color.shadow);

      offCtx.beginPath();
      offCtx.arc(cx, cy, r, 0, Math.PI * 2);
      offCtx.fillStyle = grad;
      offCtx.fill();

      // 2. Specular highlight
      const specGrad = offCtx.createRadialGradient(
        cx - r * 0.3, cy - r * 0.35, 0,
        cx - r * 0.3, cy - r * 0.35, r * 0.4
      );
      specGrad.addColorStop(0, "rgba(255,255,255,0.7)");
      specGrad.addColorStop(0.4, "rgba(255,255,255,0.15)");
      specGrad.addColorStop(1, "rgba(255,255,255,0)");
      offCtx.beginPath();
      offCtx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.4, 0, Math.PI * 2);
      offCtx.fillStyle = specGrad;
      offCtx.fill();

      // 3. Specular dot
      offCtx.fillStyle = "rgba(255,255,255,0.6)";
      offCtx.beginPath();
      const dr = r * 0.1;
      const hr = r * 0.06;
      offCtx.ellipse(cx - r * 0.28, cy - r * 0.32, dr, hr, Math.PI / 4, 0, Math.PI * 2);
      offCtx.fill();

      // 4. Record the spell symbol if needed
      if (b.isSpellBubble && b.spell) {
        const icon = Game.spellIcons[b.spell];
        if (icon && icon.complete) {
          const iconSize = r * 1.6;
          offCtx.drawImage(icon, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
        }
      }

      this.pixelatedBubbleCache[cacheKey] = offCanvas;
    }

    // Draw the cached low-res bubble back to main canvas with smoothing OFF
    const cached = this.pixelatedBubbleCache[cacheKey];
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cached, x - rad, y - rad, diameter, diameter);
    ctx.imageSmoothingEnabled = prevSmoothing;
  },

  // Lighten a hex color by an amount
  lightenColor(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
  },

  // Draw spell symbol on bubble matching reference images EXACTLY
  drawSpellSymbol(ctx, x, y, rad, spellKey) {
    const s = rad * 0.55;
    ctx.save();
    ctx.translate(x, y);

    switch (spellKey) {
      case "plateauRenverse": {
        // Orange/gold TILTED cross (+ rotated 45°)
        ctx.fillStyle = "#CC6600";
        ctx.strokeStyle = "#663300";
        ctx.lineWidth = 1;
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.18, -s * 0.65, s * 0.36, s * 1.3);
        ctx.fillRect(-s * 0.65, -s * 0.18, s * 1.3, s * 0.36);
        ctx.restore();
        break;
      }
      case "canonCasse": {
        // TWO SUPERIMPOSED CROSSES: a + AND an X overlaid (8-point star shape)
        ctx.fillStyle = "#CC6600";
        ctx.strokeStyle = "#664400";
        ctx.lineWidth = 1;
        // Cross 1: straight +
        ctx.fillRect(-s * 0.16, -s * 0.6, s * 0.32, s * 1.2);
        ctx.fillRect(-s * 0.6, -s * 0.16, s * 1.2, s * 0.32);
        // Cross 2: diagonal X
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.16, -s * 0.6, s * 0.32, s * 1.2);
        ctx.fillRect(-s * 0.6, -s * 0.16, s * 1.2, s * 0.32);
        ctx.restore();
        break;
      }
      case "disparitionSorts": {
        // Red X cross
        ctx.fillStyle = "#CC0000";
        ctx.strokeStyle = "#660000";
        ctx.lineWidth = 1;
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.18, -s * 0.65, s * 0.36, s * 1.3);
        ctx.fillRect(-s * 0.65, -s * 0.18, s * 1.3, s * 0.36);
        ctx.restore();
        break;
      }
      case "variationCouleur": {
        // Small dark circle/dot in center
        ctx.fillStyle = "#003333";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#006666";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "boulesSupplementaires": {
        // Bright green + cross
        ctx.fillStyle = "#00CC00";
        ctx.strokeStyle = "#006600";
        ctx.lineWidth = 1;
        ctx.fillRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
        ctx.fillRect(-s * 0.6, -s * 0.18, s * 1.2, s * 0.36);
        break;
      }
      case "nukeBomb": {
        // Pink upward arrow/figure (person-like shape from reference)
        ctx.fillStyle = "#FF69B4";
        ctx.strokeStyle = "#990066";
        ctx.lineWidth = 1;
        // Upward arrow
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(-s * 0.4, -s * 0.1);
        ctx.lineTo(-s * 0.15, -s * 0.1);
        ctx.lineTo(-s * 0.15, s * 0.5);
        ctx.lineTo(s * 0.15, s * 0.5);
        ctx.lineTo(s * 0.15, -s * 0.1);
        ctx.lineTo(s * 0.4, -s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "toutesMemeCouleur": {
        // Green circle dot (defensive = green center)
        ctx.fillStyle = "#00CC00";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "nettoyage": {
        // Green horizontal bar (minus sign)
        ctx.fillStyle = "#00AA00";
        ctx.strokeStyle = "#005500";
        ctx.lineWidth = 1;
        ctx.fillRect(-s * 0.55, -s * 0.18, s * 1.1, s * 0.36);
        break;
      }
    }
    ctx.restore();
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
    ctx.textBaseline = "middle";
    // Scale font based on canvas size
    const fontSize = Math.max(12, Math.min(30, canvas.width * 0.12));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(mainText, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  },

  // Vertical grid lines for visual reference
  drawGridLines(ctx, canvas, rad) {
    const cols = Config.GRID_COLS;
    const diameter = rad * 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      const x = c * diameter;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  },

};
