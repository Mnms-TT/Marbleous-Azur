import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, runTransaction, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { Game } from './game.js';
import { Player } from './player.js';
import { GameLogic } from './gameLogic.js';
import { UI } from './ui.js';
import { roomId } from './main.js';

export const FirebaseController = {
    db: null, auth: null, unsubscribePlayers: null, unsubscribeGameSession: null,

    async init() {
        const firebaseConfig = {
            apiKey: "AIzaSyCIMWeeRs9ZWh8izEtzV_P53ar95mNqZOw", authDomain: "marbleous-azur.firebaseapp.com",
            projectId: "marbleous-azur", storageBucket: "marbleous-azur.appspot.com",
            messagingSenderId: "297375682236", appId: "1:297375682236:web:765a8de117fdf961cdcab9",
            measurementId: "G-N1WVEB753N"
        };
        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        this.auth = getAuth(app);
        try {
            await signInAnonymously(this.auth);
            if (this.auth.currentUser) {
                // CHANGEMENT : On supprime cette ligne qui cause l'erreur
                // document.getElementById('playerId').textContent = this.auth.currentUser.uid;
                await this.joinGame();
            } else { throw new Error("Authentification anonyme échouée."); }
        } catch (error) {
            console.error("Erreur d'initialisation Firebase:", error);
            alert("Impossible de se connecter au jeu. Redirection vers l'accueil.");
            window.location.href = 'index.html';
        }
    },

    async joinGame() {
        if (!this.auth.currentUser) return;
        const localPlayerId = this.auth.currentUser.uid;
        let initialGrid = GameLogic.createInitialGrid();

        // Récupérer le pseudo depuis l'URL ou localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const urlName = urlParams.get('name');
        const storedName = localStorage.getItem('marbleous_pseudo');
        const playerName = urlName || storedName || `Joueur_${localPlayerId.substring(0, 4)}`;

        // Équipe aléatoire à l'entrée (0-4)
        const randomTeam = Math.floor(Math.random() * 5);

        const initialPlayerData = {
            name: playerName, isAlive: true, isReady: false, team: randomTeam,
            grid: JSON.stringify(initialGrid), score: 0, level: 1, spells: [], statusEffects: {},
            lastActive: Date.now()
        };

        const roomRef = doc(this.db, "rooms", roomId);

        try {
            let isSpectator = false;

            // Étape 1 : Compter les vrais joueurs actifs (pas le compteur stale)
            const playersSnap = await getDocs(collection(this.db, "rooms", roomId, "players"));
            const now = Date.now();
            let activeCount = 0;
            const ghostIds = [];

            playersSnap.docs.forEach(d => {
                const data = d.data();
                if (d.id === localPlayerId) return; // Ignorer soi-même (re-join)
                if (now - (data.lastActive || 0) < 30000) {
                    activeCount++;
                } else {
                    ghostIds.push(d.id); // Fantôme à nettoyer
                }
            });

            // Nettoyer les fantômes
            for (const gid of ghostIds) {
                try { await deleteDoc(doc(this.db, "rooms", roomId, "players", gid)); } catch (e) { /* ignore */ }
            }

            if (activeCount >= 10) {
                alert("La salle est pleine !");
                window.location.href = 'index.html';
                return;
            }

            // Étape 2 : Rejoindre via transaction
            await runTransaction(this.db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                let gameState = 'waiting';

                if (roomDoc.exists()) {
                    const roomData = roomDoc.data();
                    gameState = roomData.gameState || 'waiting';

                    // Si aucun joueur actif, forcer l'état à 'waiting'
                    if (activeCount === 0) {
                        gameState = 'waiting';
                    }

                    // Si partie en cours et joueurs actifs, rejoindre en tant que spectateur
                    if (activeCount > 0 && (gameState === 'playing' || gameState === 'countdown')) {
                        isSpectator = true;
                        initialPlayerData.isAlive = false;
                        initialPlayerData.isSpectator = true;
                    }
                }

                const playerRef = doc(this.db, "rooms", roomId, "players", localPlayerId);
                transaction.set(playerRef, initialPlayerData);

                // Mettre à jour le document de la salle avec le vrai compte
                const realCount = activeCount + 1; // +1 pour soi-même
                const roomDataUpdate = {
                    name: `Salle ${roomId.split('_')[1]}`,
                    playerCount: realCount,
                    gameState: gameState
                };
                transaction.set(roomRef, roomDataUpdate, { merge: true });
            });

            // Si spectateur, mettre le jeu en mode spectateur
            if (isSpectator) {
                Game.state = 'spectating';
            }

            this.listenForGameChanges();
            Game.gameLoop();
        } catch (e) {
            console.error("Erreur pour rejoindre la salle: ", e);
            alert("Erreur : " + (typeof e === 'string' ? e : e.message));
            window.location.href = 'index.html';
        }
    },

    listenForGameChanges() {
        if (this.unsubscribePlayers) this.unsubscribePlayers();
        const playersCollection = collection(this.db, "rooms", roomId, "players");
        this.unsubscribePlayers = onSnapshot(playersCollection, (snapshot) => {
            const serverIds = new Set();
            const now = Date.now();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Filtre anti-fantôme : Si inactif depuis > 60 secondes, on l'ignore et on le supprime
                if (now - (data.lastActive || 0) > 30000) {
                    // Nettoyage actif des fantômes (sauf soi-même)
                    if (doc.id !== this.auth.currentUser.uid) {
                        this.deletePlayerDoc(doc.id);
                    }
                    return;
                }

                serverIds.add(doc.id);
                if (!Game.players.has(doc.id)) {
                    const newPlayer = new Player(doc.id, data);
                    if (doc.id !== this.auth.currentUser.uid) {
                        newPlayer.createOpponentUI();
                    }
                    Game.players.set(doc.id, newPlayer);
                } else {
                    Game.players.get(doc.id).update(data);
                }
            });
            for (const id of Game.players.keys()) if (!serverIds.has(id)) Game.players.delete(id);
            Game.localPlayer = Game.players.get(this.auth.currentUser.uid);

            // Démarrage du heartbeat si pas encore fait
            if (Game.localPlayer && !Game.heartbeatInterval) GameLogic.startHeartbeat();

            const alivePlayers = Array.from(Game.players.values()).filter(p => p.isAlive && !p.isSpectator);
            const activePlayers = Array.from(Game.players.values()).filter(p => !p.isSpectator);

            // Fin de partie: soit 1 seul joueur qui meurt, soit multi et reste 1 ou 0
            const gameEnded = Game.state === 'playing' && !Game.gameEndAnnounced && (
                (activePlayers.length === 1 && alivePlayers.length === 0) || // Solo: joueur mort
                (activePlayers.length > 1 && alivePlayers.length <= 1) // Multi: 1 ou 0 survivants
            );

            if (gameEnded) {
                Game.gameEndAnnounced = true;

                // Annoncer le gagnant
                const winner = alivePlayers[0];
                if (winner) {
                    const teamColors = ['Jaune', 'Rouge', 'Vert', 'Bleu'];
                    const teamName = teamColors[winner.team] || 'Inconnue';
                    UI.addChatMessage('🏆 Système', `L'équipe ${teamName} a gagné ! (${winner.name})`);
                } else {
                    UI.addChatMessage('🏆 Système', 'Partie terminée !');
                }

                // Reset immédiat
                this.updateSessionDoc({ gameState: 'waiting' });
            }
            UI.renderOpponents();
            UI.updatePlayerStats();
            UI.checkVoteStatus();
            UI.resizeAllCanvases();
        });
        if (this.unsubscribeGameSession) this.unsubscribeGameSession();
        const sessionDoc = doc(this.db, "rooms", roomId);
        this.unsubscribeGameSession = onSnapshot(sessionDoc, (doc) => {
            const sessionData = doc.data(); if (!sessionData) return;
            const currentGameState = Game.state;
            if (sessionData.gameState === 'countdown' && currentGameState === 'waiting') {
                Game.state = 'countdown'; UI.startCountdown();
            } else if (sessionData.gameState === 'playing' && currentGameState !== 'playing') {
                UI.stopCountdown(); Game.start();
            } else if (sessionData.gameState === 'waiting' && (currentGameState !== 'waiting' || currentGameState === 'spectating')) {
                // Spectateurs deviennent joueurs actifs
                if (currentGameState === 'spectating' && Game.localPlayer) {
                    Game.localPlayer.isSpectator = false;
                    Game.localPlayer.isAlive = true;
                    this.updatePlayerDoc(Game.localPlayer.id, { isSpectator: false, isAlive: true, isReady: false });
                }
                Game.resetForNewRound();
            }
        });
    },

    async updatePlayerDoc(playerId, data) { await setDoc(doc(this.db, "rooms", roomId, "players", playerId), data, { merge: true }); },
    async updateSessionDoc(data) { await setDoc(doc(this.db, "rooms", roomId), data, { merge: true }); },
    async deletePlayerDoc(playerId) {
        const roomRef = doc(this.db, "rooms", roomId);
        const playerRef = doc(this.db, "rooms", roomId, "players", playerId);
        try {
            await runTransaction(this.db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;
                const newPlayerCount = Math.max(0, (roomDoc.data().playerCount || 1) - 1);
                transaction.delete(playerRef);
                transaction.update(roomRef, { playerCount: newPlayerCount });
            });
        } catch (e) { console.error("Erreur pour quitter la salle: ", e); }
    }
};