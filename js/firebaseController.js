import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

        const initialPlayerData = {
            name: playerName, isAlive: true, isReady: false, team: 0,
            grid: JSON.stringify(initialGrid), score: 0, level: 1, spells: [], statusEffects: {},
            lastActive: Date.now()
        };
        const roomRef = doc(this.db, "rooms", roomId);
        try {
            let isSpectator = false;
            await runTransaction(this.db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                let currentCount = 0;
                if (roomDoc.exists()) {
                    const roomData = roomDoc.data();
                    currentCount = roomData.playerCount || 0;
                    if (currentCount >= 10) { throw "La salle est pleine !"; }
                    // Si partie en cours, rejoindre en tant que spectateur
                    if (roomData.gameState === 'playing' || roomData.gameState === 'countdown') {
                        isSpectator = true;
                        initialPlayerData.isAlive = false;
                        initialPlayerData.isSpectator = true;
                    }
                }
                const playerRef = doc(this.db, "rooms", roomId, "players", localPlayerId);
                transaction.set(playerRef, initialPlayerData);
                const roomDataUpdate = { name: `Salle ${roomId.split('_')[1]}`, playerCount: currentCount + 1 };
                if (currentCount === 0) { roomDataUpdate.gameState = 'waiting'; }
                transaction.set(roomRef, roomDataUpdate, { merge: true });
            });

            // Si spectateur, mettre le jeu en mode spectateur (waiting avec animation)
            if (isSpectator) {
                Game.state = 'spectating';
            }

            // GESTION DECONNEXION (Ghost Players)
            const { onDisconnect } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
            // Note: onDisconnect fonctionne avec Realtime Database, pas Firestore directement pour la présence.
            // Firestore n'a pas de "onDisconnect" natif simple comme RTDB.
            // Cependant, on peut utiliser une astuce ou simplement s'assurer que le nettoyage est fait.
            // Pour ce projet, si on n'a pas RTDB configuré, on doit renforcer le beforeunload.
            // MAIS, le user dit "c'est une catastrophe", donc on va essayer de faire mieux.
            // Si on ne peut pas utiliser RTDB, on va améliorer le nettoyage manuel.

            // Correction: Firestore n'a PAS de onDisconnect. Il faut utiliser Realtime Database pour la présence fiable.
            // Si le projet n'a pas RTDB activé, on est coincé avec beforeunload.
            // On va supposer qu'on peut améliorer le beforeunload avec sendBeacon.

            this.listenForGameChanges();
            Game.gameLoop();
        } catch (e) {
            console.error("Erreur pour rejoindre la salle: ", e);
            alert(e);
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
                if (now - (data.lastActive || 0) > 60000) {
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
            if (Game.state === 'playing' && alivePlayers.length <= 1 && Game.players.size > 1 && !Game.gameEndAnnounced) {
                Game.gameEndAnnounced = true; // Éviter multiples annonces

                // Annoncer le gagnant
                const winner = alivePlayers[0];
                if (winner) {
                    const teamColors = ['Jaune', 'Rouge', 'Vert', 'Bleu'];
                    const teamName = teamColors[winner.team] || 'Inconnue';
                    UI.addChatMessage('🏆 Système', `L'équipe ${teamName} a gagné ! (${winner.name})`);
                } else {
                    UI.addChatMessage('🏆 Système', 'Match nul ! Aucun survivant.');
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