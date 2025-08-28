const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialise l'application pour avoir accès à la base de données
initializeApp();

// Cette fonction est planifiée pour s'exécuter toutes les 5 minutes
exports.cleanupInactivePlayers = onSchedule("every 5 minutes", async (event) => {
  const db = getFirestore();
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

  console.log("Exécution du nettoyage des joueurs inactifs...");

  // 1. Récupérer toutes les salles
  const roomsSnapshot = await db.collection("rooms").get();
  if (roomsSnapshot.empty) {
    console.log("Aucune salle à vérifier. Fin de la tâche.");
    return null;
  }

  const promises = [];

  // 2. Parcourir chaque salle
  roomsSnapshot.forEach((roomDoc) => {
    const roomId = roomDoc.id;
    const roomRef = roomDoc.ref;
    const playersRef = roomRef.collection("players");

    // 3. Trouver les joueurs inactifs dans la salle
    const inactivePlayersQuery = playersRef.where("lastActive", "<", fiveMinutesAgo);
    
    const promise = inactivePlayersQuery.get().then(async (snapshot) => {
      if (snapshot.empty) {
        return;
      }
      
      // 4. Supprimer les joueurs inactifs et mettre à jour le compteur
      await db.runTransaction(async (transaction) => {
        const currentRoomDoc = await transaction.get(roomRef);
        if (!currentRoomDoc.exists) return;

        const currentCount = currentRoomDoc.data().playerCount || 0;
        const inactiveCount = snapshot.size;
        
        snapshot.forEach((playerDoc) => {
          transaction.delete(playerDoc.ref);
        });

        const newPlayerCount = Math.max(0, currentCount - inactiveCount);
        transaction.update(roomRef, { playerCount: newPlayerCount });
      });
    });

    promises.push(promise);
  });

  await Promise.all(promises);
  console.log("Nettoyage terminé.");
  return null;
});