import { Config } from './config.js';
import { Game } from './game.js';
import { FirebaseController } from './firebaseController.js';
import { UI } from './ui.js';

export const GameLogic = {
    // ... (Le contenu complet de ce fichier est identique à la version que vous avez déjà)
    // Cependant, pour être absolument certain, voici l'intégralité.
    
    createEmptyGrid() {
        return Array(Config.GRID_ROWS).fill(null).map(() => Array(Config.GRID_COLS).fill(null));
    },

    createInitialGrid() {
        let grid = this.createEmptyGrid();
        for (let r = 0; r < 5; r++) { // Les 5 premières lignes sont remplies
            for (let c = 0; c < Config.GRID_COLS; c++) {
                grid[r][c] = this.createRandomBubble();
            }
        }
        return grid;
    },

    createRandomBubble(includeSpell = true) {
        const bubbleColors = Config.BUBBLE_COLORS;
        const randomIndex = Math.floor(Math.random() * bubbleColors.length);
        const color = bubbleColors[randomIndex].main;
        const shadow = bubbleColors[randomIndex].shadow;

        let isSpellBubble = false;
        let spellType = null;

        if (includeSpell && Math.random() < Config.SPELL_SPAWN_CHANCE) {
            isSpellBubble = true;
            spellType = Config.COLOR_TO_SPELL_MAP[color];
        }

        return { color: { main: color, shadow: shadow }, isSpellBubble, spell: spellType };
    },

    loadBubbles(player) {
        if (!player) return;
        player.launcherBubble = this.createRandomBubble(true);
        player.nextBubble = this.createRandomBubble(true);
    },

    updateLobbyAnimation() {
        const mainCanvas = document.getElementById('gameCanvas');
        if (!mainCanvas) return;
        Game.lobbyMarbles.forEach(marble => {
            marble.y += marble.vy;
            if (marble.y - marble.r > mainCanvas.height) {
                marble.y = -marble.r;
                marble.x = Math.random() * mainCanvas.width;
            }
        });
    },

    updateLocalAnimations() {
        const localPlayer = Game.localPlayer;
        if (!localPlayer) return;

        // Animate falling bubbles
        localPlayer.fallingBubbles.forEach(b => {
            b.y += 5; // Vitesse de chute
        });
        localPlayer.fallingBubbles = localPlayer.fallingBubbles.filter(b => b.y < document.getElementById('gameCanvas').height + Game.bubbleRadius);

        // Animate effects
        localPlayer.effects.forEach(e => e.life--);
        localPlayer.effects = localPlayer.effects.filter(e => e.life > 0);

        // Update launcher angle
        const rotationSpeed = localPlayer.statusEffects.canonEndommage ? 0 : Config.LAUNCHER_ROTATION_SPEED;
        if (Game.keys.left) localPlayer.launcher.angle -= rotationSpeed;
        if (Game.keys.right) localPlayer.launcher.angle += rotationSpeed;

        localPlayer.launcher.angle = Math.max(-Math.PI * 1, Math.min(0, localPlayer.launcher.angle));

        // Update shot bubble position
        if (localPlayer.shotBubble) {
            localPlayer.shotBubble.x += localPlayer.shotBubble.vx;
            localPlayer.shotBubble.y += localPlayer.shotBubble.vy;

            const rad = Game.bubbleRadius;
            const canvas = document.getElementById('gameCanvas');

            // Collision with walls
            if (localPlayer.shotBubble.x - rad < 0 || localPlayer.shotBubble.x + rad > canvas.width) {
                localPlayer.shotBubble.vx *= -1;
                localPlayer.shotBubble.x = Math.max(rad, Math.min(canvas.width - rad, localPlayer.shotBubble.x));
            }

            // Collision with ceiling
            if (localPlayer.shotBubble.y - rad < 0) {
                localPlayer.shotBubble.vy *= -1;
                localPlayer.shotBubble.y = rad;
            }

            // Collision with grid bubbles
            const hit = this.findGridCollision(localPlayer.shotBubble, localPlayer.grid, rad);
            if (hit) {
                this.addBubbleToGrid(localPlayer, localPlayer.shotBubble, hit.row, hit.col, rad);
                localPlayer.shotBubble = null;
                this.loadBubbles(localPlayer);
            }
        }
    },

    findGridCollision(shotBubble, grid, rad) {
        if (!shotBubble) return null;

        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (grid[r][c]) {
                    const { x, y } = this.getBubbleCoords(r, c, rad);
                    const dist = Math.hypot(shotBubble.x - x, shotBubble.y - y);
                    if (dist < rad * 2) {
                        return this.getNearestGridPosition(shotBubble, r, c, rad);
                    }
                }
            }
        }

        // Collision with the top of the grid if it's empty
        const firstRowY = this.getBubbleCoords(0, 0, rad).y;
        if (shotBubble.y - rad <= firstRowY && !grid[0].some(b => b !== null)) {
            // Find the closest column in the first row
            const targetCol = Math.round(shotBubble.x / (rad * 2));
            return { row: 0, col: Math.max(0, Math.min(Config.GRID_COLS - 1, targetCol)) };
        }
        
        return null;
    },

    getNearestGridPosition(shotBubble, hitRow, hitCol, rad) {
        let bestPos = { row: hitRow, col: hitCol };
        let minDist = Infinity;

        // Iterate over potential attachment points around the hit bubble
        const neighbors = [
            { dr: 0, dc: 1 }, { dr: 0, dc: -1 },
            { dr: 1, dc: 0 }, { dr: -1, dc: 0 }
        ];
        if (hitRow % 2 === 0) {
            neighbors.push({ dr: 1, dc: -1 }, { dr: -1, dc: -1 });
        } else {
            neighbors.push({ dr: 1, dc: 1 }, { dr: -1, dc: 1 });
        }

        for (const { dr, dc } of neighbors) {
            const newR = hitRow + dr;
            const newC = hitCol + dc;

            if (newR >= 0 && newR < Config.GRID_ROWS && newC >= 0 && newC < Config.GRID_COLS && !Game.localPlayer.grid[newR][newC]) {
                const { x, y } = this.getBubbleCoords(newR, newC, rad);
                const dist = Math.hypot(shotBubble.x - x, shotBubble.y - y);
                if (dist < minDist) {
                    minDist = dist;
                    bestPos = { row: newR, col: newC };
                }
            }
        }
        
        // Fallback: If no empty neighbor, place it on the hit bubble (shouldn't happen with correct logic)
        if (Game.localPlayer.grid[bestPos.row][bestPos.col]) {
            // Find any empty spot in the row if the bestPos is occupied
            for(let c = 0; c < Config.GRID_COLS; c++){
                if(!Game.localPlayer.grid[bestPos.row][c]) return {row: bestPos.row, col: c};
            }
            // If the row is full, try the row above/below
            if(bestPos.row + 1 < Config.GRID_ROWS && !Game.localPlayer.grid[bestPos.row + 1][bestPos.col]){
                return {row: bestPos.row + 1, col: bestPos.col};
            }
             if(bestPos.row - 1 >= 0 && !Game.localPlayer.grid[bestPos.row - 1][bestPos.col]){
                return {row: bestPos.row - 1, col: bestPos.col};
            }
        }

        return bestPos;
    },

    addBubbleToGrid(player, bubble, r, c, rad) {
        if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;
        if (player.grid[r][c] !== null) { // Fallback for occupied spot, find nearest empty
            const originalR = r;
            const originalC = c;
            let foundSpot = false;
            // Try neighbors
            const neighbors = [
                { dr: 0, dc: 1 }, { dr: 0, dc: -1 },
                { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
                { dr: 1, dc: 1 }, { dr: -1, dc: 1 },
                { dr: 1, dc: -1 }, { dr: -1, dc: -1 }
            ];
            for (const { dr, dc } of neighbors) {
                const newR = originalR + dr;
                const newC = originalC + dc;
                if (newR >= 0 && newR < Config.GRID_ROWS && newC >= 0 && newC < Config.GRID_COLS && !player.grid[newR][newC]) {
                    r = newR;
                    c = newC;
                    foundSpot = true;
                    break;
                }
            }
            if (!foundSpot) return; // If no empty spot, drop the bubble
        }


        player.grid[r][c] = bubble;
        FirebaseController.updatePlayerDoc(player.id, { grid: JSON.stringify(player.grid) });

        if (bubble.isSpellBubble) {
            this.collectSpell(player, bubble.spell);
        }

        const matches = this.findMatchingBubbles(player, r, c, bubble.color.main);
        if (matches.length >= 3) {
            this.popBubbles(player, matches);
            this.dropFloatingBubbles(player);
        } else {
            this.checkGameOver(player);
            this.moveGridDown(player, 1);
        }
    },

    findMatchingBubbles(player, r, c, color) {
        const queue = [{ r, c }];
        const visited = new Set([`${r},${c}`]);
        const matches = [];

        while (queue.length > 0) {
            const current = queue.shift();
            matches.push(current);

            this.getNeighbors(current.r, current.c).forEach(neighbor => {
                const { r: nr, c: nc } = neighbor;
                if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS &&
                    !visited.has(`${nr},${nc}`) && player.grid[nr][nc] && player.grid[nr][nc].color.main === color) {
                    visited.add(`${nr},${nc}`);
                    queue.push({ r: nr, c: nc });
                }
            });
        }
        return matches;
    },

    popBubbles(player, bubblesToPop) {
        const mainCanvas = document.getElementById('gameCanvas');
        const bubbleRadius = Game.bubbleRadius;

        let scoreIncrement = 0;
        bubblesToPop.forEach(({ r, c }) => {
            const poppedBubble = player.grid[r][c];
            if (poppedBubble) {
                const { x, y } = this.getBubbleCoords(r, c, bubbleRadius);
                player.effects.push({ type: 'pop', x, y, radius: 0, life: 10, color: poppedBubble.color.main });
                player.grid[r][c] = null;
                scoreIncrement++;

                if (poppedBubble.isSpellBubble) {
                    this.collectSpell(player, poppedBubble.spell);
                }
            }
        });

        player.score += scoreIncrement * 10;
        FirebaseController.updatePlayerDoc(player.id, { grid: JSON.stringify(player.grid), score: player.score });
    },

    dropFloatingBubbles(player) {
        const floating = new Set();
        const connected = new Set();

        // 1. Mark all bubbles connected to the ceiling
        const firstRowBubbles = player.grid[0];
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (firstRowBubbles[c]) {
                this.traverseConnectedBubbles(player, 0, c, connected);
            }
        }

        // 2. Find all bubbles NOT connected to the ceiling
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (player.grid[r][c] && !connected.has(`${r},${c}`)) {
                    floating.add(`${r},${c}`);
                }
            }
        }

        // 3. Drop floating bubbles
        floating.forEach(coord => {
            const [r, c] = coord.split(',').map(Number);
            if (player.grid[r][c]) {
                const { x, y } = this.getBubbleCoords(r, c, Game.bubbleRadius);
                player.fallingBubbles.push({ ...player.grid[r][c], x, y, vx: 0, vy: 5 }); // Add to falling
                player.grid[r][c] = null; // Remove from grid
                player.score += 5; // Score for dropping
            }
        });
        FirebaseController.updatePlayerDoc(player.id, { grid: JSON.stringify(player.grid), score: player.score });
    },

    traverseConnectedBubbles(player, r, c, visited) {
        const queue = [{ r, c }];
        visited.add(`${r},${c}`);

        while (queue.length > 0) {
            const current = queue.shift();

            this.getNeighbors(current.r, current.c).forEach(neighbor => {
                const { r: nr, c: nc } = neighbor;
                if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS &&
                    player.grid[nr][nc] && !visited.has(`${nr},${nc}`)) {
                    visited.add(`${nr},${nc}`);
                    queue.push({ r: nr, c: nc });
                }
            });
        }
    },

    getNeighbors(r, c) {
        const neighbors = [];
        const evenRowNeighbors = [{ dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: -1 }, { dr: 1, dc: 0 }, { dr: 1, dc: -1 }];
        const oddRowNeighbors = [{ dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }];

        const deltas = (r % 2 === 0) ? evenRowNeighbors : oddRowNeighbors;

        deltas.forEach(({ dr, dc }) => {
            neighbors.push({ r: r + dr, c: c + dc });
        });
        return neighbors;
    },

    getBubbleCoords(r, c, rad) {
        const yOffset = Config.GRID_VERTICAL_OFFSET;
        const x = c * rad * 2 + rad + (r % 2) * rad;
        const y = r * rad * Math.sqrt(3) + rad + yOffset;
        return { x, y };
    },

    checkGameOver(player) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (player.grid[Config.GAME_OVER_ROW][c] !== null) {
                this.loseGame(player);
                return true;
            }
        }
        return false;
    },

    loseGame(player) {
        player.isAlive = false;
        FirebaseController.updatePlayerDoc(player.id, { isAlive: false });
        UI.showNotification(`Le joueur ${player.name} a perdu !`, 'red');
        UI.updatePlayerStats();
    },

    levelUp() {
        Game.players.forEach(player => {
            if (player.isAlive) {
                player.level++;
                this.moveGridDown(player, 1);
                FirebaseController.updatePlayerDoc(player.id, { level: player.level, grid: JSON.stringify(player.grid) });
                UI.showNotification(`Le joueur ${player.name} passe au niveau ${player.level} !`, 'green');
                this.checkGameOver(player);
            }
        });
    },

    moveGridDown(player, rows) {
        for (let r = Config.GRID_ROWS - 1; r >= 0; r--) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                if (player.grid[r][c] !== null) {
                    const targetR = r + rows;
                    if (targetR < Config.GRID_ROWS) {
                        player.grid[targetR][c] = player.grid[r][c];
                        player.grid[r][c] = null;
                    } else {
                        // Bubbles pushed out of bounds at the bottom
                        player.grid[r][c] = null;
                    }
                }
            }
        }
        // Fill top row with new bubbles if space
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                player.grid[r][c] = this.createRandomBubble();
            }
        }
        FirebaseController.updatePlayerDoc(player.id, { grid: JSON.stringify(player.grid) });
    },

    collectSpell(player, spellType) {
        if (!spellType || player.spells.length >= Config.MAX_SPELLS) return;
        player.spells.push(spellType);
        FirebaseController.updatePlayerDoc(player.id, { spells: player.spells });
        UI.showNotification(`Le joueur ${player.name} a collecté le sort ${Config.SPELLS[spellType].name} !`);
        UI.updatePlayerStats();
    },

    castSpecificSpell(targetPlayer, spellIndex) {
        const casterPlayer = Game.localPlayer;
        if (!casterPlayer || spellIndex === null || spellIndex >= casterPlayer.