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

  // Éventail radar du canon (fond + rayons)
  drawCannonFan(ctx, centerX, pivotY, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, pivotY);
    ctx.arc(centerX, pivotY, radius, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const rays = 6;
    for (let i = 0; i <= rays; i++) {
      const angle = Math.PI + (i * Math.PI) / rays;
      ctx.beginPath();
      ctx.moveTo(centerX, pivotY);
      ctx.lineTo(
        centerX + Math.cos(angle) * radius,
        pivotY + Math.sin(angle) * radius
      );
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.stroke();
    }
    ctx.restore();
  },

  drawCannonNeedle(ctx, angle, pos, length, brokenCanon = false) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle + Math.PI / 2);

    // Noir par défaut, vert si sous sort jaune (canonCasse)
    const needleColor = brokenCanon ? "#10b981" : "#1a1a1a";

    ctx.fillStyle = needleColor;
    ctx.beginPath();
    ctx.moveTo(0, -length);
    ctx.lineTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = brokenCanon ? "#064e3b" : "#000";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

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
