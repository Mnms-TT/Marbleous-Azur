import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { UI } from "./ui.js";

export const GameLogic = {
  // Création d'une grille vide
  createEmptyGrid: () =>
    Array.from({ length: Config.GRID_ROWS }, () =>
      Array(Config.GRID_COLS).fill(null)
    ),

  // Création de la grille de départ avec sécurité Anti-Gravité
  createInitialGrid: () => {
    const grid = GameLogic.createEmptyGrid();

    // 1. Remplissage initial (3 rangées max) :
    // La ligne 0 (Plafond) est remplie à 100% pour servir d'ancrage
    for (let c = 0; c < Config.GRID_COLS; c++) {
      grid[0][c] = GameLogic.createBubble(0, c);
    }

    // Lignes 1-2 : denses
    for (let r = 1; r < 3; r++) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (Math.random() > 0.3) {
          grid[r][c] = GameLogic.createBubble(r, c);
        }
      }
    }

    // 2. NETTOYAGE GRAVITÉ (Suppression immédiate des boules volantes)
    // On lance un parcours pour identifier toutes les boules reliées au plafond
    const connected = new Set();
    const queue = [];

    // Départ du parcours : Toute la ligne 0
    for (let c = 0; c < Config.GRID_COLS; c++) {
      if (grid[0][c]) {
        queue.push({ r: 0, c: c });
        connected.add(`0,${c}`);
      }
    }

    // Propagation (BFS) pour trouver les voisins connectés
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];

      // Calcul des voisins
      const odd = curr.r % 2 !== 0;
      const dirs = [
        { r: -1, c: odd ? 0 : -1 },
        { r: -1, c: odd ? 1 : 0 },
        { r: 0, c: -1 },
        { r: 0, c: 1 },
        { r: 1, c: odd ? 0 : -1 },
        { r: 1, c: odd ? 1 : 0 },
      ];

      for (const d of dirs) {
        const nr = curr.r + d.r;
        const nc = curr.c + d.c;
        // Si la case est valide
        if (
          nr >= 0 &&
          nr < Config.GRID_ROWS &&
          nc >= 0 &&
          nc < Config.GRID_COLS
        ) {
          // Si elle contient une boule et n'a pas encore été visitée
          if (grid[nr][nc] && !connected.has(`${nr},${nc}`)) {
            connected.add(`${nr},${nc}`);
            queue.push({ r: nr, c: nc });
          }
        }
      }
    }

    // Suppression des orphelines (celles qui ne sont pas dans le Set 'connected')
    for (let r = 0; r < Config.GRID_ROWS; r++) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (grid[r][c] && !connected.has(`${r},${c}`)) {
          grid[r][c] = null;
        }
      }
    }

    return grid;
  },

  createBubble: (r, c, color = null, spell = null) => ({
    r,
    c,
    color:
      color ||
      Config.BUBBLE_COLORS[
      Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
      ],
    spell,
    isSpellBubble: !!spell,
    isStatic: true,
  }),

  // Animation PLUIE du Lobby (Ecran d'accueil)
  updateLobbyAnimation() {
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    // Initialisation des billes de pluie si nécessaire
    if (!Game.lobbyMarbles || Game.lobbyMarbles.length === 0) {
      Game.lobbyMarbles = [];
      for (let i = 0; i < 35; i++) {
        Game.lobbyMarbles.push({
          x: Math.random() * mainCanvas.width,
          y: Math.random() * mainCanvas.height,
          r: Math.random() * 8 + 4,
          vy: Math.random() * 2 + 1, // Vitesse de chute
          color:
            Config.BUBBLE_COLORS[
            Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
            ],
        });
      }
    }

    // Mise à jour positions
    Game.lobbyMarbles.forEach((marble) => {
      marble.y += marble.vy;
      // Si sort en bas, revient en haut
      if (marble.y - marble.r > mainCanvas.height) {
        marble.y = -marble.r;
        marble.x = Math.random() * mainCanvas.width;
      }
    });
  },

  // Chargement du canon
  loadBubbles: (player) => {
    if (!player?.isAlive) return;
    player.launcherBubble = player.nextBubble || GameLogic.createBubble(-1, -1);
    player.launcherBubble.isStatic = true;
    player.nextBubble = GameLogic.createBubble(-1, -1);
  },

  // Gestion du tir et de l'impact
  async snapBubble(player, shotBubble) {
    if (!player || !shotBubble) return;
    player.shotBubble = null;

    let bestSpot = this.findBestSnapSpot(player, shotBubble);
    if (bestSpot) {
      const { r, c } = bestSpot;
      player.grid[r][c] = this.createBubble(r, c, shotBubble.color);
      const matches = this.findMatches(player.grid, r, c);

      // Si combo >= 3
      if (matches.length >= 3) {
        let cleared = matches.length;

        // Suppression des boules matchées
        matches.forEach((b) => {
          const { x, y } = this.getBubbleCoords(b.r, b.c, Game.bubbleRadius);
          player.effects.push({
            x,
            y,
            type: "pop",
            radius: Game.bubbleRadius,
            life: 25, // Increased from 10
          });
          player.grid[b.r][b.c] = null;
        });

        // Gestion de l'avalanche (boules qui tombent)
        const avalanche = this.handleAvalanche(player, player.grid, true);
        cleared += avalanche;

        // Apparition potentielle d'un sort dans la grille restante
        if (Math.random() < Config.SPELL_SPAWN_CHANCE)
          this.spawnSpellBubble(player);

        // Mise à jour score et attaque
        await FirebaseController.updatePlayerDoc(player.id, {
          score: player.score + cleared * 10 + Math.pow(avalanche, 2) * 10,
          attackBubbleCounter: player.attackBubbleCounter + cleared,
          grid: JSON.stringify(player.grid),
          spells: player.spells,
        });
      } else {
        // Pas de combo, juste mise à jour de la grille
        await FirebaseController.updatePlayerDoc(player.id, {
          grid: JSON.stringify(player.grid),
        });
      }
    }
    await this.checkGameOver(player);
  },

  // Gestion des attaques (envoi de boules aux ennemis)
  async triggerGlobalAttack() {
    if (Game.state !== "playing") return;

    for (const player of Game.players.values()) {
      if (player.isAlive && player.attackBubbleCounter >= 10) {
        const attackUnits = Math.floor(player.attackBubbleCounter / 10);
        const attackSize = attackUnits * Math.floor(player.level);

        if (attackSize > 0) {
          // Cibler UNIQUEMENT les ennemis (équipe différente)
          const enemies = Array.from(Game.players.values()).filter(
            (p) => p.id !== player.id && p.isAlive && p.team !== player.team
          );

          for (const enemy of enemies) {
            this.addJunkBubbles(enemy, attackSize);
          }
        }

        await FirebaseController.updatePlayerDoc(player.id, {
          attackBubbleCounter: player.attackBubbleCounter % 10,
        });
      }
    }
  },

  addJunkBubbles(target, junkCount) {
    const grid = target.grid;

    // Trouver les slots vides adjacents au bas des bulles existantes
    // (slots qui ont un voisin au-dessus ou diagonal-haut)
    const validSlots = [];

    for (let r = 1; r < Config.GRID_ROWS; r++) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (!grid[r][c]) {
          // Vérifier si une bulle existe au-dessus (directement ou en diagonal)
          const isOdd = r % 2 === 1;
          const neighbors = [
            { r: r - 1, c: c },     // Directement au-dessus
            { r: r - 1, c: isOdd ? c + 1 : c - 1 }  // Diagonal au-dessus
          ];

          const hasNeighborAbove = neighbors.some(n =>
            n.r >= 0 && n.c >= 0 && n.c < Config.GRID_COLS && grid[n.r]?.[n.c]
          );

          if (hasNeighborAbove) {
            validSlots.push({ r, c });
          }
        }
      }
    }

    // Mélanger et prendre les premiers slots
    validSlots.sort(() => Math.random() - 0.5);
    const toAdd = Math.min(validSlots.length, junkCount);

    for (let i = 0; i < toAdd; i++) {
      const s = validSlots[i];
      grid[s.r][s.c] = this.createBubble(s.r, s.c);
    }

    FirebaseController.updatePlayerDoc(target.id, {
      grid: JSON.stringify(grid),
    });
  },

  levelUp: () => {
    if (Game.state === "playing" && Game.localPlayer) {
      const newLevel = Game.localPlayer.level + 1;
      FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
        level: newLevel,
      });
      // Annoncer le niveau
      UI.showAnnouncement(`⬆️ NIVEAU ${newLevel}`);
    }
  },

  // Animations locales (Mouvement de la boule tirée)
  updateLocalAnimations() {
    if (!Game.localPlayer) return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    this.processStatusEffects(Game.localPlayer);

    // Effets visuels (pops)
    Game.players.forEach((p) =>
      p.effects.forEach((e, i) => {
        e.life--;
        if (e.type === "pop") e.radius += 0.25; // Slower expansion
        if (e.life <= 0) p.effects.splice(i, 1);
      })
    );

    // Rotation Canon
    let rotSpeed = Game.currentRotationSpeed;
    const canonEffect = Game.localPlayer.statusEffects.canonCasse;

    if (canonEffect) {
      const variant = canonEffect.variant || 0;

      switch (variant) {
        case 0: // Inversé - gauche/droite inversés
          if (Game.keys.left) Game.localPlayer.launcher.angle += rotSpeed;
          if (Game.keys.right) Game.localPlayer.launcher.angle -= rotSpeed;
          break;
        case 1: // Bloqué - ne peut pas bouger
          // On ne fait rien, pas de rotation
          break;
        case 2: // Aléatoire - mouvement erratique
          rotSpeed *= 0.4;
          Game.localPlayer.launcher.angle += (Math.random() - 0.5) * 0.08;
          if (Game.keys.left) Game.localPlayer.launcher.angle -= rotSpeed;
          if (Game.keys.right) Game.localPlayer.launcher.angle += rotSpeed;
          break;
        case 3: // Auto-tir - tire aléatoirement
          if (Game.keys.left) Game.localPlayer.launcher.angle -= rotSpeed;
          if (Game.keys.right) Game.localPlayer.launcher.angle += rotSpeed;
          // Tir automatique toutes les 2-4 secondes environ
          if (!canonEffect.nextAutoFire) {
            canonEffect.nextAutoFire = Date.now() + 2000 + Math.random() * 2000;
          }
          if (Date.now() > canonEffect.nextAutoFire && !Game.localPlayer.shotBubble && Game.localPlayer.launcherBubble) {
            this.shoot(Game.localPlayer);
            canonEffect.nextAutoFire = Date.now() + 2000 + Math.random() * 2000;
          }
          break;
      }
    } else {
      // Contrôles normaux
      if (Game.keys.left) Game.localPlayer.launcher.angle -= rotSpeed;
      if (Game.keys.right) Game.localPlayer.launcher.angle += rotSpeed;
    }

    // Limites de rotation
    Game.localPlayer.launcher.angle = Math.max(
      -Math.PI + 0.1,
      Math.min(-0.1, Game.localPlayer.launcher.angle)
    );

    // Mouvement boule tirée
    if (Game.localPlayer.shotBubble) {
      let b = Game.localPlayer.shotBubble;
      b.vx = b.vx || 0;
      b.vy = b.vy || 0;

      // Effet plateau renversé - gravité latérale basée sur l'angle de rotation
      if (Game.localPlayer.statusEffects.plateauRenverse) {
        const rotAngle = Game.localPlayer.statusEffects.plateauRenverse.angle || 0;
        const gravityEffect = Math.sin(rotAngle * Math.PI / 180) * 0.3;
        b.vx += gravityEffect;
      }

      b.x += b.vx;
      b.y += b.vy;

      // Rebond Mur Haut (Plafond)
      let collided = b.y - Game.bubbleRadius < 0;

      // Collision avec grille
      if (!collided)
        for (let r = 0; r < Config.GRID_ROWS; r++) {
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (Game.localPlayer.grid[r][c]) {
              const coords = this.getBubbleCoords(r, c, Game.bubbleRadius);
              if (
                Math.hypot(b.x - coords.x, b.y - coords.y) <
                Game.bubbleRadius * 1.8
              ) {
                collided = true;
                break;
              }
            }
          if (collided) break;
        }

      if (collided) {
        this.snapBubble(Game.localPlayer, b);
        return;
      }

      // Rebond Murs Latéraux
      if (
        b.x - Game.bubbleRadius < 0 ||
        b.x + Game.bubbleRadius > mainCanvas.width
      )
        b.vx *= -1;
    }

    // Boules qui tombent (avalanche)
    Game.players.forEach((p) =>
      p.fallingBubbles.forEach((b, i) => {
        b.vy += 0.5;
        b.y += b.vy;
        b.x += b.vx;
        if (b.y > mainCanvas.height + 100) p.fallingBubbles.splice(i, 1);
      })
    );

    // Boules entrantes (sort boulesSupplementaires)
    Game.players.forEach((p) => {
      if (!p.incomingBubbles) p.incomingBubbles = [];

      p.incomingBubbles.forEach((b, i) => {
        const targetY = this.getBubbleCoords(b.targetRow, b.targetCol, Game.bubbleRadius).y;

        b.y += b.vy;

        // Si la bulle atteint sa destination
        if (b.y >= targetY) {
          // Décaler d'abord toutes les bulles vers le bas pour faire de la place
          if (b.targetRow === 0) {
            // Décaler la grille vers le bas
            for (let r = Config.GRID_ROWS - 1; r > 0; r--) {
              for (let c = 0; c < Config.GRID_COLS; c++) {
                p.grid[r][c] = p.grid[r - 1][c];
                if (p.grid[r][c]) p.grid[r][c].r = r;
              }
            }
            // Nouvelle ligne vide en haut
            for (let c = 0; c < Config.GRID_COLS; c++) {
              p.grid[0][c] = null;
            }
          }

          // Placer la bulle dans la grille
          p.grid[b.targetRow][b.targetCol] = {
            color: b.color,
            r: b.targetRow,
            c: b.targetCol,
          };

          // Retirer de la liste
          p.incomingBubbles.splice(i, 1);
        }
      });
    });
  },

  processStatusEffects(player) {
    let changed = false;
    const now = Date.now();
    for (const key in player.statusEffects)
      if (now > player.statusEffects[key].endTime) {
        delete player.statusEffects[key];
        changed = true;
      }
    if (changed && player.id === Game.localPlayer.id)
      FirebaseController.updatePlayerDoc(player.id, {
        statusEffects: player.statusEffects,
      });
    if (player.statusEffects.variationCouleur) {
      // La couleur de la bulle à tirer change constamment
      player.variationColorTimer = (player.variationColorTimer || 0) + 1;
      if (
        player.variationColorTimer % (Config.FPS / 2) === 0 &&
        player.launcherBubble
      )
        player.launcherBubble.color =
          Config.BUBBLE_COLORS[
          Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
          ];
    }
  },

  // --- LOGIQUE DES SORTS ---
  async castSpecificSpell(targetPlayer, spellIndex) {
    if (
      !Game.localPlayer ||
      spellIndex === null ||
      spellIndex < 0 ||
      spellIndex >= Game.localPlayer.spells.length ||
      !targetPlayer
    )
      return;
    const spellName = Game.localPlayer.spells[spellIndex];
    Game.localPlayer.spells.splice(spellIndex, 1); // FIFO

    await FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
      spells: Game.localPlayer.spells,
    });
    UI.updateSpellAnnouncement(
      Game.localPlayer.name,
      Config.SPELLS[spellName],
      targetPlayer.name
    );
    await this.applySpellEffect(targetPlayer, spellName);
  },

  async applySpellEffect(target, spell) {
    if (!target?.isAlive || !spell) return;

    // Si le sort est reçu par le joueur local, déclencher le tremblement
    if (target.id === Game.localPlayer.id) {
      UI.triggerShake(1);
    }

    const DURATION = 10000;
    let effects = { ...target.statusEffects };
    let gridChanged = false,
      spellsChanged = false;
    let grid = target.grid.map((r) => [...r]);

    switch (spell) {
      // SORTS OFFENSIFS
      case "plateauRenverse":
        // Rotation du plateau entre 10 et 40 degrés
        const rotationAngle = (10 + Math.random() * 30) * (Math.random() < 0.5 ? -1 : 1);
        effects.plateauRenverse = {
          endTime: Date.now() + DURATION,
          angle: rotationAngle, // Angle en degrés
          direction: rotationAngle > 0 ? 1 : -1,
        };
        break;

      case "canonCasse": {
        // 4 variantes du sort jaune
        // 0: inversé (gauche/droite inversés)
        // 1: bloqué (ne peut pas bouger)
        // 2: aléatoire (mouvement erratique) 
        // 3: auto-tir (tire aléatoirement)
        const variant = Math.floor(Math.random() * 4);
        effects.canonCasse = {
          endTime: Date.now() + DURATION,
          variant: variant
        };
        break;
      }

      case "disparitionSorts":
        // Supprime 1 sort de la file + toutes les bulles sorts à l'écran
        if (target.spells.length > 0) {
          target.spells.shift();
          spellsChanged = true;
        }
        for (let r = 0; r < Config.GRID_ROWS; r++)
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (grid[r][c]?.isSpellBubble) {
              grid[r][c].isSpellBubble = false;
              grid[r][c].spell = null;
              gridChanged = true;
            }
        break;

      case "variationCouleur":
        // Change immédiatement TOUTES les couleurs des bulles du plateau (y compris sorts)
        for (let r = 0; r < Config.GRID_ROWS; r++) {
          for (let c = 0; c < Config.GRID_COLS; c++) {
            if (grid[r][c]) {
              // Nouvelle couleur aléatoire
              const newColorIndex = Math.floor(Math.random() * Config.BUBBLE_COLORS.length);
              grid[r][c].color = Config.BUBBLE_COLORS[newColorIndex];
            }
          }
        }
        gridChanged = true;
        // Aussi la couleur de la bulle à tirer change constamment
        effects.variationCouleur = { endTime: Date.now() + DURATION };
        break;


      case "boulesSupplementaires": {
        // Ajoute 1-2 rangées de bulles EN HAUT (pousse le plateau vers le bas)
        // C'est l'inverse du sort nuke

        // D'abord décaler toutes les lignes vers le BAS
        for (let r = Config.GRID_ROWS - 1; r > 0; r--) {
          for (let c = 0; c < Config.GRID_COLS; c++) {
            grid[r][c] = grid[r - 1][c];
            if (grid[r][c]) grid[r][c].r = r;
          }
        }

        // Ajouter une nouvelle ligne EN HAUT (row 0) avec des bulles partielles (70%)
        for (let c = 0; c < Config.GRID_COLS; c++) {
          if (Math.random() < 0.7) {
            grid[0][c] = this.createBubble(0, c);
          } else {
            grid[0][c] = null;
          }
        }

        gridChanged = true;
        break;
      }

      // SORTS DÉFENSIFS
      case "nukeBomb": {
        // Élimine beaucoup de bulles (30-80% aléatoire)
        const bubbles = [];
        for (let r = 0; r < Config.GRID_ROWS; r++)
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (grid[r][c]) bubbles.push({ r, c });
        const destroyPercent = 0.3 + Math.random() * 0.5; // 30% à 80%
        const toDestroy = Math.floor(bubbles.length * destroyPercent);
        bubbles.sort(() => 0.5 - Math.random());
        for (let i = 0; i < toDestroy; i++) {
          const b = bubbles[i];
          const { x, y } = this.getBubbleCoords(b.r, b.c, Game.bubbleRadius);
          (target.effects = target.effects || []).push({
            x, y,
            type: "pop",
            radius: Game.bubbleRadius,
            life: 30, // Increased for nuke
            color: "#af00c1",
          });
          grid[b.r][b.c] = null;
        }
        this.handleAvalanche({ grid }, grid, false);
        gridChanged = true;
        break;
      }

      case "toutesMemeCouleur": {
        // Certaines bulles deviennent de la même couleur
        const bubbles = [];
        for (let r = 0; r < Config.GRID_ROWS; r++)
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (grid[r][c] && !grid[r][c].isSpellBubble)
              bubbles.push(grid[r][c]);
        if (bubbles.length > 0) {
          const newColor = Config.BUBBLE_COLORS[
            Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
          ];
          // Change 30-60% des bulles
          const toChange = Math.floor(bubbles.length * (0.3 + Math.random() * 0.3));
          bubbles.sort(() => 0.5 - Math.random());
          for (let i = 0; i < toChange; i++) {
            bubbles[i].color = newColor;
          }
          gridChanged = true;
        }
        break;
      }

      case "nettoyage": {
        // Supprime 2-3 rangées du bas ET donne les sorts présents
        const rowsToRemove = 2 + Math.floor(Math.random() * 2); // 2 ou 3
        let rowsCleared = 0;
        target.spells = target.spells || [];

        for (let r = Config.GRID_ROWS - 1; r >= 0 && rowsCleared < rowsToRemove; r--) {
          const hasBubble = grid[r].some((cell) => cell !== null);
          if (hasBubble) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
              const bubble = grid[r][c];
              if (bubble) {
                // Collecter les sorts présents dans les rangées supprimées
                if (bubble.isSpellBubble && bubble.spell) {
                  if (target.spells.length < Config.MAX_SPELLS) {
                    target.spells.push(bubble.spell);
                    spellsChanged = true;
                  }
                }
                grid[r][c] = null;
              }
            }
            rowsCleared++;
          }
        }
        if (rowsCleared > 0) {
          this.handleAvalanche({ grid, spells: target.spells }, grid, true);
          gridChanged = true;
        }
        break;
      }
    }

    const updateData = { statusEffects: effects };
    if (gridChanged) updateData.grid = JSON.stringify(grid);
    if (spellsChanged) updateData.spells = target.spells;
    await FirebaseController.updatePlayerDoc(target.id, updateData);
    if (target.id === Game.localPlayer.id && gridChanged) {
      Game.localPlayer.grid = grid;
      await this.checkGameOver(Game.localPlayer);
    }
  },

  // --- OUTILS MATH ---
  getBubbleCoords: (r, c, rad) => ({
    x: rad + c * rad * 2 + (r % 2) * rad,
    y: rad + r * rad * 2 * 0.866,
  }),

  getNeighborCoords(r, c) {
    const odd = r % 2 !== 0,
      n = [];
    const dirs = [
      { dr: -1, dc: odd ? 0 : -1 },
      { dr: -1, dc: odd ? 1 : 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: odd ? 0 : -1 },
      { dr: 1, dc: odd ? 1 : 0 },
    ];
    for (const d of dirs) {
      const nr = r + d.dr,
        nc = c + d.dc;
      if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS)
        n.push({ r: nr, c: nc });
    }
    return n;
  },

  findBestSnapSpot(player, bubble) {
    let best = null,
      minD = Infinity;
    const rad = Game.bubbleRadius;
    for (let r = 0; r < Config.GRID_ROWS; r++)
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (!player.grid[r][c]) {
          if (
            r === 0 ||
            this.getNeighborCoords(r, c).some((n) => player.grid[n.r]?.[n.c])
          ) {
            const { x, y } = this.getBubbleCoords(r, c, rad);
            const d = Math.hypot(bubble.x - x, bubble.y - y);
            if (d < minD) {
              minD = d;
              best = { r, c };
            }
          }
        }
    if (!best) {
      let cCol = -1,
        cDist = Infinity;
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (!player.grid[0][c]) {
          const { x } = this.getBubbleCoords(0, c, rad);
          const d = Math.abs(bubble.x - x);
          if (d < cDist) {
            cDist = d;
            cCol = c;
          }
        }
      if (cCol !== -1) best = { r: 0, c: cCol };
    }
    return best;
  },

  findMatches(grid, r, c) {
    const start = grid[r]?.[c];
    if (!start) return [];
    const q = [start],
      visited = new Set([`${r},${c}`]),
      matches = [start];
    while (q.length > 0) {
      const curr = q.pop();
      for (const n of this.getNeighborCoords(curr.r, curr.c)) {
        const neighbor = grid[n.r]?.[n.c];
        if (
          neighbor &&
          !visited.has(`${n.r},${n.c}`) &&
          neighbor.color.main === start.color.main
        ) {
          visited.add(`${n.r},${n.c}`);
          q.push(neighbor);
          matches.push(neighbor);
        }
      }
    }
    return matches;
  },

  findFloatingBubbles(grid) {
    const connected = new Set(),
      q = [];
    for (let c = 0; c < Config.GRID_COLS; c++)
      if (grid[0][c]) {
        q.push(grid[0][c]);
        connected.add(`0,${c}`);
      }
    let head = 0;
    while (head < q.length) {
      const curr = q[head++];
      for (const n of this.getNeighborCoords(curr.r, curr.c)) {
        const neighbor = grid[n.r]?.[n.c];
        if (neighbor && !connected.has(`${n.r},${n.c}`)) {
          connected.add(`${n.r},${n.c}`);
          q.push(neighbor);
        }
      }
    }
    const floating = [];
    for (let r = 0; r < Config.GRID_ROWS; r++)
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (grid[r][c] && !connected.has(`${r},${c}`))
          floating.push(grid[r][c]);
    return floating;
  },

  handleAvalanche(player, grid, animate) {
    const floating = this.findFloatingBubbles(grid);
    floating.forEach((b) => {
      if (b.isSpellBubble && b.spell) {
        player.spells = player.spells || [];
        if (player.spells.length < Config.MAX_SPELLS)
          player.spells.push(b.spell);
      }
      if (animate) {
        const { x, y } = this.getBubbleCoords(b.r, b.c, Game.bubbleRadius);
        (player.fallingBubbles = player.fallingBubbles || []).push({
          ...b,
          x,
          y,
          vy: 0,
          vx: (Math.random() - 0.5) * 2,
        });
      }
      grid[b.r][b.c] = null;
    });
    return floating.length;
  },

  async spawnSpellBubble(player) {
    // Privilégier les bulles du bas (rangées 6-11)
    let bubbles = player.grid
      .flat()
      .filter((b) => b && !b.isSpellBubble && b.r > 5);

    // Si pas assez de bulles en bas, prendre toutes les bulles
    if (bubbles.length < 3) {
      bubbles = player.grid
        .flat()
        .filter((b) => b && !b.isSpellBubble);
    }

    if (bubbles.length > 0) {
      // Choisir une bulle aléatoire
      const target = bubbles[Math.floor(Math.random() * bubbles.length)];

      // Le sort est déterminé par la COULEUR de la bulle
      const spell = Config.COLOR_TO_SPELL_MAP[target.color.main];
      if (spell) {
        target.spell = spell;
        target.isSpellBubble = true;

        await FirebaseController.updatePlayerDoc(player.id, {
          grid: JSON.stringify(player.grid),
        });
      }
    }
  },

  async checkGameOver(player) {
    if (player.isAlive) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (player.grid[Config.GAME_OVER_ROW][c])
          return await this.forceGameOver(player);
      }
    }
  },
  async forceGameOver(player) {
    if (player.isAlive)
      await FirebaseController.updatePlayerDoc(player.id, { isAlive: false });
  },

  startHeartbeat() {
    if (Game.heartbeatInterval) clearInterval(Game.heartbeatInterval);
    Game.heartbeatInterval = setInterval(() => {
      if (Game.localPlayer && FirebaseController.auth.currentUser) {
        FirebaseController.updatePlayerDoc(FirebaseController.auth.currentUser.uid, {
          lastActive: Date.now()
        });
      }
    }, 30000); // Heartbeat toutes les 30 secondes (économie de quota)
  }
};
