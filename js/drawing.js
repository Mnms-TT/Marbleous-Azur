import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { Config } from "./config.js";
import { BubbleRenderer } from "./bubbleRenderer.js";

export const Drawing = {
  frameCount: 0,

  drawAll() {
    if (!Game.localPlayer) return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;
    this.drawPlayer(Game.localPlayer, mainCanvas.getContext("2d"), true);

    // Anti-lag : les miniatures adverses n'ont pas besoin de la pleine
    // cadence — une frame sur trois suffit largement
    this.frameCount++;
    if (this.frameCount % 3 === 0) {
      Game.players.forEach((p) => {
        if (p.id !== Game.localPlayer.id && p.canvas)
          this.drawPlayer(p, p.ctx, false);
      });
    }
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

      // Indicateur PRÊT bien visible : bandeau vert + grand texte
      if (player.isReady) {
        const badgeH = Math.max(22, canvas.height * 0.22);
        ctx.fillStyle = "rgba(34, 197, 94, 0.92)";
        ctx.fillRect(0, 0, canvas.width, badgeH);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, badgeH - 2);

        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(13, Math.round(canvas.width * 0.16))}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 3;
        ctx.fillText("✓ PRÊT", canvas.width / 2, badgeH / 2);
        ctx.shadowBlur = 0;
      }
    }
  },

  drawGameState(ctx, canvas, player, rad, isMain) {
    // Calcul de la ligne de séparation (entre rangée 10 et 11)
    const deadLineY = (Config.GAME_OVER_ROW) * (rad * 1.732) + rad;

    // --- CANON COQUILLAGE (joueur principal ET miniatures, comme l'original) ---
    const layout = BubbleRenderer.computeCannonLayout(canvas, deadLineY);
    BubbleRenderer.drawCannonShell(ctx, layout.centerX, layout.pivotY, layout.radius);

    const needleAngle = player.launcher?.angle ?? -Math.PI / 2;
    BubbleRenderer.drawCannonNeedle(
      ctx,
      needleAngle,
      { x: layout.centerX, y: layout.pivotY },
      layout.radius,
      !!player.statusEffects?.canonCasse
    );

    if (isMain) {
      Game.cannonPosition = { x: layout.centerX, y: layout.pivotY };
      if (player.isAlive && !player.launcherBubble && !player.shotBubble) {
        GameLogic.loadBubbles(player);
      }

      if (player.launcherBubble)
        this.drawBubble(
          ctx,
          player.launcherBubble,
          rad,
          Game.cannonPosition.x,
          Game.cannonPosition.y
        );
      if (player.shotBubble)
        this.drawBubble(
          ctx,
          player.shotBubble,
          rad,
          player.shotBubble.x,
          player.shotBubble.y
        );

      // Prochaine boule (bien visible) + fps, à droite du coquillage
      BubbleRenderer.drawCannonSideInfo(
        ctx, canvas, layout.centerX, layout.pivotY, layout.radius,
        rad, player.nextBubble || null, Game.targetFPS, Game.spellIcons
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

    // --- CADRE BLANC ARRONDI + tube/cercle avec la boule COULEUR D'ÉQUIPE ---
    BubbleRenderer.drawPlayfieldFrame(ctx, canvas, deadLineY);
    BubbleRenderer.drawTeamBubbleHolder(
      ctx, rad, deadLineY, layout.pivotY,
      Config.TEAM_COLORS[player.team || 0]
    );

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

    if (rotationApplied) ctx.restore();

    // Messages de sorts reçus : texte blanc défilant au-dessus de la ligne de mort
    if (isMain && player.spellTickers && player.spellTickers.length) {
      ctx.save();
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;
      player.spellTickers.forEach((t) => {
        ctx.fillText(t.text, t.x, deadLineY - 6);
      });
      ctx.restore();
    }

    // Nom + score (couleur d'équipe), en bas à gauche comme "[DarkaL]" dans l'original
    const teamColor = Config.TEAM_COLORS[player.team || 0];
    BubbleRenderer.drawPlayerLabel(ctx, canvas, player.name || "Joueur", player.score || 0, teamColor);

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
    BubbleRenderer.drawBubble(ctx, b, rad, x, y, Game.spellIcons);
  },

  lightenColor(hex, amount) {
    return BubbleRenderer.lightenColor(hex, amount);
  },

  darkenColor(hex, amount) {
    return BubbleRenderer.darkenColor(hex, amount);
  },

  drawSpellSymbol(ctx, x, y, rad, spellKey) {
    BubbleRenderer.drawSpellSymbol(ctx, x, y, rad, spellKey, Game.spellIcons);
  },

  drawCannonNeedle(ctx, player, pos, length) {
    BubbleRenderer.drawCannonNeedle(
      ctx,
      player.launcher.angle,
      pos,
      length,
      !!player.statusEffects?.canonCasse
    );
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
    BubbleRenderer.drawEffect(ctx, e);
  },

  hexToRgb(hex) {
    return BubbleRenderer.hexToRgb(hex);
  },

  drawOverlayText(ctx, canvas, mainText, color) {
    BubbleRenderer.drawOverlayText(ctx, canvas, mainText, color);
  },

  // Vertical grid lines for visual reference
  drawGridLines(ctx, canvas, rad) {
    BubbleRenderer.drawGridLines(ctx, canvas, rad, Config.GRID_COLS);
  },

};
