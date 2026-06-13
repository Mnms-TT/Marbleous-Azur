/**
 * bubbleRenderer.js - Rendu partagé des boules, canon et effets
 * Utilisé par Drawing (salles) ET LobbyGame (échauffement accueil)
 * pour garantir un rendu strictement identique partout.
 */

export const BubbleRenderer = {
  lightenColor(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
  },

  darkenColor(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    const toHex = (num) => num.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "255, 255, 255";
  },

  drawBubble(ctx, b, rad, x, y, spellIcons = null) {
    if (!b || !b.color) return;
    if (!rad || rad < 1) return; // garde : pas de rayon nul/négatif (canvas non dimensionné)

    // === Sphère principale avec dégradé 3D ===
    const grad = ctx.createRadialGradient(
      x - rad * 0.35, y - rad * 0.35, rad * 0.05,
      x + rad * 0.1, y + rad * 0.1, rad
    );
    // Rendu plastique dur, peu diffus
    grad.addColorStop(0, this.lightenColor(b.color.main, 60));
    grad.addColorStop(0.15, b.color.main);
    grad.addColorStop(0.7, b.color.shadow);
    grad.addColorStop(1, this.darkenColor(b.color.main, 60));

    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Contour sombre marqué (comme l'original)
    ctx.beginPath();
    ctx.arc(x, y, rad - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${this.hexToRgb(this.darkenColor(b.color.main, 80))}, 0.85)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // === Symbole de sort - dessiné SOUS le reflet principal ===
    if (b.isSpellBubble && b.spell && spellIcons) {
      this.drawSpellSymbol(ctx, x, y, rad, b.spell, spellIcons);
    }

    // === Reflet spéculaire (coupure nette, effet plastique) ===
    const specGrad = ctx.createRadialGradient(
      x - rad * 0.35, y - rad * 0.35, 0,
      x - rad * 0.35, y - rad * 0.35, rad * 0.35
    );
    specGrad.addColorStop(0, "rgba(255,255,255,0.5)");
    specGrad.addColorStop(0.2, "rgba(255,255,255,0.4)");
    specGrad.addColorStop(0.3, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(x - rad * 0.35, y - rad * 0.35, rad * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // === Petit point blanc franc ===
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(
      x - rad * 0.28, y - rad * 0.32,
      rad * 0.1, rad * 0.06,
      Math.PI / 4, 0, Math.PI * 2
    );
    ctx.fill();
  },

  drawSpellSymbol(ctx, x, y, rad, spellKey, spellIcons) {
    const icon = spellIcons[spellKey];
    if (icon && icon.complete) {
      ctx.save();
      // Clip au cercle de la boule pour ne pas déborder
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.95, 0, Math.PI * 2);
      ctx.clip();

      let multiplier = 2.0;
      if (spellKey === "variationCouleur") multiplier = 2.3;

      const iconSize = rad * multiplier;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.drawImage(icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);

      ctx.restore();
    }
  },

  // Position et taille du canon : coquillage juste sous la barre, ~30% de la largeur
  computeCannonLayout(canvas, deadLineY) {
    const radius = Math.max(
      36,
      Math.min(canvas.width * 0.30, canvas.height - 30 - deadLineY - 10)
    );
    const pivotY = Math.min(canvas.height - 18, deadLineY + 12 + radius);
    return { centerX: canvas.width / 2, pivotY, radius };
  },

  // Coquillage du canon : lamelles grises pleines séparées de blanc (comme l'original)
  drawCannonShell(ctx, centerX, pivotY, radius) {
    ctx.save();

    // Dégradé métallique commun aux lamelles
    const metal = ctx.createRadialGradient(
      centerX, pivotY, radius * 0.08,
      centerX, pivotY, radius
    );
    metal.addColorStop(0, "#ececec");
    metal.addColorStop(0.65, "#c9c9c9");
    metal.addColorStop(1, "#a8a8a8");

    const petals = 9;
    const gap = 0.022; // espace blanc entre lamelles
    for (let i = 0; i < petals; i++) {
      const a0 = Math.PI + (i * Math.PI) / petals + gap;
      const a1 = Math.PI + ((i + 1) * Math.PI) / petals - gap;
      ctx.beginPath();
      ctx.moveTo(centerX, pivotY);
      ctx.arc(centerX, pivotY, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = metal;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Contour blanc du demi-cercle + base
    ctx.beginPath();
    ctx.arc(centerX, pivotY, radius, Math.PI, 0);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - radius, pivotY);
    ctx.lineTo(centerX + radius, pivotY);
    ctx.stroke();

    ctx.restore();
  },

  // Aiguille fine noire style aiguille d'horloge (verte si canon cassé)
  drawCannonNeedle(ctx, angle, pos, length, brokenCanon = false) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle + Math.PI / 2);

    const needleColor = brokenCanon ? "#10b981" : "#111111";

    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(0, -length * 1.08);
    ctx.stroke();

    // Pivot
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // Cadre blanc arrondi du plateau : montants gauche/droite + barre horizontale
  drawPlayfieldFrame(ctx, canvas, deadLineY) {
    const m = 2.5;  // marge des montants
    const r = 12;   // rayon des coins arrondis
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m, -5);
    ctx.lineTo(m, deadLineY - r);
    ctx.quadraticCurveTo(m, deadLineY, m + r, deadLineY);
    ctx.lineTo(canvas.width - m - r, deadLineY);
    ctx.quadraticCurveTo(canvas.width - m, deadLineY, canvas.width - m, deadLineY - r);
    ctx.lineTo(canvas.width - m, -5);
    ctx.stroke();
    ctx.restore();
  },

  // Tube + cercle en bas à gauche : boule à la COULEUR D'ÉQUIPE (comme l'original)
  drawTeamBubbleHolder(ctx, rad, deadLineY, pivotY, teamColorHex) {
    const circleR = rad * 1.35;
    const cx = rad * 1.9;
    const cy = Math.max(deadLineY + circleR + 14, Math.min(pivotY - 4, deadLineY + 26 + circleR));

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;

    // Tube : deux montants qui descendent de la barre vers le cercle
    ctx.beginPath();
    ctx.moveTo(cx - rad * 0.5, deadLineY);
    ctx.lineTo(cx - rad * 0.5, cy - circleR * 0.8);
    ctx.moveTo(cx + rad * 0.5, deadLineY);
    ctx.lineTo(cx + rad * 0.5, cy - circleR * 0.8);
    ctx.stroke();

    // Cercle
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    if (teamColorHex) {
      // Disque PLAT (pas une boule 3D : ça prêtait à confusion avec le jeu)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = teamColorHex;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.darkenColor(teamColorHex, 60);
      ctx.stroke();
      ctx.restore();
    }
  },

  // Prochaine boule : petite, COLLÉE au bord du coquillage en bas à droite
  // (centre posé sur le contour, ~15° au-dessus de la base) — comme l'original
  drawCannonSideInfo(ctx, canvas, centerX, pivotY, radius, rad, nextBubble, fps, spellIcons) {
    const nextRad = rad * 0.6;
    const dist = radius + nextRad * 0.5; // tangente au contour du coquillage
    const ang = 0.26; // ~15 degrés au-dessus de la ligne de base
    const nx = Math.min(centerX + Math.cos(ang) * dist, canvas.width - nextRad - 2);
    const ny = pivotY - Math.sin(ang) * dist;

    if (nextBubble) {
      this.drawBubble(ctx, nextBubble, nextRad, nx, ny, spellIcons);
    }

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 2;
    const text = `${fps} fps`;
    const tw = ctx.measureText(text).width;
    if (nx + nextRad + 4 + tw <= canvas.width - 2) {
      // À droite de la boule, sur la ligne de base (comme l'original)
      ctx.textAlign = "left";
      ctx.fillText(text, nx + nextRad + 4, pivotY - 6);
    } else {
      // Pas la place : au-dessus de la boule
      ctx.textAlign = "center";
      ctx.fillText(text, Math.min(nx, canvas.width - tw / 2 - 2), ny - nextRad - 6);
    }
    ctx.restore();
  },

  // Nom du joueur (bas gauche) + score au-dessus, comme "[DarkaL]" dans l'original
  // Le score prend la couleur d'équipe en salle
  drawPlayerLabel(ctx, canvas, name, score, scoreColor = "#ffffff") {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 3;
    if (score !== undefined && score !== null) {
      ctx.fillStyle = scoreColor;
      ctx.font = "bold 13px Arial, sans-serif";
      ctx.fillText(`${score}`, 8, canvas.height - 22);
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillText(`[${name}]`, 8, canvas.height - 6);
    ctx.restore();
  },


  drawEffect(ctx, e) {
    if (e.type === "pop") {
      const alpha = Math.max(0, e.life / 10);

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (e.color) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.hexToRgb(e.color)}, ${alpha * 0.5})`;
        ctx.fill();
      }

      const particleCount = 6;
      for (let i = 0; i < particleCount; i++) {
        const angle = ((Math.PI * 2) / particleCount) * i + e.radius * 0.1;
        const px = e.x + Math.cos(angle) * e.radius;
        const py = e.y + Math.sin(angle) * e.radius;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }
    }
  },

  // Lignes verticales de repère de la grille
  drawGridLines(ctx, canvas, rad, cols) {
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

  drawOverlayText(ctx, canvas, mainText, color) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontSize = Math.max(12, Math.min(30, canvas.width * 0.12));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(mainText, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  },
};
