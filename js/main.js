import { Game } from './game.js';

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

if (!roomId) {
    alert("Aucune salle spécifiée ! Redirection vers l'accueil.");
    window.location.href = 'index.html';
} else {
    window.addEventListener('load', () => {
        Game.init();
    });
}

export { roomId };