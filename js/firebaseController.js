import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase, ref as dbRef, get as dbGet, set as dbSet, update as dbUpdate, remove as dbRemove, push as dbPush, onValue, onChildAdded, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { Game } from './game.js';
import { Player } from './player.js';
import { GameLogic } from './gameLogic.js';
import { UI } from './ui.js';
import { Config } from './config.js';
import { roomId } from './main.js';

// ARCHITECTURE DONNÉES :
// - Realtime Database (europe-west1) : tout l'état de JEU — joueurs, grilles
//   (écrites case par case en diff), événements, annonces, session. Facturé au
//   volume téléchargé → quasi gratuit pour du temps réel à notre échelle.
// - Firestore : le reste — chat de salle, lobby, historique des connexions.
export const RTDB_URL = "https://marbleous-azur-default-rtdb.europe-west1.firebasedatabase.app";

export const FirebaseController = {
    db: null, rtdb: null, auth: null,
    unsubscribePlayers: null, unsubscribeGameSession: null, unsubscribeChat: null,
    unsubscribeEvents: null, unsubscribeAnnouncements: null,
    lastSentGrids: new Map(), // playerId -> { "r/c": "main|spell" } pour le diff par case

    async init() {
        const firebaseConfig = {
            apiKey: "AIzaSyCIMWeeRs9ZWh8izEtzV_P53ar95mNqZOw", authDomain: "marbleous-azur.firebaseapp.com",
            databaseURL: RTDB_URL,
            projectId: "marbleous-azur", storageBucket: "marbleous-azur.appspot.com",
            messagingSenderId: "297375682236", appId: "1:297375682236:web:765a8de117fdf961cdcab9",
            measurementId: "G-N1WVEB753N"
        };
        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        this.rtdb = getDatabase(app, RTDB_URL);
        this.auth = getAuth(app);
        try {
            await signInAnonymously(this.auth);
            if (this.auth.currentUser) {
                await this.joinGame();
            } else { throw new Error("Authentification anonyme échouée."); }
        } catch (error) {
            // Pas d'alert() bloquant : log + redirection différée
            console.error("Erreur d'initialisation Firebase:", error);
            setTimeout(() => { window.location.href = 'index.html'; }, 2500);
        }
    },

    // --- ENCODAGE GRILLE (compact, par case : "#couleur" ou "#couleur|sort") ---
    encodeCell(b) {
        if (!b || !b.color?.main) return null;
        return b.color.main + (b.isSpellBubble && b.spell ? "|" + b.spell : "");
    },

    decodeGridTree(tree) {
        const grid = GameLogic.createEmptyGrid();
        if (!tree) return grid;
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            const row = tree[r];
            if (!row) continue;
            for (let c = 0; c < Config.GRID_COLS; c++) {
                const v = row[c];
                if (!v) continue;
                const [main, spell] = String(v).split("|");
                const colorObj = Config.BUBBLE_COLORS.find(cc => cc.main === main)
                    || { main, shadow: main };
                grid[r][c] = {
                    r, c,
                    color: colorObj,
                    spell: spell || null,
                    isSpellBubble: !!spell,
                    isStatic: true,
                };
            }
        }
        return grid;
    },

    // Arbre complet (pour le set initial au join)
    encodeGridTree(gridArr) {
        const tree = {};
        const cache = {};
        for (let r = 0; r < Config.GRID_ROWS; r++) {
            for (let c = 0; c < Config.GRID_COLS; c++) {
                const enc = this.encodeCell(gridArr?.[r]?.[c]);
                cache[`${r}/${c}`] = enc;
                if (enc) {
                    if (!tree[r]) tree[r] = {};
                    tree[r][c] = enc;
                }
            }
        }
        return { tree, cache };
    },

    async joinGame() {
        if (!this.auth.currentUser) return;
        const localPlayerId = this.auth.currentUser.uid;
        const initialGrid = GameLogic.createInitialGrid();

        const urlParams = new URLSearchParams(window.location.search);
        const urlName = urlParams.get('name');
        const storedName = localStorage.getItem('marbleous_pseudo');
        const playerName = urlName || storedName || `Joueur_${localPlayerId.substring(0, 4)}`;
        const randomTeam = Math.floor(Math.random() * 5);

        try {
            // Étape 1 : compter les joueurs actifs, nettoyer les fantômes
            const playersSnap = await dbGet(dbRef(this.rtdb, `rooms/${roomId}/players`));
            const players = playersSnap.val() || {};
            const now = Date.now();
            let activeCount = 0;

            for (const [id, data] of Object.entries(players)) {
                if (id === localPlayerId) continue; // re-join
                if (now - (data.lastActive || 0) < 30000) {
                    activeCount++;
                } else {
                    this.deletePlayerDoc(id); // fantôme
                }
            }

            if (activeCount >= 10) {
                UI.addChatMessage("Système", "La salle est pleine ! Retour à l'accueil...");
                setTimeout(() => { window.location.href = 'index.html'; }, 2000);
                return;
            }

            // Étape 2 : état de session
            const sessSnap = await dbGet(dbRef(this.rtdb, `rooms/${roomId}/session`));
            let gameState = sessSnap.val()?.gameState || 'waiting';
            if (activeCount === 0) gameState = 'waiting';

            let isSpectator = false;
            const playerData = {
                name: playerName, isAlive: true, isReady: false, isSpectator: false,
                team: randomTeam, score: 0, level: 1, spells: [], statusEffects: {},
                attackBubbleCounter: 0, lastActive: now,
            };
            if (activeCount > 0 && (gameState === 'playing' || gameState === 'countdown')) {
                isSpectator = true;
                playerData.isAlive = false;
                playerData.isSpectator = true;
            }

            // Étape 3 : écrire son nœud joueur (grille encodée par case)
            const { tree, cache } = this.encodeGridTree(initialGrid);
            this.lastSentGrids.set(localPlayerId, cache);
            await dbSet(dbRef(this.rtdb, `rooms/${roomId}/players/${localPlayerId}`), {
                ...playerData,
                grid: tree,
            });

            await dbUpdate(dbRef(this.rtdb), {
                [`rooms/${roomId}/session/gameState`]: gameState,
                [`roomsMeta/${roomId}/players/${localPlayerId}/name`]: playerName,
                [`roomsMeta/${roomId}/players/${localPlayerId}/lastActive`]: now,
            });

            // Nettoyage automatique à la déconnexion (fermeture onglet, crash...)
            this.registerDisconnectCleanup(localPlayerId);

            if (isSpectator) Game.state = 'spectating';

            this.listenForGameChanges();
            this.listenToRoomChat();
            this.listenToMyEvents();
            this.listenToAnnouncements();
            Game.gameLoop();
        } catch (e) {
            console.error("Erreur pour rejoindre la salle: ", e);
            UI.addChatMessage("Système", "Erreur de connexion à la salle. Retour à l'accueil...");
            setTimeout(() => { window.location.href = 'index.html'; }, 2500);
        }
    },

    registerDisconnectCleanup(playerId) {
        onDisconnect(dbRef(this.rtdb, `rooms/${roomId}/players/${playerId}`)).remove();
        onDisconnect(dbRef(this.rtdb, `roomsMeta/${roomId}/players/${playerId}`)).remove();
        onDisconnect(dbRef(this.rtdb, `rooms/${roomId}/events/${playerId}`)).remove();
    },

    listenForGameChanges() {
        if (this.unsubscribePlayers) this.unsubscribePlayers();
        this.unsubscribePlayers = onValue(dbRef(this.rtdb, `rooms/${roomId}/players`), (snap) => {
            const val = snap.val() || {};
            const serverIds = new Set();
            const now = Date.now();

            for (const [id, raw] of Object.entries(val)) {
                // Anti-fantôme : inactif > 30s → supprimé. Jamais pour soi-même.
                if (now - (raw.lastActive || 0) > 30000 && id !== this.auth.currentUser.uid) {
                    this.deletePlayerDoc(id);
                    continue;
                }

                serverIds.add(id);
                const data = { ...raw, grid: this.decodeGridTree(raw.grid) };
                if (!Game.players.has(id)) {
                    const newPlayer = new Player(id, data);
                    if (id !== this.auth.currentUser.uid) {
                        newPlayer.createOpponentUI();
                    }
                    Game.players.set(id, newPlayer);
                } else {
                    Game.players.get(id).update(data);
                }
            }

            for (const id of Game.players.keys()) if (!serverIds.has(id)) Game.players.delete(id);
            Game.localPlayer = Game.players.get(this.auth.currentUser.uid);

            if (Game.localPlayer && !Game.heartbeatInterval) GameLogic.startHeartbeat();

            // Annonces entrée/sortie de salle (avec pseudo). On saute le premier
            // snapshot pour ne pas annoncer tous ceux déjà présents à l'arrivée.
            const myId = this.auth.currentUser.uid;
            const liveNames = new Map();
            for (const [id, raw] of Object.entries(val)) {
                if (now - (raw.lastActive || 0) <= 30000) liveNames.set(id, raw.name || 'Joueur');
            }
            if (this.knownPlayers) {
                for (const [id, name] of liveNames) {
                    if (id !== myId && !this.knownPlayers.has(id)) {
                        UI.addChatMessage('Système', `${name} a rejoint la salle.`);
                    }
                }
                for (const [id, name] of this.knownPlayers) {
                    if (id !== myId && !liveNames.has(id)) {
                        UI.addChatMessage('Système', `${name} a quitté la salle.`);
                    }
                }
            }
            this.knownPlayers = liveNames;

            this.evaluateRoundEnd();

            // Regroupé et throttlé : un rafraîchissement UI max toutes les 200ms
            UI.scheduleRoomRefresh();
        });

        if (this.unsubscribeGameSession) this.unsubscribeGameSession();
        this.unsubscribeGameSession = onValue(dbRef(this.rtdb, `rooms/${roomId}/session`), (snap) => {
            const sessionData = snap.val();
            if (!sessionData) return;
            const currentGameState = Game.state;
            if (sessionData.gameState === 'countdown' && currentGameState === 'waiting') {
                Game.state = 'countdown'; UI.startCountdown();
            } else if (sessionData.gameState === 'playing' && currentGameState !== 'playing') {
                UI.stopCountdown(); Game.start();
            } else if (sessionData.gameState === 'waiting' && (currentGameState !== 'waiting' || currentGameState === 'spectating')) {
                if (currentGameState === 'spectating' && Game.localPlayer) {
                    Game.localPlayer.isSpectator = false;
                    Game.localPlayer.isAlive = true;
                    this.updatePlayerDoc(Game.localPlayer.id, { isSpectator: false, isAlive: true, isReady: false });
                }
                Game.resetForNewRound();
            }
        });
    },

    // --- ANNONCES DE SORTS (un nœud par sort : rien ne s'écrase) ---
    listenToAnnouncements() {
        if (this.unsubscribeAnnouncements) this.unsubscribeAnnouncements();
        const joinTs = Date.now();
        this.unsubscribeAnnouncements = onChildAdded(
            dbRef(this.rtdb, `rooms/${roomId}/announcements`),
            (snap) => {
                const a = snap.val();
                if (!a || !a.ts || a.ts < joinTs) return; // historique pré-arrivée
                UI.queueSpellAnnouncement(a.casterName, a.spell, a.targetName);
            }
        );
    },

    async announceSpell(casterName, spell, targetName) {
        const annRef = dbPush(dbRef(this.rtdb, `rooms/${roomId}/announcements`), {
            casterName, spell, targetName, ts: Date.now()
        });
        // Ménage : l'annonce ne sert plus à rien après 30s
        setTimeout(() => dbRemove(annRef).catch(() => { }), 30000);
    },

    // Fin de manche : confirmée seulement si elle TIENT ~700ms (évite les faux
    // positifs dus aux synchros transitoires — un joueur vivant brièvement
    // absent/mort dans un snapshot). C'est l'HÔTE qui annonce le vainqueur à
    // tous via le chat partagé, pour un message unique et cohérent.
    evaluateRoundEnd() {
        if (Game.state !== 'playing' || Game.gameEndAnnounced) {
            this.pendingEnd = null;
            return;
        }

        const alive = Array.from(Game.players.values()).filter(p => p.isAlive && !p.isSpectator);
        const active = Array.from(Game.players.values()).filter(p => !p.isSpectator);
        const aliveTeams = new Set(alive.map(p => p.team ?? 0));
        const activeTeams = new Set(active.map(p => p.team ?? 0));

        const ended =
            (active.length === 1 && alive.length === 0) ||                  // solo
            (active.length > 1 && (
                alive.length === 0 ||                                       // tout le monde mort
                (aliveTeams.size <= 1 && activeTeams.size > 1)              // une seule équipe survivante
            ));

        if (!ended) { this.pendingEnd = null; return; }
        if (this.pendingEnd) return; // confirmation déjà en cours

        this.pendingEnd = setTimeout(() => {
            this.pendingEnd = null;
            if (Game.state !== 'playing' || Game.gameEndAnnounced) return;

            // Re-vérifier : la condition tient-elle toujours ?
            const a = Array.from(Game.players.values()).filter(p => p.isAlive && !p.isSpectator);
            const act = Array.from(Game.players.values()).filter(p => !p.isSpectator);
            const aTeams = new Set(a.map(p => p.team ?? 0));
            const actTeams = new Set(act.map(p => p.team ?? 0));
            const stillEnded =
                (act.length === 1 && a.length === 0) ||
                (act.length > 1 && (a.length === 0 || (aTeams.size <= 1 && actTeams.size > 1)));
            if (!stillEnded) return;

            Game.gameEndAnnounced = true;

            // Annonce du vainqueur dans le chat partagé — par l'hôte uniquement
            const hostId = Array.from(Game.players.keys()).filter(id => !id.startsWith('bot_')).sort()[0];
            if (this.auth.currentUser?.uid === hostId) {
                const teamColors = ['Jaune', 'Rouge', 'Vert', 'Bleu', 'Rose'];
                let msg;
                if (a.length > 0) {
                    const teamName = teamColors[a[0].team] || 'Inconnue';
                    msg = `🏆 L'équipe ${teamName} a gagné ! (${a.map(p => p.name).join(', ')})`;
                } else {
                    msg = '🏆 Partie terminée, aucun survivant !';
                }
                this.sendChatMessage(msg).catch(() => { });
            }

            this.recordGameResult(!!(Game.localPlayer?.isAlive && !Game.localPlayer?.isSpectator));
            this.updateSessionDoc({ gameState: 'waiting' });
        }, 700);
    },

    // --- ÉVÉNEMENTS JOUEUR (attaques & sorts) ---
    // Chaque joueur est propriétaire de SA grille : les adversaires envoient des
    // événements, la victime les applique localement puis écrit sa propre grille.
    async sendEventToPlayer(targetId, payload) {
        await dbPush(dbRef(this.rtdb, `rooms/${roomId}/events/${targetId}`), {
            ...payload,
            ts: Date.now()
        });
    },

    // Écoute des événements d'un joueur (utilisé pour soi-même ET par les bots)
    listenToEventsFor(playerId, handler) {
        const joinTs = Date.now();
        return onChildAdded(dbRef(this.rtdb, `rooms/${roomId}/events/${playerId}`), (snap) => {
            const ev = snap.val();
            dbRemove(snap.ref).catch(() => { }); // consommé : une seule application
            if (!ev || !ev.ts || ev.ts < joinTs - 15000) return; // vieux restes
            handler(ev);
        });
    },

    listenToMyEvents() {
        if (this.unsubscribeEvents) this.unsubscribeEvents();
        this.unsubscribeEvents = this.listenToEventsFor(this.auth.currentUser.uid, (ev) => {
            if (!Game.localPlayer?.isAlive || Game.state !== "playing") return;
            if (ev.type === "spell" && ev.spell) {
                GameLogic.applySpellEffect(Game.localPlayer, ev.spell, ev.from || null);
            } else if (ev.type === "junk" && ev.count > 0) {
                GameLogic.receiveJunk(ev.count);
            }
        });
    },

    // --- CHAT DE SALLE (reste sur Firestore : faible volume) ---
    listenToRoomChat() {
        if (this.unsubscribeChat) this.unsubscribeChat();
        const chatRef = collection(this.db, "rooms", roomId, "chat");
        const q = query(chatRef, orderBy("ts", "desc"), limit(50));
        this.unsubscribeChat = onSnapshot(q, (snapshot) => {
            const myUid = this.auth.currentUser?.uid;
            const msgs = [];
            snapshot.docs.forEach(d => {
                const m = d.data();
                if (!m.toUid || m.uid === myUid || m.toUid === myUid) msgs.unshift(m);
            });
            UI.remoteChat = msgs;
            UI.renderChat();
        }, (err) => console.warn("Chat indisponible:", err?.message));
    },

    async sendChatMessage(text, toUid = null, toName = null) {
        if (!text || !this.auth.currentUser) return;
        const msg = {
            author: Game.localPlayer?.name || 'Joueur',
            uid: this.auth.currentUser.uid,
            team: Game.localPlayer?.team ?? null,
            text,
            ts: Date.now()
        };
        if (toUid) { msg.toUid = toUid; msg.toName = toName; }
        await addDoc(collection(this.db, "rooms", roomId, "chat"), msg);
    },

    // --- ÉCRITURES JOUEUR : un seul update multi-chemins, grille en diff par case ---
    async updatePlayerDoc(playerId, data) {
        const updates = {};
        const base = `rooms/${roomId}/players/${playerId}`;

        for (const [k, v] of Object.entries(data)) {
            if (k === "grid") continue;
            updates[`${base}/${k}`] = (v === undefined) ? null : v;
        }

        if (data.grid !== undefined) {
            // grid arrive en JSON string (héritage) ou en tableau
            const arr = typeof data.grid === "string" ? JSON.parse(data.grid) : data.grid;
            const prev = this.lastSentGrids.get(playerId) || {};
            const next = {};
            for (let r = 0; r < Config.GRID_ROWS; r++) {
                for (let c = 0; c < Config.GRID_COLS; c++) {
                    const key = `${r}/${c}`;
                    const enc = this.encodeCell(arr?.[r]?.[c]);
                    next[key] = enc;
                    if ((prev[key] ?? null) !== enc) {
                        updates[`${base}/grid/${key}`] = enc; // null = suppression de la case
                    }
                }
            }
            this.lastSentGrids.set(playerId, next);
        }

        // Miroir léger pour les compteurs du lobby
        if (data.name !== undefined) updates[`roomsMeta/${roomId}/players/${playerId}/name`] = data.name;
        if (data.lastActive !== undefined) updates[`roomsMeta/${roomId}/players/${playerId}/lastActive`] = data.lastActive;

        if (Object.keys(updates).length > 0) {
            await dbUpdate(dbRef(this.rtdb), updates);
        }
    },

    // Classement global : victoires + meilleur score, chacun écrit sa propre entrée
    async recordGameResult(won) {
        try {
            const uid = this.auth.currentUser?.uid;
            const p = Game.localPlayer;
            if (!uid || !p) return;
            const entryRef = dbRef(this.rtdb, `leaderboard/${uid}`);
            const snap = await dbGet(entryRef);
            const cur = snap.val() || {};
            await dbUpdate(entryRef, {
                name: p.name,
                wins: (cur.wins || 0) + (won ? 1 : 0),
                bestScore: Math.max(cur.bestScore || 0, p.score || 0),
                ts: Date.now(),
            });
        } catch (e) { console.warn("leaderboard:", e?.message); }
    },

    async updateSessionDoc(data) {
        // ts : garantit un événement onValue même si gameState reprend la même
        // valeur (sinon réécrire "countdown" sur "countdown" ne déclenche rien)
        await dbUpdate(dbRef(this.rtdb, `rooms/${roomId}/session`), { ...data, ts: Date.now() });
    },

    async deletePlayerDoc(playerId) {
        this.lastSentGrids.delete(playerId);
        try {
            await dbUpdate(dbRef(this.rtdb), {
                [`rooms/${roomId}/players/${playerId}`]: null,
                [`roomsMeta/${roomId}/players/${playerId}`]: null,
                [`rooms/${roomId}/events/${playerId}`]: null,
            });
        } catch (e) { console.error("Erreur pour quitter la salle: ", e); }
    }
};
