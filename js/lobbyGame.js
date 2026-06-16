/**
 * lobbyGame.js - Échauffement solo dans le lobby
 * MÊME jeu que dans les salles (rendu, sorts, niveaux, boules envoyées par
 * l'ordinateur), en version locale sans Firebase. Seules différences :
 * - on ne perd que lorsqu'une boule dépasse la barre du bas ;
 * - après un game over, un clic relance une nouvelle partie.
 *
 * Contrôles identiques aux salles : souris pour viser, Espace/Flèche haut
 * pour tirer, Gauche/Droite pour tourner, clic = lancer le dernier sort
 * sur soi-même (LIFO).
 */

import { Config } from "./config.js";
import { BubbleRenderer } from "./bubbleRenderer.js";

export const LobbyGame = {
    canvas: null,
    ctx: null,
    player: null,
    bubbleRadius: 0,
    cannonPosition: { x: 0, y: 0 },
    isRunning: false,
    animationId: null,
    keys: { left: false, right: false },
    spellIcons: {},
    intervals: [],
    announcement: null, // { text, until }
    playerName: "Joueur",
    targetFPS: Config.DEFAULT_GAME_FPS, // vitesse du jeu (réglable via /fps 30-300, comme en salle)
    currentRotationSpeed: Config.LAUNCHER_ROTATION_SPEED, // réglable via /canon X
    lastFrameTime: 0,
    accumulator: 0,

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.preloadSpellIcons();
        this.setupInputHandlers();
    },

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.resizeCanvas();

        try {
            this.playerName = localStorage.getItem("marbleous_pseudo") || "Joueur";
        } catch (e) { /* stockage restreint */ }
        this.lastFrameTime = 0;
        this.accumulator = 0;

        this.player = {
            launcher: { angle: -Math.PI / 2 },
            launcherBubble: null,
            shotBubble: null,
            nextBubble: null,
            grid: this.createInitialGrid(),
            score: 0,
            isAlive: true,
            fallingBubbles: [],
            incomingBubbles: [],
            effects: [],
            statusEffects: {},
            level: 1,
            spells: [],
            variationColorTimer: 0,
        };

        this.loadBubbles();
        this.updateSpellsBar();

        // Même rythme que les salles : niveau toutes les 30s, envoi de boules toutes les 5s
        this.intervals.push(setInterval(() => this.levelUp(), 30000));
        this.intervals.push(setInterval(() => this.computerAttack(), 5000));

        this.gameLoop();
    },

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.intervals.forEach(clearInterval);
        this.intervals = [];
    },

    restart() {
        this.stop();
        this.start();
    },

    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        this.canvas.width = containerRect.width;
        this.canvas.height = containerRect.height;

        // Même calcul que les salles : 8 colonnes + offset = 17 rayons de large
        this.bubbleRadius = this.canvas.width / 17;
    },

    setupInputHandlers() {
        // Visée aux flèches uniquement : pas de mousemove (comme en salle)

        // Clic : rejouer si game over, sinon lancer le dernier sort sur soi (comme en salle)
        this.canvas.addEventListener("click", () => {
            if (!this.isRunning || !this.player) return;

            if (!this.player.isAlive) {
                this.restart();
                return;
            }

            this.castActiveSpell();
        });

        window.addEventListener("keydown", (e) => {
            if (!this.isRunning) return;
            // Ne pas jouer pendant la saisie chat/pseudo
            const active = document.activeElement;
            if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

            if (e.key === "ArrowLeft") this.keys.left = true;
            if (e.key === "ArrowRight") this.keys.right = true;
            if (e.key === "ArrowUp" || e.code === "Space") {
                e.preventDefault();
                this.shoot();
            }
        });

        window.addEventListener("keyup", (e) => {
            if (e.key === "ArrowLeft") this.keys.left = false;
            if (e.key === "ArrowRight") this.keys.right = false;
        });

        window.addEventListener("resize", () => {
            if (this.isRunning) this.resizeCanvas();
        });
    },

    shoot() {
        const p = this.player;
        if (!p?.isAlive || !p.launcherBubble || p.shotBubble) return;

        p.shotBubble = p.launcherBubble;
        p.launcherBubble = null;

        const speed = this.bubbleRadius * 0.6;
        p.shotBubble.isStatic = false;
        p.shotBubble.vx = Math.cos(p.launcher.angle) * speed;
        p.shotBubble.vy = Math.sin(p.launcher.angle) * speed;
        p.shotBubble.x = this.cannonPosition.x;
        p.shotBubble.y = this.cannonPosition.y;

        this.loadBubbles();
    },

    gameLoop(timestamp = 0) {
        if (!this.isRunning) return;

        // Pas de simulation fixe identique aux salles : vitesse du jeu = targetFPS
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        let elapsed = timestamp - this.lastFrameTime;
        if (elapsed > 250) elapsed = 250;
        this.lastFrameTime = timestamp;

        this.accumulator += elapsed;
        const stepMs = 1000 / this.targetFPS;
        let steps = 0;
        while (this.accumulator >= stepMs && steps < 30) {
            this.update();
            this.accumulator -= stepMs;
            steps++;
        }
        if (steps >= 30) this.accumulator = 0;

        this.draw();

        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    },

    // Réglages via le chat de l'accueil (/fps X, /canon X) — mêmes commandes qu'en salle
    setFps(value) {
        if (isNaN(value) || value < 30 || value > 300) return false;
        this.targetFPS = value;
        return true;
    },

    setCannonSpeed(value) {
        if (isNaN(value) || value <= 0) return false;
        this.currentRotationSpeed = Config.LAUNCHER_ROTATION_SPEED * (value / 5);
        return true;
    },

    update() {
        const p = this.player;
        if (!p) return;

        this.processStatusEffects();

        // Messages de sorts : défilement droite → gauche au-dessus de la ligne
        if (p.spellTickers && p.spellTickers.length) {
            for (let i = p.spellTickers.length - 1; i >= 0; i--) {
                p.spellTickers[i].x -= 1.5;
                if (p.spellTickers[i].x < -400) p.spellTickers.splice(i, 1);
            }
        }

        // Effets visuels (pops) — parcours arrière : suppression sûre en itérant
        for (let i = p.effects.length - 1; i >= 0; i--) {
            const e = p.effects[i];
            e.life--;
            if (e.type === "pop") e.radius += 0.25;
            if (e.life <= 0) p.effects.splice(i, 1);
        }

        // Rotation du canon — mêmes variantes canonCasse que les salles
        let rotSpeed = this.currentRotationSpeed;
        const canonEffect = p.statusEffects.canonCasse;

        if (canonEffect) {
            const variant = canonEffect.variant || 0;
            switch (variant) {
                case 0: // Inversé
                    if (this.keys.left) p.launcher.angle += rotSpeed;
                    if (this.keys.right) p.launcher.angle -= rotSpeed;
                    break;
                case 1: // Bloqué
                    break;
                case 2: // Aléatoire
                    rotSpeed *= 0.4;
                    p.launcher.angle += (Math.random() - 0.5) * 0.08;
                    if (this.keys.left) p.launcher.angle -= rotSpeed;
                    if (this.keys.right) p.launcher.angle += rotSpeed;
                    break;
                case 3: // Auto-tir
                    if (this.keys.left) p.launcher.angle -= rotSpeed;
                    if (this.keys.right) p.launcher.angle += rotSpeed;
                    if (!canonEffect.nextAutoFire) {
                        canonEffect.nextAutoFire = Date.now() + 2000 + Math.random() * 2000;
                    }
                    if (Date.now() > canonEffect.nextAutoFire && !p.shotBubble && p.launcherBubble) {
                        this.shoot();
                        canonEffect.nextAutoFire = Date.now() + 2000 + Math.random() * 2000;
                    }
                    break;
            }
        } else {
            if (this.keys.left) p.launcher.angle -= rotSpeed;
            if (this.keys.right) p.launcher.angle += rotSpeed;
        }

        // Limites de rotation
        p.launcher.angle = Math.max(
            -Math.PI + 0.1,
            Math.min(-0.1, p.launcher.angle)
        );

        // Mouvement boule tirée
        if (p.shotBubble) {
            const b = p.shotBubble;
            b.vx = b.vx || 0;
            b.vy = b.vy || 0;

            // Plateau renversé : gravité inclinée, courbe latérale nette
            // (comme en salle), peu de dérive vers le bas
            if (p.statusEffects.plateauRenverse) {
                const rot = ((p.statusEffects.plateauRenverse.angle || 0) * Math.PI) / 180;
                const g = this.bubbleRadius * 0.06;
                b.vx += Math.sin(rot) * g;
                b.vy += (1 - Math.cos(rot)) * g * 0.4;
            }

            b.x += b.vx;
            b.y += b.vy;

            // Collision plafond
            let collided = b.y - this.bubbleRadius < 0;

            // Collision grille — uniquement le voisinage (±2 cases), résultat
            // identique mais sans balayer les 96 cases à chaque pas (haut fps)
            if (!collided) {
                const rad = this.bubbleRadius;
                const thrSq = (rad * 1.8) * (rad * 1.8);
                const r0 = Math.round((b.y - rad) / (rad * 1.732));
                for (let r = Math.max(0, r0 - 2); r <= Math.min(Config.GRID_ROWS - 1, r0 + 2) && !collided; r++) {
                    const c0 = Math.round((b.x - rad - (r % 2 ? rad : 0)) / (rad * 2));
                    for (let c = Math.max(0, c0 - 2); c <= Math.min(Config.GRID_COLS - 1, c0 + 2); c++) {
                        if (p.grid[r][c]) {
                            const coords = this.getBubbleCoords(r, c);
                            const dx = b.x - coords.x, dy = b.y - coords.y;
                            if (dx * dx + dy * dy < thrSq) { collided = true; break; }
                        }
                    }
                }
            }

            if (collided) {
                this.snapBubble(b);
                return;
            }

            // Filet de sécurité : boule tirée sortie par le bas (jamais nettoyée
            // sinon) → on la jette et on recharge, sinon plus aucun tir possible
            b.shotFrames = (b.shotFrames || 0) + 1;
            if (b.y - this.bubbleRadius > this.canvas.height || b.shotFrames > 1200) {
                p.shotBubble = null;
                this.loadBubbles();
                return;
            }

            // Rebonds murs
            if (b.x - this.bubbleRadius < 0 || b.x + this.bubbleRadius > this.canvas.width) {
                b.vx *= -1;
            }
        }

        // Boules qui tombent — parcours arrière
        for (let i = p.fallingBubbles.length - 1; i >= 0; i--) {
            const b = p.fallingBubbles[i];
            b.vy += 0.15;
            b.y += b.vy;
            b.x += b.vx;
            if (b.y > this.canvas.height + 100) {
                p.fallingBubbles.splice(i, 1);
                // Sort différé (nettoyage) : ramassé maintenant, en fin de chute
                if (b.collectOnLand) {
                    if (p.spells.length < Config.MAX_SPELLS) {
                        p.spells.push(b.collectOnLand);
                        this.updateSpellsBar();
                    } else {
                        this.notifyInventoryFull();
                    }
                }
            }
        }

        // Boules envoyées par l'ordinateur : vol depuis le bord gauche vers leur case
        for (let i = p.incomingBubbles.length - 1; i >= 0; i--) {
            const b = p.incomingBubbles[i];
            const target = this.getBubbleCoords(b.targetRow, b.targetCol);
            b.x += b.vx;
            if (b.x >= target.x) {
                p.incomingBubbles.splice(i, 1);
                let spot = { r: b.targetRow, c: b.targetCol };
                // Case prise entre-temps : accrocher au plus proche
                if (p.grid[spot.r][spot.c]) {
                    const fallback = this.findBestSnapSpot({ x: target.x, y: target.y });
                    if (!fallback) continue;
                    spot = fallback;
                }
                const placed = this.createBubble(spot.r, spot.c, b.color, b.spell || null);
                p.grid[spot.r][spot.c] = placed;
                // Dernière boule du paquet : une seule secousse
                if (!p.incomingBubbles.some(ib => ib.fromLeft)) {
                    this.shakeCanvas();
                }
                this.checkGameOver();
            }
        }
    },

    // Expiration des effets + variation de couleur du canon (comme en salle)
    processStatusEffects() {
        const p = this.player;
        const now = Date.now();
        for (const key in p.statusEffects) {
            if (now > p.statusEffects[key].endTime) {
                delete p.statusEffects[key];
            }
        }
        if (p.statusEffects.variationCouleur) {
            p.variationColorTimer = (p.variationColorTimer || 0) + 1;
            if (p.variationColorTimer % Config.FPS === 0 && p.launcherBubble) {
                p.launcherBubble.color =
                    Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)];
            }
        }
    },

    snapBubble(shotBubble) {
        const p = this.player;
        p.shotBubble = null;

        const bestSpot = this.findBestSnapSpot(shotBubble);
        if (bestSpot) {
            const { r, c } = bestSpot;
            p.grid[r][c] = this.createBubble(r, c, shotBubble.color);
            const matches = this.findMatches(r, c);

            if (matches.length >= 3) {
                let cleared = matches.length;

                matches.forEach((m) => {
                    const { x, y } = this.getBubbleCoords(m.r, m.c);
                    p.effects.push({
                        x, y, type: "pop", radius: this.bubbleRadius, life: 25
                    });
                    p.grid[m.r][m.c] = null;
                });

                const avalanche = this.handleAvalanche();
                cleared += avalanche;

                // Apparition potentielle d'un sort (même chance qu'en salle)
                if (Math.random() < Config.SPELL_SPAWN_CHANCE) {
                    this.spawnSpellBubble();
                }

                p.score += cleared * 10 + Math.pow(avalanche, 2) * 10;
            }
        }

        this.checkGameOver();
    },

    // --- SORTS (logique identique aux salles, appliquée à soi-même) ---

    castActiveSpell() {
        const p = this.player;
        if (!p?.isAlive || !p.spells || p.spells.length === 0) return;

        // LIFO : dernier sort ramassé = premier lancé
        const spellName = p.spells.pop();
        this.updateSpellsBar();

        const info = Config.SPELLS[spellName];
        if (info) this.showAnnouncement(info.name);

        // Message blanc défilant au-dessus de la ligne (qui a envoyé quoi)
        p.spellTickers = p.spellTickers || [];
        p.spellTickers.push({
            text: `<${info ? info.name : spellName} par ${this.playerName}`,
            x: this.canvas.width + p.spellTickers.length * 160,
        });

        this.applySpellEffect(spellName);
    },

    // Inventaire plein : le sort est perdu — on le dit au joueur
    notifyInventoryFull() {
        const p = this.player;
        if (!p) return;
        p.spellTickers = p.spellTickers || [];
        p.spellTickers.push({
            text: "<Inventaire plein, sort perdu !",
            x: this.canvas.width + p.spellTickers.length * 160,
        });
    },

    // Une secousse brève du canvas (arrivée de boules)
    shakeCanvas(amplitude = 5, duration = 180) {
        if (!this.canvas?.animate) return;
        this.canvas.animate(
            [
                { transform: "translate(0,0)" },
                { transform: `translate(${amplitude}px,${-amplitude * 0.6}px)` },
                { transform: `translate(${-amplitude * 0.7}px,${amplitude * 0.4}px)` },
                { transform: "translate(0,0)" }
            ],
            { duration, easing: "ease-out" }
        );
    },

    applySpellEffect(spell) {
        const p = this.player;
        if (!p?.isAlive || !spell) return;

        const DURATION = 10000;
        const grid = p.grid;

        switch (spell) {
            case "plateauRenverse": {
                // Souvent léger, parfois fort (comme en salle)
                const mag = Math.random() < 0.6 ? 3 + Math.random() * 9 : 12 + Math.random() * 23;
                const rotationAngle = mag * (Math.random() < 0.5 ? -1 : 1);
                p.statusEffects.plateauRenverse = {
                    endTime: Date.now() + DURATION,
                    angle: rotationAngle,
                    direction: rotationAngle > 0 ? 1 : -1,
                };
                break;
            }

            case "canonCasse": {
                p.statusEffects.canonCasse = {
                    endTime: Date.now() + DURATION,
                    variant: Math.floor(Math.random() * 4),
                };
                break;
            }

            case "disparitionSorts": {
                if (p.spells.length > 0) p.spells.shift();
                for (let r = 0; r < Config.GRID_ROWS; r++) {
                    for (let c = 0; c < Config.GRID_COLS; c++) {
                        if (grid[r][c]?.isSpellBubble) {
                            grid[r][c].isSpellBubble = false;
                            grid[r][c].spell = null;
                        }
                    }
                }
                this.updateSpellsBar();
                break;
            }

            case "variationCouleur": {
                for (let r = 0; r < Config.GRID_ROWS; r++) {
                    for (let c = 0; c < Config.GRID_COLS; c++) {
                        if (grid[r][c]) {
                            grid[r][c].color =
                                Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)];
                        }
                    }
                }
                p.statusEffects.variationCouleur = { endTime: Date.now() + 8000 };
                break;
            }

            case "boulesSupplementaires": {
                // Remplit les cases libres accrochables (haut d'abord), sans
                // décaler le plateau : pas de game over s'il reste de la place
                const freeSlots = [];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (!grid[r][c] &&
                            (r === 0 || this.getNeighborCoords(r, c).some(n => grid[n.r]?.[n.c])))
                            freeSlots.push({ r, c });
                freeSlots.sort((a, b) => a.r - b.r);
                const toAdd = Math.min(freeSlots.length, 8 + Math.floor(Math.random() * 5));
                for (let i = 0; i < toAdd; i++) {
                    const s = freeSlots[i];
                    grid[s.r][s.c] = this.createBubble(s.r, s.c);
                }
                break;
            }

            case "nukeBomb": {
                const bubbles = [];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]) bubbles.push({ r, c });
                const destroyPercent = Config.nukeDestroyPercent();
                const toDestroy = Math.floor(bubbles.length * destroyPercent);
                bubbles.sort(() => 0.5 - Math.random());
                for (let i = 0; i < toDestroy; i++) {
                    const b = bubbles[i];
                    const { x, y } = this.getBubbleCoords(b.r, b.c);
                    p.effects.push({
                        x, y, type: "pop", radius: this.bubbleRadius, life: 30, color: "#af00c1",
                    });
                    grid[b.r][b.c] = null;
                }
                // La nuke purge TOUS les sorts du plateau (boules redevenues normales)
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]?.isSpellBubble) {
                            grid[r][c].isSpellBubble = false;
                            grid[r][c].spell = null;
                        }
                this.handleAvalanche();
                break;
            }

            case "toutesMemeCouleur": {
                const bubbles = [];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c] && !grid[r][c].isSpellBubble) bubbles.push(grid[r][c]);
                if (bubbles.length > 0) {
                    const newColor =
                        Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)];
                    const toChange = Math.floor(bubbles.length * (0.3 + Math.random() * 0.3));
                    bubbles.sort(() => 0.5 - Math.random());
                    for (let i = 0; i < toChange; i++) {
                        bubbles[i].color = newColor;
                    }
                }
                break;
            }

            case "nettoyage": {
                // ~13 boules les plus basses (max 2 lignes), elles tombent ;
                // sorts ramassés à l'atterrissage seulement
                const cells = [];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]) cells.push({ r, c });
                cells.sort((a, b) => b.r - a.r);
                const toRemove = Math.min(cells.length, 11 + Math.floor(Math.random() * 5));

                let removed = 0;
                for (let i = 0; i < toRemove; i++) {
                    const { r, c } = cells[i];
                    const bubble = grid[r][c];
                    if (!bubble) continue;
                    const { x, y } = this.getBubbleCoords(r, c);
                    p.effects.push({ x, y, type: "pop", radius: this.bubbleRadius, life: 20 });
                    p.fallingBubbles.push({
                        ...bubble, x, y, vx: 0, vy: 0.5,
                        collectOnLand: bubble.isSpellBubble && bubble.spell ? bubble.spell : null,
                    });
                    grid[r][c] = null;
                    removed++;
                }

                if (removed > 0) this.handleAvalanche(true);
                break;
            }
        }

        this.checkGameOver();
    },

    // L'ordinateur envoie des boules régulièrement (comme les adversaires en salle)
    computerAttack() {
        const p = this.player;
        if (!p?.isAlive) return;

        // Échauffement : l'ordinateur envoie ~1 unité, gentil aux premiers niveaux
        const count = Config.attackSize(p.level, 1);
        if (count <= 0) return;

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

        // Remplir en haut d'abord, comme en salle — les boules arrivent en volant
        // par le bord gauche (file indienne) au lieu d'apparaître de nulle part
        validSlots.sort((a, b) => a.r - b.r);
        const toAdd = Math.min(validSlots.length, count);
        for (let i = 0; i < toAdd; i++) {
            const s = validSlots[i];
            const bubble = this.createBubble(s.r, s.c);
            const { y } = this.getBubbleCoords(s.r, s.c);
            p.incomingBubbles.push({
                ...bubble,
                targetRow: s.r,
                targetCol: s.c,
                x: -this.bubbleRadius * (2 + i * 2.5),
                y,
                vx: this.bubbleRadius * 0.45,
                fromLeft: true,
            });
        }
    },

    levelUp() {
        const p = this.player;
        if (!p?.isAlive) return;
        p.level++; // montée silencieuse, pas de bandeau
    },

    showAnnouncement(text, duration = 3000) {
        this.announcement = { text, until: Date.now() + duration };
    },

    // --- DESSIN (identique à Drawing.drawGameState, version solo) ---

    draw() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const rad = this.bubbleRadius;
        const p = this.player;

        // Fond transparent : le patchwork orange est géré par le CSS
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!p) return;

        const deadLineY = Config.GAME_OVER_ROW * (rad * 1.732) + rad;

        // --- CANON COQUILLAGE (hors rotation plateau, comme en salle) ---
        const layout = BubbleRenderer.computeCannonLayout(canvas, deadLineY);
        this.cannonPosition = { x: layout.centerX, y: layout.pivotY };

        BubbleRenderer.drawCannonShell(ctx, layout.centerX, layout.pivotY, layout.radius);
        BubbleRenderer.drawCannonNeedle(
            ctx,
            p.launcher.angle,
            this.cannonPosition,
            layout.radius,
            !!p.statusEffects.canonCasse
        );

        if (p.launcherBubble) {
            BubbleRenderer.drawBubble(ctx, p.launcherBubble, rad, layout.centerX, layout.pivotY, this.spellIcons);
        }
        if (p.shotBubble) {
            BubbleRenderer.drawBubble(ctx, p.shotBubble, rad, p.shotBubble.x, p.shotBubble.y, this.spellIcons);
        }

        // Prochaine boule (bien visible) + vitesse de jeu, à droite du coquillage
        BubbleRenderer.drawCannonSideInfo(
            ctx, canvas, layout.centerX, layout.pivotY, layout.radius,
            rad, p.nextBubble || null, this.targetFPS, this.spellIcons
        );

        // --- Rotation du plateau (plateauRenverse), grille uniquement ---
        let rotationApplied = false;
        if (p.statusEffects.plateauRenverse) {
            const rotAngle = p.statusEffects.plateauRenverse.angle || 0;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotAngle * Math.PI) / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            rotationApplied = true;
        }

        // Cadre blanc arrondi + tube/cercle avec la boule "équipe" (grise en solo)
        // Ligne blanche remontée au haut de la rangée de game over (comme en salle)
        const lineY = deadLineY - rad * 0.866;
        BubbleRenderer.drawPlayfieldFrame(ctx, canvas, lineY);
        BubbleRenderer.drawTeamBubbleHolder(
            ctx, rad, lineY, layout.pivotY, "#b6b4b9"
        );

        // Grille
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (p.grid[r][c]) {
                    const { x, y } = this.getBubbleCoords(r, c);
                    BubbleRenderer.drawBubble(ctx, p.grid[r][c], rad, x, y, this.spellIcons);
                }
            }
        }

        p.fallingBubbles.forEach(b => {
            BubbleRenderer.drawBubble(ctx, b, rad, b.x, b.y, this.spellIcons);
        });

        // Boules envoyées par l'ordinateur (en vol depuis la gauche)
        p.incomingBubbles.forEach(b => {
            BubbleRenderer.drawBubble(ctx, b, rad, b.x, b.y, this.spellIcons);
        });

        p.effects.forEach(e => BubbleRenderer.drawEffect(ctx, e));

        if (rotationApplied) ctx.restore();

        // Messages de sorts : texte blanc défilant au-dessus de la ligne de mort
        if (p.spellTickers && p.spellTickers.length) {
            ctx.save();
            ctx.font = "bold 12px Arial, sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 3;
            p.spellTickers.forEach(t => ctx.fillText(t.text, t.x, lineY - 6));
            ctx.restore();
        }

        // Score + pseudo en bas à gauche, comme "[DarkaL]" dans l'original
        BubbleRenderer.drawPlayerLabel(ctx, canvas, this.playerName, p.score);

        // Annonce (niveau, sort lancé...)
        if (this.announcement) {
            if (Date.now() > this.announcement.until) {
                this.announcement = null;
            } else {
                ctx.save();
                ctx.font = "bold 13px Inter, sans-serif";
                ctx.textAlign = "center";
                ctx.fillStyle = "#fbbf24";
                ctx.shadowColor = "black";
                ctx.shadowBlur = 4;
                ctx.fillText(this.announcement.text, canvas.width / 2, deadLineY + 24);
                ctx.restore();
            }
        }

        // Game Over : clic pour rejouer
        if (!p.isAlive) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);

            ctx.fillStyle = "white";
            ctx.font = "16px Inter, sans-serif";
            ctx.fillText(`Score: ${p.score}`, canvas.width / 2, canvas.height / 2 + 15);
            ctx.fillText("Cliquez pour rejouer", canvas.width / 2, canvas.height / 2 + 45);
        }
    },

    // --- BARRE DE SORTS (même logique LIFO droite→gauche que les salles) ---

    updateSpellsBar() {
        const spellSlots = document.querySelectorAll("#spells-bar .spell-slot");
        if (!spellSlots.length || !this.player) return;

        const spells = this.player.spells || [];
        const numSlots = spellSlots.length;

        spellSlots.forEach((slot, i) => {
            slot.innerHTML = "";
            slot.className = "spell-slot";
            slot.style.backgroundColor = "transparent";
            slot.style.border = "";
            slot.style.boxShadow = "";

            const spellIndex = spells.length - numSlots + i;

            // Le slot tout à droite est toujours le slot actif (bordure)
            if (i === numSlots - 1) {
                slot.style.border = "2px solid white";
                slot.style.borderRadius = "4px";
            }

            if (spellIndex >= 0 && spellIndex < spells.length) {
                const spellName = spells[spellIndex];
                const spellInfo = Config.SPELLS[spellName];
                if (spellInfo) {
                    slot.classList.add("has-spell");
                    if (spellIndex === spells.length - 1) {
                        slot.classList.add("active-spell");
                    }

                    const canvas = document.createElement("canvas");
                    const size = slot.clientWidth || 34;
                    canvas.width = size;
                    canvas.height = size;
                    const sctx = canvas.getContext("2d");

                    let bubbleColorObj = Config.BUBBLE_COLORS[0];
                    for (const [hex, spell] of Object.entries(Config.COLOR_TO_SPELL_MAP)) {
                        if (spell === spellName) {
                            bubbleColorObj = Config.BUBBLE_COLORS.find(c => c.main === hex) || bubbleColorObj;
                            break;
                        }
                    }

                    const radius = (size / 2) * 0.95;
                    BubbleRenderer.drawBubble(sctx, {
                        color: bubbleColorObj,
                        isSpellBubble: true,
                        spell: spellName,
                    }, radius, size / 2, size / 2, this.spellIcons);

                    slot.appendChild(canvas);
                }
            }
        });
    },

    // --- LOGIQUE DE GRILLE (identique aux salles) ---

    createEmptyGrid() {
        return Array.from({ length: Config.GRID_ROWS }, () =>
            Array(Config.GRID_COLS).fill(null)
        );
    },

    createInitialGrid() {
        const grid = this.createEmptyGrid();

        // Ligne 0 pleine (ancrage)
        for (let c = 0; c < Config.GRID_COLS; c++) {
            grid[0][c] = this.createBubble(0, c);
        }

        // Lignes 1-2 denses (même densité que les salles)
        for (let r = 1; r < 3; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (Math.random() > 0.3) {
                    grid[r][c] = this.createBubble(r, c);
                }
            }
        }

        this.cleanFloatingBubbles(grid);

        return grid;
    },

    cleanFloatingBubbles(grid) {
        const connected = new Set();
        const queue = [];

        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (grid[0][c]) {
                queue.push({ r: 0, c });
                connected.add(`0,${c}`);
            }
        }

        let head = 0;
        while (head < queue.length) {
            const curr = queue[head++];
            for (const n of this.getNeighborCoords(curr.r, curr.c)) {
                if (grid[n.r]?.[n.c] && !connected.has(`${n.r},${n.c}`)) {
                    connected.add(`${n.r},${n.c}`);
                    queue.push(n);
                }
            }
        }

        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (grid[r][c] && !connected.has(`${r},${c}`)) {
                    grid[r][c] = null;
                }
            }
        }
    },

    createBubble(r, c, color = null, spell = null) {
        return {
            r, c,
            color: color || Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)],
            spell,
            isSpellBubble: !!spell,
            isStatic: true
        };
    },

    loadBubbles() {
        if (!this.player?.isAlive) return;
        this.player.launcherBubble = this.player.nextBubble || this.createBubble(-1, -1);
        this.player.launcherBubble.isStatic = true;
        this.player.nextBubble = this.createBubble(-1, -1);
    },

    getBubbleCoords(r, c) {
        const rad = this.bubbleRadius;
        const odd = r % 2 !== 0;
        const x = c * rad * 2 + rad + (odd ? rad : 0);
        const y = r * rad * 1.732 + rad;
        return { x, y };
    },

    getNeighborCoords(r, c) {
        const odd = r % 2 !== 0;
        const dirs = [
            { r: r - 1, c: odd ? c : c - 1 },
            { r: r - 1, c: odd ? c + 1 : c },
            { r: r, c: c - 1 },
            { r: r, c: c + 1 },
            { r: r + 1, c: odd ? c : c - 1 },
            { r: r + 1, c: odd ? c + 1 : c }
        ];
        return dirs.filter(n =>
            n.r >= 0 && n.r < Config.GRID_ROWS && n.c >= 0 && n.c < Config.GRID_COLS
        );
    },

    findBestSnapSpot(bubble) {
        let best = null;
        let minDist = Infinity;

        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (this.player.grid[r][c]) continue;

                const hasNeighbor = r === 0 ||
                    this.getNeighborCoords(r, c).some(n => this.player.grid[n.r]?.[n.c]);

                if (hasNeighbor) {
                    const { x, y } = this.getBubbleCoords(r, c);
                    const dist = Math.hypot(bubble.x - x, bubble.y - y);
                    if (dist < minDist) {
                        minDist = dist;
                        best = { r, c };
                    }
                }
            }
        }

        // Repli : colonne libre du plafond la plus proche (comme en salle)
        if (!best) {
            let cCol = -1, cDist = Infinity;
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (!this.player.grid[0][c]) {
                    const { x } = this.getBubbleCoords(0, c);
                    const d = Math.abs(bubble.x - x);
                    if (d < cDist) {
                        cDist = d;
                        cCol = c;
                    }
                }
            }
            if (cCol !== -1) best = { r: 0, c: cCol };
        }

        return best;
    },

    findMatches(startR, startC) {
        const start = this.player.grid[startR]?.[startC];
        if (!start) return [];
        const targetMain = start.color.main;

        const visited = new Set();
        const matches = [];
        const queue = [{ r: startR, c: startC }];

        while (queue.length > 0) {
            const { r, c } = queue.shift();
            const key = `${r},${c}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const bubble = this.player.grid[r]?.[c];
            if (!bubble || bubble.color.main !== targetMain) continue;

            matches.push({ r, c });

            for (const n of this.getNeighborCoords(r, c)) {
                if (!visited.has(`${n.r},${n.c}`)) {
                    queue.push(n);
                }
            }
        }

        return matches;
    },

    // Boules décrochées : tombent, et les boules-sorts sont récupérées (comme
    // en salle). delayCollect : sorts ramassés à l'atterrissage (nettoyage).
    handleAvalanche(delayCollect = false) {
        const p = this.player;
        const connected = new Set();
        const queue = [];

        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (p.grid[0][c]) {
                queue.push({ r: 0, c });
                connected.add(`0,${c}`);
            }
        }

        let head = 0;
        while (head < queue.length) {
            const curr = queue[head++];
            for (const n of this.getNeighborCoords(curr.r, curr.c)) {
                if (p.grid[n.r][n.c] && !connected.has(`${n.r},${n.c}`)) {
                    connected.add(`${n.r},${n.c}`);
                    queue.push(n);
                }
            }
        }

        let fallen = 0;
        let spellCollected = false;
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                const b = p.grid[r][c];
                if (b && !connected.has(`${r},${c}`)) {
                    const carriesSpell = b.isSpellBubble && b.spell;
                    // Sort récupéré quand la boule tombe sans exploser
                    // (ou à l'atterrissage si delayCollect)
                    if (carriesSpell && !delayCollect) {
                        if (p.spells.length < Config.MAX_SPELLS) {
                            p.spells.push(b.spell);
                            spellCollected = true;
                        } else {
                            this.notifyInventoryFull();
                        }
                    }
                    const { x, y } = this.getBubbleCoords(r, c);
                    p.fallingBubbles.push({
                        ...b, x, y, vx: 0, vy: 0.5,
                        collectOnLand: delayCollect && carriesSpell ? b.spell : null,
                    });
                    p.grid[r][c] = null;
                    fallen++;
                }
            }
        }

        if (spellCollected) this.updateSpellsBar();

        return fallen;
    },

    // Un sort apparaît sur une boule existante, couleur => sort (comme en salle)
    spawnSpellBubble() {
        const p = this.player;
        let bubbles = p.grid.flat().filter((b) => b && !b.isSpellBubble && b.r > 5);

        if (bubbles.length < 3) {
            bubbles = p.grid.flat().filter((b) => b && !b.isSpellBubble);
        }

        if (bubbles.length > 0) {
            const target = bubbles[Math.floor(Math.random() * bubbles.length)];
            const spell = Config.COLOR_TO_SPELL_MAP[target.color.main];
            if (spell) {
                target.spell = spell;
                target.isSpellBubble = true;
            }
        }
    },

    // On ne perd QUE lorsqu'une boule dépasse la barre du bas
    checkGameOver() {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (this.player.grid[Config.GAME_OVER_ROW]?.[c]) {
                this.player.isAlive = false;
                // Hook : remonter le score au leaderboard de l'accueil
                if (typeof this.onGameOver === "function") {
                    try { this.onGameOver(this.player.score); } catch (e) { /* ignore */ }
                }
                return;
            }
        }
    },

    preloadSpellIcons() {
        Object.entries(Config.SPELLS).forEach(([key, spell]) => {
            const img = new Image();
            img.src = spell.icon;
            this.spellIcons[key] = img;
        });
    }
};
