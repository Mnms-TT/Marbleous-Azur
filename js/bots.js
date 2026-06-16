/**
 * bots.js - Bots de salle (/bot x, 0-8)
 * Les bots tournent sur la machine du joueur qui les invoque : ce sont de
 * vrais documents joueurs Firestore, donc tous les humains de la salle les
 * voient jouer. Niveau intermédiaire : ils visent souvent juste, pas toujours.
 * Ils ramassent et lancent des sorts (événements, comme les humains),
 * attaquent, meurent, se remettent prêts entre les manches, et parlent.
 */

import { Config } from "./config.js";
import { Game } from "./game.js";
import { GameLogic } from "./gameLogic.js";
import { FirebaseController } from "./firebaseController.js";
import { UI } from "./ui.js";
import { roomId } from "./main.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const BOT_NAMES = ["Naya", "Marbo", "Tilt", "Pixou", "Lula", "Choco", "Zef", "Mirka"];

// Petites phrases maison (réactions + bavardage)
const PHRASES = {
    idle: [
        "ça monte vite là", "hop combo", "je vise mal aujourd'hui", "pas mal ce plateau",
        "qui joue les noires ?", "tranquille pour l'instant", "allez on enchaîne", "la chance du débutant"
    ],
    spellReceived: [
        "aïe, merci du cadeau", "qui m'a envoyé ça ?!", "on se calme avec les sorts",
        "ça tangue !", "même pas mal", "ok je note, vengeance"
    ],
    spellCast: ["tiens, cadeau", "ça part !", "attrape ça", "petit sort pour toi"],
    junkReceived: ["et voilà les boules...", "merci pour le réassort", "ça se remplit vite"],
    death: ["gg", "bien joué", "trop de boules pour moi", "je reviens plus fort"],
    ready: ["prêt !", "go", "c'est quand vous voulez"],
};

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export const BotManager = {
    bots: new Map(),

    botPrefix() {
        return `bot_${(FirebaseController.auth?.currentUser?.uid || "x").slice(0, 5)}`;
    },

    // /bot x : ajuste le nombre de bots actifs
    async setCount(n) {
        const current = this.bots.size;
        if (n > current) {
            const free = 10 - Game.players.size - (n - current);
            if (free < 0) {
                UI.addChatMessage("Système", "Pas assez de places libres dans la salle.");
                n = current + Math.max(0, 10 - Game.players.size);
            }
            for (let i = current; i < n; i++) await this.spawnBot(i);
        } else if (n < current) {
            const ids = Array.from(this.bots.keys()).slice(n);
            for (const id of ids) await this.removeBot(id);
        }
        UI.addChatMessage("Système", `${this.bots.size} bot(s) dans la salle.`);
    },

    async spawnBot(index) {
        const id = `${this.botPrefix()}_${index}`;
        if (this.bots.has(id)) return;

        const bot = {
            id,
            name: BOT_NAMES[index % BOT_NAMES.length],
            team: Math.floor(Math.random() * Config.TEAM_COLORS.length),
            grid: GameLogic.createInitialGrid(),
            score: 0,
            level: 1,
            spells: [],
            attackCounter: 0,
            // Invoqué en pleine manche : le bot attend la manche suivante
            alive: Game.state !== "playing",
            isReady: false,
            readyAt: Date.now() + 1000 + Math.random() * 3000,
            handicapUntil: 0,   // sorts canon cassé / plateau renversé : vise moins bien
            lastChat: Date.now(),
            lastSeenState: Game.state,
            unsubEvents: null,
            interval: null,
        };

        await FirebaseController.updatePlayerDoc(id, {
            name: bot.name,
            isAlive: bot.alive,
            isReady: false,
            team: bot.team,
            grid: JSON.stringify(bot.grid),
            score: 0,
            level: 1,
            spells: [],
            statusEffects: {},
            attackBubbleCounter: 0,
            lastActive: Date.now(),
        });

        // Le bot reçoit sorts et boules comme un humain (événements RTDB)
        bot.unsubEvents = FirebaseController.listenToEventsFor(id, (ev) => {
            this.handleBotEvent(bot, ev);
        });
        // Nettoyage automatique si l'hôte se déconnecte brutalement
        FirebaseController.registerDisconnectCleanup(id);

        bot.interval = setInterval(() => this.tick(bot), 1400 + Math.random() * 1300);
        this.bots.set(id, bot);
    },

    async removeBot(id) {
        const bot = this.bots.get(id);
        if (!bot) return;
        if (bot.interval) clearInterval(bot.interval);
        if (bot.unsubEvents) bot.unsubEvents();
        this.bots.delete(id);
        try { await FirebaseController.deletePlayerDoc(id); } catch (e) { /* best effort */ }
    },

    removeAll() {
        for (const id of Array.from(this.bots.keys())) this.removeBot(id);
    },

    // --- RÉCEPTION D'ÉVÉNEMENTS (sorts / boules) ---
    handleBotEvent(bot, ev) {
        if (!bot.alive) return;

        if (ev.type === "junk" && ev.count > 0) {
            this.addJunkToBot(bot, ev.count);
            if (Math.random() < 0.25) this.say(bot, pick(PHRASES.junkReceived));
        } else if (ev.type === "spell" && ev.spell) {
            this.applySpellToBot(bot, ev.spell);
            if (Math.random() < 0.5) this.say(bot, pick(PHRASES.spellReceived));
        }
        this.checkBotDeath(bot);
        this.pushBotState(bot, true);
    },

    addJunkToBot(bot, count) {
        const slots = [];
        for (let r = 0; r < Config.GRID_ROWS; r++)
            for (let c = 0; c < Config.GRID_COLS; c++)
                if (!bot.grid[r][c] &&
                    (r === 0 || GameLogic.getNeighborCoords(r, c).some(n => bot.grid[n.r]?.[n.c])))
                    slots.push({ r, c });
        slots.sort((a, b) => a.r - b.r);
        for (let i = 0; i < Math.min(slots.length, count); i++) {
            const s = slots[i];
            bot.grid[s.r][s.c] = GameLogic.createBubble(s.r, s.c);
        }
    },

    applySpellToBot(bot, spell) {
        const grid = bot.grid;
        switch (spell) {
            case "nukeBomb": {
                const cells = [];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]) cells.push({ r, c });
                cells.sort(() => 0.5 - Math.random());
                const toDestroy = Math.floor(cells.length * Config.nukeDestroyPercent());
                for (let i = 0; i < toDestroy; i++) grid[cells[i].r][cells[i].c] = null;
                // La nuke purge aussi les sorts restants du plateau
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]?.isSpellBubble) {
                            grid[r][c].isSpellBubble = false;
                            grid[r][c].spell = null;
                        }
                this.collectFloating(bot);
                break;
            }
            case "nettoyage": {
                // 9 boules les plus basses, contiguës depuis un côté aléatoire
                const fromLeft = Math.random() < 0.5;
                const cells = [];
                for (let r = Config.GRID_ROWS - 1; r >= 0 && cells.length < 9; r--) {
                    for (let i = 0; i < Config.GRID_COLS && cells.length < 9; i++) {
                        const c = fromLeft ? i : Config.GRID_COLS - 1 - i;
                        if (grid[r][c]) cells.push({ r, c });
                    }
                }
                for (const { r, c } of cells) {
                    const cell = grid[r][c];
                    if (cell?.isSpellBubble && cell.spell && bot.spells.length < Config.MAX_SPELLS)
                        bot.spells.push(cell.spell);
                    grid[r][c] = null;
                }
                this.collectFloating(bot);
                break;
            }
            case "boulesSupplementaires": {
                // Remplit les cases libres accrochables (haut d'abord), sans décaler
                const freeSlots = [];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (!grid[r][c] &&
                            (r === 0 || GameLogic.getNeighborCoords(r, c).some(n => grid[n.r]?.[n.c])))
                            freeSlots.push({ r, c });
                freeSlots.sort((a, b) => a.r - b.r);
                const toAdd = Math.min(freeSlots.length, 5 + Math.floor(Math.random() * 4));
                for (let i = 0; i < toAdd; i++) {
                    const s = freeSlots[i];
                    grid[s.r][s.c] = GameLogic.createBubble(s.r, s.c);
                }
                break;
            }
            case "variationCouleur":
            case "toutesMemeCouleur": {
                const newColor = Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)];
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]) {
                            grid[r][c].color = spell === "toutesMemeCouleur"
                                ? (Math.random() < 0.45 ? newColor : grid[r][c].color)
                                : Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)];
                        }
                break;
            }
            case "disparitionSorts": {
                if (bot.spells.length > 0) bot.spells.shift();
                for (let r = 0; r < Config.GRID_ROWS; r++)
                    for (let c = 0; c < Config.GRID_COLS; c++)
                        if (grid[r][c]?.isSpellBubble) {
                            grid[r][c].isSpellBubble = false;
                            grid[r][c].spell = null;
                        }
                break;
            }
            case "canonCasse":
            case "plateauRenverse":
                // Le bot vise nettement moins bien pendant 10s
                bot.handicapUntil = Date.now() + 10000;
                break;
        }
    },

    // Repart d'une manche fraîche : vivant, grille neuve, pas prêt
    resetBotForNewRound(bot, now = Date.now()) {
        bot.grid = GameLogic.createInitialGrid();
        bot.score = 0;
        bot.level = 1;
        bot.spells = [];
        bot.attackCounter = 0;
        bot.alive = true;
        bot.isReady = false;
        bot.readyAt = now + 1500 + Math.random() * 4000;
        bot.levelTimer = now;
    },

    // --- TICK PRINCIPAL ---
    tick(bot) {
        const now = Date.now();
        const wasReady = bot.isReady;
        const wasAlive = bot.alive;

        // Changement de manche : reset comme les humains (affichage lobby)
        if (Game.state === "waiting" && bot.lastSeenState !== "waiting") {
            this.resetBotForNewRound(bot, now);
        }
        // SÉCURITÉ anti-boucle : quand une manche DÉMARRE, le bot doit être
        // vivant et frais — même si l'état "waiting" a été manqué (cycle
        // rapide). Sinon un bot mort démarrait la manche déjà perdu, la manche
        // finissait aussitôt, et ça bouclait à l'infini.
        if (Game.state === "playing" && bot.lastSeenState !== "playing") {
            this.resetBotForNewRound(bot, now);
            bot.isReady = true; // déjà en jeu
        }
        bot.lastSeenState = Game.state;

        // Se mettre prêt en salle d'attente — UNIQUEMENT si vivant
        if (Game.state === "waiting" && bot.alive && !bot.isReady && now > bot.readyAt) {
            bot.isReady = true;
            if (Math.random() < 0.4) this.say(bot, pick(PHRASES.ready));
        }

        if (Game.state === "playing" && bot.alive) {
            this.simulateShot(bot);

            // Lancer un sort de temps en temps
            if (bot.spells.length > 0 && Math.random() < 0.18) {
                this.botCastSpell(bot);
            }

            // Attaque quand le compteur est plein (même règle que les humains)
            if (bot.attackCounter >= 10) {
                this.botAttack(bot);
            }

            // Niveau suit grossièrement la partie (30s)
            if (!bot.levelTimer) bot.levelTimer = now;
            if (now - bot.levelTimer > 30000) {
                bot.level++;
                bot.levelTimer = now;
            }

            this.checkBotDeath(bot);
        }

        // Bavardage occasionnel
        if (now - bot.lastChat > 25000 && Math.random() < 0.12) {
            this.say(bot, pick(PHRASES.idle));
        }

        // Synchro forcée si transition visible (prêt / mort), sinon throttle 3s
        this.pushBotState(bot, bot.isReady !== wasReady || bot.alive !== wasAlive);
    },

    // Tir simulé, niveau intermédiaire : cherche souvent (pas toujours) un combo
    simulateShot(bot) {
        const grid = bot.grid;
        const color = Config.BUBBLE_COLORS[Math.floor(Math.random() * Config.BUBBLE_COLORS.length)];

        const candidates = [];
        for (let r = 0; r < Config.GRID_ROWS; r++)
            for (let c = 0; c < Config.GRID_COLS; c++)
                if (!grid[r][c] &&
                    (r === 0 || GameLogic.getNeighborCoords(r, c).some(n => grid[n.r]?.[n.c])))
                    candidates.push({ r, c });
        if (candidates.length === 0) return;

        const handicapped = Date.now() < bot.handicapUntil;
        const smart = Math.random() < (handicapped ? 0.2 : 0.62);

        let spot = null;
        if (smart) {
            // Meilleure case : maximise les voisines de la même couleur
            let best = 0;
            for (const cand of candidates) {
                const same = GameLogic.getNeighborCoords(cand.r, cand.c)
                    .filter(n => grid[n.r]?.[n.c]?.color?.main === color.main).length;
                if (same > best) { best = same; spot = cand; }
            }
            if (best < 2 && Math.random() < 0.5) spot = null; // pas convaincu → tir "humain"
        }
        if (!spot) spot = candidates[Math.floor(Math.random() * candidates.length)];

        grid[spot.r][spot.c] = GameLogic.createBubble(spot.r, spot.c, color);
        const matches = GameLogic.findMatches(grid, spot.r, spot.c);

        if (matches.length >= 3) {
            matches.forEach(m => { grid[m.r][m.c] = null; });
            let cleared = matches.length;
            cleared += this.collectFloating(bot);
            bot.score += cleared * 10;
            bot.attackCounter += cleared;

            // Apparition d'un sort, comme chez les humains
            if (Math.random() < Config.SPELL_SPAWN_CHANCE) {
                const bubbles = grid.flat().filter(b => b && !b.isSpellBubble && b.r > 5);
                if (bubbles.length) {
                    const t = bubbles[Math.floor(Math.random() * bubbles.length)];
                    const spell = Config.COLOR_TO_SPELL_MAP[t.color.main];
                    if (spell) { t.spell = spell; t.isSpellBubble = true; }
                }
            }
        }
    },

    // Boules décrochées : tombent, sorts récupérés
    collectFloating(bot) {
        const floating = GameLogic.findFloatingBubbles(bot.grid);
        floating.forEach(b => {
            if (b.isSpellBubble && b.spell && bot.spells.length < Config.MAX_SPELLS)
                bot.spells.push(b.spell);
            bot.grid[b.r][b.c] = null;
        });
        return floating.length;
    },

    botCastSpell(bot) {
        const spellName = bot.spells.shift(); // FIFO : le plus ancien
        if (!spellName) return;

        const info = Config.SPELLS[spellName];
        const isDefensive = info?.type === "defensive";

        let target;
        if (isDefensive) {
            target = { id: bot.id, name: bot.name };
        } else {
            // Ennemis = tout joueur vivant d'une autre équipe (humain ou bot)
            const enemies = Array.from(Game.players.values())
                .filter(p => p.isAlive && p.team !== bot.team && p.id !== bot.id);
            if (enemies.length === 0) return;
            target = enemies[Math.floor(Math.random() * enemies.length)];
        }

        FirebaseController.announceSpell(bot.name, spellName, target.name);

        if (target.id === bot.id) {
            this.applySpellToBot(bot, spellName);
        } else {
            FirebaseController.sendEventToPlayer(target.id, {
                type: "spell", spell: spellName, from: bot.name,
            });
        }
        if (Math.random() < 0.3) this.say(bot, pick(PHRASES.spellCast));
    },

    botAttack(bot) {
        const units = Math.floor(bot.attackCounter / 10);
        const size = Config.attackSize(bot.level, units);
        // Niveau trop bas : on garde le compteur (pas de gaspillage)
        if (size <= 0) return;
        bot.attackCounter = bot.attackCounter % 10;

        Game.players.forEach(p => {
            if (p.id !== bot.id && p.isAlive && p.team !== bot.team) {
                FirebaseController.sendEventToPlayer(p.id, {
                    type: "junk", count: size, from: bot.name,
                });
            }
        });
    },

    checkBotDeath(bot) {
        if (!bot.alive) return;
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (bot.grid[Config.GAME_OVER_ROW]?.[c]) {
                bot.alive = false;
                if (Math.random() < 0.7) this.say(bot, pick(PHRASES.death));
                return;
            }
        }
    },

    // Synchroniser l'état du bot vers Firestore (les autres le voient jouer).
    // Throttle ~3s pour économiser le quota d'écritures ; force=true pour les
    // transitions importantes (prêt, mort, sort/boules reçus).
    pushBotState(bot, force = false) {
        const now = Date.now();
        if (!force && bot.lastPush && now - bot.lastPush < 3000) return;
        bot.lastPush = now;
        FirebaseController.updatePlayerDoc(bot.id, {
            grid: JSON.stringify(bot.grid),
            score: bot.score,
            level: bot.level,
            spells: bot.spells,
            isAlive: bot.alive,
            isReady: bot.isReady,
            attackBubbleCounter: bot.attackCounter,
            lastActive: now,
        }).catch(() => { });
    },

    say(bot, text) {
        bot.lastChat = Date.now();
        addDoc(collection(FirebaseController.db, "rooms", roomId, "chat"), {
            author: bot.name,
            uid: bot.id,
            team: bot.team,
            text,
            ts: Date.now(),
        }).catch(() => { });
    },
};
