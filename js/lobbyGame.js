/**
 * lobbyGame.js - Jeu solo dans le lobby (identique aux salles)
 * Utilise une logique standalone pour éviter les dépendances Firebase du module Game principal
 */

import { Config } from "./config.js";
import { Drawing } from "./drawing.js";

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

    // Initialise le jeu solo
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.preloadSpellIcons();
        this.setupInputHandlers();
    },

    // Démarre une nouvelle partie
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.resizeCanvas();

        // Créer le joueur local
        this.player = {
            launcher: { angle: -Math.PI / 2 },
            launcherBubble: null,
            shotBubble: null,
            nextBubble: null,
            grid: this.createInitialGrid(),
            score: 0,
            isAlive: true,
            fallingBubbles: [],
            effects: [],
            statusEffects: {},
            level: 1,
            spells: []
        };

        this.loadBubbles();
        this.gameLoop();
    },

    // Stoppe le jeu
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    // Restart après game over
    restart() {
        this.stop();
        this.start();
    },

    // Redimensionne le canvas pour le conteneur
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        this.canvas.width = containerRect.width;
        this.canvas.height = containerRect.height;

        // Calculer le rayon des bulles
        const cols = Config.GRID_COLS;
        this.bubbleRadius = Math.floor(this.canvas.width / cols / 2);
    },

    // Configuration des contrôles
    setupInputHandlers() {
        // Mouvement souris pour viser
        this.canvas.addEventListener("mousemove", (e) => {
            if (!this.isRunning || !this.player?.isAlive) return;

            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            let angle = Math.atan2(mouseY - this.cannonPosition.y, mouseX - this.cannonPosition.x);
            if (angle > -0.1) angle = -0.1;
            if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;

            this.player.launcher.angle = angle;
        });

        // Clic pour tirer
        this.canvas.addEventListener("click", () => {
            if (!this.isRunning || !this.player?.isAlive) return;

            // Restart après game over
            if (!this.player.isAlive) {
                this.restart();
                return;
            }

            this.shoot();
        });

        // Touches clavier
        window.addEventListener("keydown", (e) => {
            if (!this.isRunning) return;
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
    },

    // Tirer
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

    // Boucle principale
    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationId = requestAnimationFrame(() => this.gameLoop());
    },

    // Mise à jour logique
    update() {
        if (!this.player) return;

        // Rotation du canon avec touches
        const rotSpeed = Config.LAUNCHER_ROTATION_SPEED;
        if (this.keys.left) this.player.launcher.angle -= rotSpeed;
        if (this.keys.right) this.player.launcher.angle += rotSpeed;

        // Limites de rotation
        this.player.launcher.angle = Math.max(
            -Math.PI + 0.1,
            Math.min(-0.1, this.player.launcher.angle)
        );

        // Mise à jour des effets
        this.player.effects.forEach((e, i) => {
            e.life--;
            if (e.type === "pop") e.radius += 0.25;
            if (e.life <= 0) this.player.effects.splice(i, 1);
        });

        // Mouvement boule tirée
        if (this.player.shotBubble) {
            const b = this.player.shotBubble;
            b.x += b.vx;
            b.y += b.vy;

            // Collision plafond
            let collided = b.y - this.bubbleRadius < 0;

            // Collision grille
            if (!collided) {
                for (let r = 0; r < Config.GRID_ROWS; r++) {
                    for (let c = 0; c < Config.GRID_COLS; c++) {
                        if (this.player.grid[r][c]) {
                            const coords = this.getBubbleCoords(r, c);
                            if (Math.hypot(b.x - coords.x, b.y - coords.y) < this.bubbleRadius * 1.8) {
                                collided = true;
                                break;
                            }
                        }
                    }
                    if (collided) break;
                }
            }

            if (collided) {
                this.snapBubble(b);
                return;
            }

            // Rebonds murs
            if (b.x - this.bubbleRadius < 0 || b.x + this.bubbleRadius > this.canvas.width) {
                b.vx *= -1;
            }
        }

        // Boules qui tombent
        this.player.fallingBubbles.forEach((b, i) => {
            b.vy += 0.15;
            b.y += b.vy;
            b.x += b.vx;
            if (b.y > this.canvas.height + 100) {
                this.player.fallingBubbles.splice(i, 1);
            }
        });
    },

    // Accroche la bulle à la grille
    snapBubble(shotBubble) {
        this.player.shotBubble = null;

        const bestSpot = this.findBestSnapSpot(shotBubble);
        if (bestSpot) {
            const { r, c } = bestSpot;
            this.player.grid[r][c] = this.createBubble(r, c, shotBubble.color);
            const matches = this.findMatches(r, c);

            if (matches.length >= 3) {
                let cleared = matches.length;

                // Supprimer les bulles matchées
                matches.forEach((b) => {
                    const { x, y } = this.getBubbleCoords(b.r, b.c);
                    this.player.effects.push({
                        x, y, type: "pop", radius: this.bubbleRadius, life: 25
                    });
                    this.player.grid[b.r][b.c] = null;
                });

                // Avalanche
                const avalanche = this.handleAvalanche();
                cleared += avalanche;

                // Score
                this.player.score += cleared * 10 + Math.pow(avalanche, 2) * 10;
            }
        }

        this.checkGameOver();
    },

    // Dessin
    draw() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const rad = this.bubbleRadius;

        // Fond transparent (le CSS gère le patchwork orange)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.player) return;

        const deadLineY = Config.GAME_OVER_ROW * (rad * 1.732) + rad;

        // Canon
        const centerX = canvas.width / 2;
        const cannonPivotY = canvas.height - 15;
        const maxRadius = Math.min(120, cannonPivotY - deadLineY - 15);
        const cannonRadius = Math.max(40, maxRadius);

        this.cannonPosition = { x: centerX, y: cannonPivotY };

        // Eventail radar
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, cannonPivotY);
        ctx.arc(centerX, cannonPivotY, cannonRadius, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rayons
        for (let i = 0; i <= 6; i++) {
            const angle = Math.PI + (i * Math.PI) / 6;
            ctx.beginPath();
            ctx.moveTo(centerX, cannonPivotY);
            ctx.lineTo(
                centerX + Math.cos(angle) * cannonRadius,
                cannonPivotY + Math.sin(angle) * cannonRadius
            );
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.stroke();
        }
        ctx.restore();

        // Aiguille du canon
        this.drawCannonNeedle(ctx, cannonRadius);

        // Boules dans le canon
        if (this.player.launcherBubble) {
            this.drawBubble(ctx, this.player.launcherBubble, rad, centerX, cannonPivotY);
        }
        if (this.player.nextBubble) {
            this.drawBubble(ctx, this.player.nextBubble, rad * 0.8, centerX + cannonRadius + 20, cannonPivotY - 20);
        }
        if (this.player.shotBubble) {
            this.drawBubble(ctx, this.player.shotBubble, rad, this.player.shotBubble.x, this.player.shotBubble.y);
        }

        // Ligne de game over
        ctx.beginPath();
        ctx.moveTo(0, deadLineY);
        ctx.lineTo(canvas.width, deadLineY);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Grille
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (this.player.grid[r][c]) {
                    const { x, y } = this.getBubbleCoords(r, c);
                    this.drawBubble(ctx, this.player.grid[r][c], rad, x, y);
                }
            }
        }

        // Boules qui tombent
        this.player.fallingBubbles.forEach(b => {
            this.drawBubble(ctx, b, rad, b.x, b.y);
        });

        // Effets
        this.player.effects.forEach(e => this.drawEffect(ctx, e));

        // Score
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Score: ${this.player.score}`, 10, 20);

        // Game Over overlay
        if (!this.player.isAlive) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);

            ctx.fillStyle = "white";
            ctx.font = "16px Inter, sans-serif";
            ctx.fillText(`Score: ${this.player.score}`, canvas.width / 2, canvas.height / 2 + 15);
            ctx.fillText("Cliquez pour rejouer", canvas.width / 2, canvas.height / 2 + 45);
        }
    },

    // Dessiner l'aiguille du canon
    drawCannonNeedle(ctx, length) {
        const pos = this.cannonPosition;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(this.player.launcher.angle + Math.PI / 2);

        ctx.fillStyle = "#1a1a1a";
        ctx.beginPath();
        ctx.moveTo(0, -length);
        ctx.lineTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#1a1a1a";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // Dessiner une bulle - délègue au module Drawing pour le même rendu 3D que les salles
    drawBubble(ctx, b, rad, x, y) {
        if (!b || !b.color) return;
        Drawing.drawBubble(ctx, b, rad, x, y);
    },

    // Dessiner un effet
    drawEffect(ctx, e) {
        if (e.type === "pop") {
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${e.life / 10})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    },

    // === LOGIQUE DE JEU ===

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

        // Lignes 1-2 aléatoires
        for (let r = 1; r < 3; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (Math.random() > 0.4) {
                    grid[r][c] = this.createBubble(r, c);
                }
            }
        }

        // Nettoyer les bulles flottantes
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
            const neighbors = this.getNeighborCoords(curr.r, curr.c);

            for (const n of neighbors) {
                if (n.r >= 0 && n.r < Config.GRID_ROWS && n.c >= 0 && n.c < Config.GRID_COLS) {
                    if (grid[n.r][n.c] && !connected.has(`${n.r},${n.c}`)) {
                        connected.add(`${n.r},${n.c}`);
                        queue.push(n);
                    }
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

    createBubble(r, c, color = null) {
        return {
            r, c,
            color: color || Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)],
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
        return [
            { r: r - 1, c: odd ? c : c - 1 },
            { r: r - 1, c: odd ? c + 1 : c },
            { r: r, c: c - 1 },
            { r: r, c: c + 1 },
            { r: r + 1, c: odd ? c : c - 1 },
            { r: r + 1, c: odd ? c + 1 : c }
        ];
    },

    findBestSnapSpot(bubble) {
        let best = null;
        let minDist = Infinity;

        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (this.player.grid[r][c]) continue;

                const hasNeighbor = r === 0 || this.getNeighborCoords(r, c).some(n =>
                    n.r >= 0 && n.r < Config.GRID_ROWS && n.c >= 0 && n.c < Config.GRID_COLS &&
                    this.player.grid[n.r]?.[n.c]
                );

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

        return best;
    },

    findMatches(startR, startC) {
        const targetColor = this.player.grid[startR][startC]?.color;
        if (!targetColor) return [];

        const visited = new Set();
        const matches = [];
        const queue = [{ r: startR, c: startC }];

        while (queue.length > 0) {
            const { r, c } = queue.shift();
            const key = `${r},${c}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const bubble = this.player.grid[r]?.[c];
            if (!bubble || bubble.color !== targetColor) continue;

            matches.push({ r, c });

            for (const n of this.getNeighborCoords(r, c)) {
                if (n.r >= 0 && n.r < Config.GRID_ROWS && n.c >= 0 && n.c < Config.GRID_COLS) {
                    if (!visited.has(`${n.r},${n.c}`)) {
                        queue.push(n);
                    }
                }
            }
        }

        return matches;
    },

    handleAvalanche() {
        const connected = new Set();
        const queue = [];

        // Partir du plafond
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (this.player.grid[0][c]) {
                queue.push({ r: 0, c });
                connected.add(`0,${c}`);
            }
        }

        let head = 0;
        while (head < queue.length) {
            const curr = queue[head++];
            for (const n of this.getNeighborCoords(curr.r, curr.c)) {
                if (n.r >= 0 && n.r < Config.GRID_ROWS && n.c >= 0 && n.c < Config.GRID_COLS) {
                    if (this.player.grid[n.r][n.c] && !connected.has(`${n.r},${n.c}`)) {
                        connected.add(`${n.r},${n.c}`);
                        queue.push(n);
                    }
                }
            }
        }

        // Faire tomber les non-connectées
        let fallen = 0;
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (this.player.grid[r][c] && !connected.has(`${r},${c}`)) {
                    const { x, y } = this.getBubbleCoords(r, c);
                    this.player.fallingBubbles.push({
                        ...this.player.grid[r][c],
                        x, y,
                        vx: 0,
                        vy: 0.5
                    });
                    this.player.grid[r][c] = null;
                    fallen++;
                }
            }
        }

        return fallen;
    },

    checkGameOver() {
        // Vérifier si une bulle dépasse la ligne de game over
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (this.player.grid[Config.GAME_OVER_ROW]?.[c]) {
                this.player.isAlive = false;
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
