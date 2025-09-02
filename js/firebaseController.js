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
                document.getElementById('playerId').textContent = this.auth.currentUser.uid;
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
        const initialPlayerData = { 
            name: `Joueur_${localPlayerId.substring(0, 4)}`, isAlive: true, isReady: false, team: 0,
            grid: JSON.stringify(initialGrid), score: 0, level: 1, spells: [], statusEffects: {},
            lastActive: Date.now()
        };
        const roomRef = doc(this.db, "rooms", roomId);
        try {
            await runTransaction(this.db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                let currentCount = 0;
                if (roomDoc.exists()) {
                    currentCount = roomDoc.data().playerCount || 0;
                    if (currentCount >= 10) { throw "La salle est pleine !"; }
                }
                const playerRef = doc(this.db, "rooms", roomId, "players", localPlayerId);
                transaction.set(playerRef, initialPlayerData);
                const roomData = { name: `Salle ${roomId.split('_')[1]}`, playerCount: currentCount + 1 };
                if (currentCount === 0) { roomData.gameState = 'waiting'; }
                transaction.set(roomRef, roomData, { merge: true });
            });
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
            snapshot.docs.forEach(doc => {
                serverIds.add(doc.id);
                const data = doc.data();
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
            const alivePlayers = Array.from(Game.players.values()).filter(p => p.isAlive);
            if (Game.state === 'playing' && alivePlayers.length <= 1 && Game.players.size > 1) {
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
            } else if (sessionData.gameState === 'waiting' && currentGameState !== 'waiting') {
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