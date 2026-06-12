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
      // Moins de boules en même temps, mais plus grosses
      for (let i = 0; i < 20; i++) {
        Game.lobbyMarbles.push({
          x: Math.random() * mainCanvas.width,
          y: Math.random() * mainCanvas.height,
          r: (Game.bubbleRadius || 14) * 1.8, // Plus grosses
          vy: Math.random() * 1 + 0.5, // Vitesse de chute plus lente
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
        marble.y = -marble.r * 2;
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

  // Tir (clavier via InputHandler, ou auto-tir du sort canonCasse)
  shoot(player) {
    if (
      Game.state !== "playing" ||
      !player?.isAlive ||
      !player.launcherBubble ||
      player.shotBubble
    )
      return;

    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    player.shotBubble = player.launcherBubble;
    player.launcherBubble = null;

    const speed = Game.bubbleRadius * 0.6;
    player.shotBubble.isStatic = false;
    player.shotBubble.vx = Math.cos(player.launcher.angle) * speed;
    player.shotBubble.vy = Math.sin(player.launcher.angle) * speed;

    const startPos = Game.cannonPosition || {
      x: mainCanvas.width / 2,
      y: mainCanvas.height - 50,
    };
    player.shotBubble.x = startPos.x;
    player.shotBubble.y = startPos.y;

    FirebaseController.updatePlayerDoc(player.id, { lastActive: Date.now() });
    this.loadBubbles(player);
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

        // Gestion de l'avalanche (boules qui tombent + sorts récupérés)
        const avalanche = this.handleAvalanche(player, player.grid, true);
        cleared += avalanche;
        // Sorts éventuellement ramassés pendant l'avalanche → barre à jour
        UI.updateSpellsBar();

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

  // Gestion des attaques (redistribution basée sur le niveau).
  // Chaque client ne traite que SON compteur : sinon chaque client enverrait
  // l'attaque de tous les joueurs et tout serait multiplié.
  async triggerGlobalAttack() {
    if (Game.state !== "playing") return;
    const player = Game.localPlayer;
    if (!player?.isAlive || player.attackBubbleCounter < 10) return;

    const attackUnits = Math.floor(player.attackBubbleCounter / 10);

    // Coefficient de redistribution basé sur le niveau
    const level = player.level || 1;
    const coef = Config.BASE_REDISTRIBUTION_COEF + (level - 1) * Config.REDISTRIBUTION_COEF_PER_LEVEL;
    const attackSize = Math.max(1, Math.floor(attackUnits * coef * 10));

    if (attackSize > 0) {
      // Cibler UNIQUEMENT les ennemis (équipe différente)
      const enemies = Array.from(Game.players.values()).filter(
        (p) => p.id !== player.id && p.isAlive && p.team !== player.team
      );

      for (const enemy of enemies) {
        // Événement : la machine de la victime anime l'arrivée par la gauche
        // et applique elle-même (différé si elle tremble)
        FirebaseController.sendEventToPlayer(enemy.id, {
          type: "junk",
          count: attackSize,
          from: player.name,
        });
      }
    }

    await FirebaseController.updatePlayerDoc(player.id, {
      attackBubbleCounter: player.attackBubbleCounter % 10,
    });
  },

  // Réception de boules adverses : PERDUES pendant le tremblement (le shake
  // est un vrai gain de temps, pas un report), sinon arrivée animée par la gauche
  receiveJunk(count) {
    const p = Game.localPlayer;
    if (!p?.isAlive) return;
    if (p.shakeProtectionUntil && Date.now() < p.shakeProtectionUntil) return;

    // Cases libres accrochables, en haut d'abord (comme avant)
    const validSlots = [];
    for (let r = 0; r < Config.GRID_ROWS; r++) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (!p.grid[r][c]) {
          if (r === 0 || this.getNeighborCoords(r, c).some(n => p.grid[n.r]?.[n.c])) {
            validSlots.push({ r, c });
          }
        }
      }
    }
    validSlots.sort((a, b) => a.r - b.r);

    p.incomingBubbles = p.incomingBubbles || [];
    const toAdd = Math.min(validSlots.length, count);
    for (let i = 0; i < toAdd; i++) {
      const s = validSlots[i];
      const bubble = this.createBubble(s.r, s.c);
      const { y } = this.getBubbleCoords(s.r, s.c, Game.bubbleRadius);
      p.incomingBubbles.push({
        ...bubble,
        targetRow: s.r,
        targetCol: s.c,
        x: -Game.bubbleRadius * (2 + i * 2.5),
        y,
        vx: Game.bubbleRadius * 0.45,
        fromLeft: true,
      });
    }
  },

  levelUp: () => {
    if (Game.state === "playing" && Game.localPlayer) {
      const newLevel = Game.localPlayer.level + 1;
      FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
        level: newLevel,
      });
      UI.showLevelAnnouncement(newLevel);
    }
  },

  // Animations locales (Mouvement de la boule tirée)
  updateLocalAnimations() {
    if (!Game.localPlayer) return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;

    this.processStatusEffects(Game.localPlayer);

    // Messages de sorts reçus : défilement droite → gauche au-dessus de la ligne
    const tickers = Game.localPlayer.spellTickers;
    if (tickers && tickers.length) {
      for (let i = tickers.length - 1; i >= 0; i--) {
        tickers[i].x -= 1.5;
        if (tickers[i].x < -400) tickers.splice(i, 1);
      }
    }

    // Effets visuels (pops) — parcours arrière : suppression sûre pendant l'itération
    Game.players.forEach((p) => {
      for (let i = p.effects.length - 1; i >= 0; i--) {
        const e = p.effects[i];
        e.life--;
        if (e.type === "pop") e.radius += 0.25; // Slower expansion
        if (e.life <= 0) p.effects.splice(i, 1);
      }
    });

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

      // Plateau renversé : la "gravité" suit l'inclinaison du plateau —
      // le tir est dévié en courbe au lieu de filer droit
      if (Game.localPlayer.statusEffects.plateauRenverse) {
        const rot = (Game.localPlayer.statusEffects.plateauRenverse.angle || 0) * Math.PI / 180;
        const g = Game.bubbleRadius * 0.045;
        b.vx += Math.sin(rot) * g;
        b.vy += (1 - Math.cos(rot)) * g; // léger tassement vertical de la gravité inclinée
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

    // Boules qui tombent (avalanche) — parcours arrière
    Game.players.forEach((p) => {
      for (let i = p.fallingBubbles.length - 1; i >= 0; i--) {
        const b = p.fallingBubbles[i];
        b.vy += 0.15; // Reduced gravity from 0.5
        b.y += b.vy;
        b.x += b.vx;
        if (b.y > mainCanvas.height + 100) p.fallingBubbles.splice(i, 1);
      }
    });

    // Boules entrantes (attaques adverses : arrivent par la gauche / sort boulesSupplementaires)
    Game.players.forEach((p) => {
      if (!p.incomingBubbles) p.incomingBubbles = [];

      for (let i = p.incomingBubbles.length - 1; i >= 0; i--) {
        const b = p.incomingBubbles[i];

        // Boules d'attaque : vol horizontal depuis le bord gauche jusqu'à leur case
        if (b.fromLeft) {
          const target = this.getBubbleCoords(b.targetRow, b.targetCol, Game.bubbleRadius);
          b.x += b.vx;
          if (b.x >= target.x) {
            p.incomingBubbles.splice(i, 1);
            let spot = { r: b.targetRow, c: b.targetCol };
            // Si la case a été prise entre-temps, accrocher au plus proche
            if (p.grid[spot.r][spot.c]) {
              const fallback = this.findBestSnapSpot(p, { x: target.x, y: target.y });
              if (!fallback) continue;
              spot = fallback;
            }
            p.grid[spot.r][spot.c] = {
              ...b,
              r: spot.r,
              c: spot.c,
              isStatic: true,
            };
            delete p.grid[spot.r][spot.c].targetRow;
            delete p.grid[spot.r][spot.c].targetCol;
            delete p.grid[spot.r][spot.c].fromLeft;
            delete p.grid[spot.r][spot.c].vx;
            delete p.grid[spot.r][spot.c].x;
            delete p.grid[spot.r][spot.c].y;
            if (p.id === Game.localPlayer?.id) {
              // Dernière boule posée : on persiste NOTRE grille (on en est propriétaire)
              // + une seule secousse pour signaler l'arrivée du paquet
              if (!p.incomingBubbles.some(ib => ib.fromLeft)) {
                FirebaseController.updatePlayerDoc(p.id, { grid: JSON.stringify(p.grid) });
                UI.triggerShake(1, 180);
              }
              this.checkGameOver(p);
            }
          }
          continue;
        }

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
      }
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
        player.variationColorTimer % Config.FPS === 0 &&
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
    Game.localPlayer.spells.splice(spellIndex, 1);
    // Barre de sorts rafraîchie immédiatement (l'écho ne pilote plus l'UI en jeu)
    UI.updateSpellsBar();

    await FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
      spells: Game.localPlayer.spells,
    });

    // Annonce pour TOUT LE MONDE (un doc par sort : rien ne s'écrase)
    FirebaseController.announceSpell(
      Game.localPlayer.name,
      spellName,
      targetPlayer.name
    );

    if (targetPlayer.id === Game.localPlayer.id) {
      // Sort sur soi-même : application directe
      await this.applySpellEffect(Game.localPlayer, spellName, Game.localPlayer.name);
    } else {
      // Sort sur un adversaire : événement — c'est SA machine qui l'applique
      // (chacun est propriétaire de sa grille, pas de conflit d'écriture)
      await FirebaseController.sendEventToPlayer(targetPlayer.id, {
        type: "spell",
        spell: spellName,
        from: Game.localPlayer.name,
      });
    }
  },

  async applySpellEffect(target, spell, casterName = null) {
    if (!target?.isAlive || !spell) return;

    // Tremblement à la réception : intensité selon le nombre de sorts reçus
    // dans les 4 dernières secondes (plusieurs sorts en même temps = bien plus fort)
    if (target.id === Game.localPlayer.id) {
      const now = Date.now();
      target.recentSpellTimes = (target.recentSpellTimes || []).filter(t => now - t < 4000);
      target.recentSpellTimes.push(now);
      const count = target.recentSpellTimes.length;
      // Plusieurs sorts rapprochés : secousse nettement plus forte et plus longue
      const duration = Math.min(1000 + 1000 * count, 6500);
      const intensity = Math.min(1 + count * 2, 10);
      UI.triggerShake(intensity, duration);
      // Protection : pas de boules adverses pendant le tremblement
      target.shakeProtectionUntil = now + duration;

      // Message blanc défilant (droite → gauche) au-dessus de la ligne de mort :
      // qui t'a envoyé quoi
      const spellInfo = Config.SPELLS[spell];
      const label = `<${spellInfo ? spellInfo.name : spell}${casterName ? " par " + casterName : ""}`;
      target.spellTickers = target.spellTickers || [];
      const mainCanvas = document.getElementById("gameCanvas");
      target.spellTickers.push({
        text: label,
        x: (mainCanvas ? mainCanvas.width : 300) + target.spellTickers.length * 160,
      });
    }

    const DURATION = 10000;
    let effects = { ...target.statusEffects };
    let gridChanged = false,
      spellsChanged = false;
    let grid = target.grid.map((r) => [...r]);

    switch (spell) {
      // SORTS OFFENSIFS
      case "plateauRenverse":
        // Rotation du plateau : angle aléatoire, 35 degrés au maximum
        const rotationAngle = (8 + Math.random() * 27) * (Math.random() < 0.5 ? -1 : 1);
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
        // Change immédiatement TOUTES les couleurs des bulles du plateau
        for (let r = 0; r < Config.GRID_ROWS; r++) {
          for (let c = 0; c < Config.GRID_COLS; c++) {
            if (grid[r][c]) {
              const newColorIndex = Math.floor(Math.random() * Config.BUBBLE_COLORS.length);
              grid[r][c].color = Config.BUBBLE_COLORS[newColorIndex];
              // La couleur détermine le sort : on re-synchronise le symbole
              // avec la nouvelle couleur (sinon symbole/couleur incohérents)
              if (grid[r][c].isSpellBubble) {
                grid[r][c].spell = Config.COLOR_TO_SPELL_MAP[grid[r][c].color.main] || null;
                grid[r][c].isSpellBubble = !!grid[r][c].spell;
              }
            }
          }
        }
        gridChanged = true;
        // Aussi la couleur de la bulle à tirer change constamment
        effects.variationCouleur = { endTime: Date.now() + 8000 };
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
        const destroyPercent = Config.nukeDestroyPercent(); // parfois faible, parfois forte
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
        // Supprime les boules les plus basses (équivalent à ~1.5 lignes, environ 10 à 14 boules)
        const bubbles = [];
        for (let r = 0; r < Config.GRID_ROWS; r++) {
          for (let c = 0; c < Config.GRID_COLS; c++) {
            if (grid[r][c]) {
              bubbles.push({ r, c, bubble: grid[r][c] });
            }
          }
        }

        // Trier par 'r' décroissant (les plus basses d'abord)
        bubbles.sort((a, b) => b.r - a.r);

        // Prendre environ 10 à 14 boules
        const toRemove = Math.min(bubbles.length, 10 + Math.floor(Math.random() * 5));

        target.spells = target.spells || [];
        target.fallingBubbles = target.fallingBubbles || [];
        target.effects = target.effects || [];

        for (let i = 0; i < toRemove; i++) {
          const { r, c, bubble } = bubbles[i];

          if (bubble.isSpellBubble && bubble.spell) {
            if (target.spells.length < Config.MAX_SPELLS) {
              target.spells.push(bubble.spell);
              spellsChanged = true;
            }
          }

          const { x, y } = this.getBubbleCoords(r, c, Game.bubbleRadius);
          target.effects.push({
            x, y, type: "pop", radius: Game.bubbleRadius, life: 20,
          });
          target.fallingBubbles.push({
            ...bubble, x, y, vx: 0, vy: 0.5,
          });
          grid[r][c] = null;
        }

        if (toRemove > 0) {
          this.handleAvalanche({ grid, spells: target.spells, fallingBubbles: target.fallingBubbles, effects: target.effects }, grid, true);
          gridChanged = true;
        }
        break;
      }
    }

    // Application LOCALE immédiate des effets (l'écho serveur ne pilote plus
    // notre état en jeu — avant, les effets n'arrivaient qu'au retour réseau)
    target.statusEffects = effects;

    const updateData = { statusEffects: effects };
    if (gridChanged) updateData.grid = JSON.stringify(grid);
    if (spellsChanged) {
      updateData.spells = target.spells;
      // Inventaire modifié (sort volé/récupéré) → barre à jour immédiatement
      if (target.id === Game.localPlayer.id) UI.updateSpellsBar();
    }
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
          x,
          y,
          vy: 0.5, // Initial slow downward velocity
          vx: 0,   // No more random horizontal drift
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
    if (player.isAlive) {
      // État local immédiat : l'écho serveur n'écrase plus notre état en jeu
      player.isAlive = false;
      await FirebaseController.updatePlayerDoc(player.id, { isAlive: false });
    }
  },

  startHeartbeat() {
    if (Game.heartbeatInterval) clearInterval(Game.heartbeatInterval);
    // 10s : doit battre nettement plus vite que le seuil fantôme de 30s,
    // sinon les autres clients nous suppriment entre deux battements
    Game.heartbeatInterval = setInterval(() => {
      if (Game.localPlayer && FirebaseController.auth.currentUser) {
        FirebaseController.updatePlayerDoc(FirebaseController.auth.currentUser.uid, {
          lastActive: Date.now()
        });
      }
    }, 10000);
  }
};
