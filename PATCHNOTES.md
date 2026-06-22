# 🔮 MARBLEOUS — Notes de mise à jour

---

## Patch 0.3 — 17 juin 2026

### 🌍 ACCUEIL & LOBBY

- **Plus d'écran de saisie du pseudo** : tu arrives directement dans le lobby. Une petite boîte ✏️ dans l'en-tête des salles permet de changer de pseudo à tout moment.
- **On voit qui est dans chaque salle** : les cartes de salle listent les joueurs présents, chacun coloré selon sa couleur d'équipe.
- **Classement** : une seule ligne par joueur, trié par meilleur score puis par victoires. Le score de l'échauffement compte aussi. *(Le classement a été remis à zéro avec cette mise à jour.)*
- Les réglages **/fps** et **/canon** sont sauvegardés et conservés quand tu changes de salle.
- À l'échauffement, **parler dans le chat ne bloque plus le jeu** : après l'envoi, les flèches/Espace remarchent sans recliquer.

### 🎮 GAMEPLAY & DIFFICULTÉ

- **Nouveau calcul du score** : `boules éclatées × 10 × niveau^1,5`. La base vient du nombre de boules claquées (avalanche comprise), et le **niveau pèse fortement** (puissance 1,5). Un même combo de 10 boules vaut 100 pts au niveau 1, ~1 118 au niveau 5, ~3 162 au niveau 10.
- **Coefficients d'attaque par niveau** : niveau 1 = 0,03 · 2 = 0,08 · 3 = 0,15 · 4 = 0,22 · 5 = 0,33 (puis +0,11/niveau). Les premiers niveaux sont très doux, ça monte progressivement.
- **La manche s'arrête dès qu'il ne reste qu'UNE équipe** en vie (plus besoin d'un seul survivant). Détection robuste (confirmée sur lecture fraîche du serveur).
- **On ne peut plus arriver dans une partie en cours** : on reçoit une **couleur inutilisée** et on attend la prochaine manche en mode « ⏳ Prochaine manche ». Si la salle est pleine de 10 joueurs, on entre en spectateur.
- La **ligne de mort** a été remontée au bord de la rangée fatale.

### ⚔️ SORTS

- **File FIFO** : le sort lancé est désormais le **plus ancien** ramassé. Dans la barre, le sort actif (le prochain lancé) reste **à droite** et les nouveaux s'empilent vers la gauche.
- **Sort rouge** (plateau renversé) : inclinaison **souvent légère** (parfois forte, max 35°), le tir décrit une vraie courbe.
- **Sort noir** (nettoyage) : enlève les **9 boules les plus basses**, contiguës depuis un côté aléatoire ; on les voit **tomber** et les sorts portés ne rejoignent l'inventaire qu'à l'atterrissage.
- **Sort bleu** (boules supplémentaires) : envoie **12 boules qui arrivent en volant par la gauche** (plus d'apparition par magie), vers les cases libres les plus hautes.
- **Nuke** : jamais ~100 % (25–75 %), et elle **transforme tous les sorts du plateau en boules normales**.
- **Tremblement plus fort** à la réception d'un sort, et la **protection « pas de boules »** dure maintenant au moins le temps que le message traverse l'écran.
- **Message du vainqueur garanti pour tous** (diffusé par la session, plus de cas manquant).

### 💬 COMMUNICATION

- **Cliquer sur un joueur** (sans sort en main, partie finie…) pré-remplit **`/Pseudo`** dans le chat pour lui envoyer un message privé.
- Les **messages privés s'affichent entièrement en rose**.
- Le pseudo d'un **spectateur** apparaît en **gris** dans le chat.
- Lignes **« X a rejoint / quitté la salle »**.

### 👁️ SPECTATEUR

- Un **bouton gris (œil)** au centre de la sélection d'équipe permet de se mettre **spectateur (pause)** — ça libère une place de joueur.
- Un spectateur **voit les 10 joueurs** (un sur l'écran principal, 9 en miniatures) et peut **revenir en jeu** quand il veut.

### 🐛 CORRECTIONS MAJEURES

- **Plus de boucle infinie de manches** avec les bots (un bot mort pouvait relancer la partie en boucle).
- **Lancer un sort sur un adversaire fonctionne** de façon fiable (la reconstruction de l'interface volait parfois le clic).
- **Les attaques repartent** (le compteur d'attaque ne restait plus bloqué à 0).
- **Plus de boule de tir bloquée hors écran** qui empêchait de tirer (canon qui tournait dans le vide).
- On ne peut plus être **éjecté de sa propre salle** comme « fantôme » en pleine partie.
- Ton inventaire de sorts, tes effets et ton score ne sont plus écrasés par le réseau pendant que tu joues (effets de sorts **instantanés**).
- **Moins de lag à plusieurs** (rafraîchissements regroupés, miniatures à cadence réduite, collision de tir optimisée à haut fps).

### ⚙️ TECHNIQUE

- **Journal de chaque partie** (qui joue, morts, vainqueur, raison de fin) pour diagnostiquer les soucis.

---

## Patch 0.2 — 12 juin 2026

### 🌍 GÉNÉRAL

- L'échauffement de l'accueil est désormais **le même jeu que les salles** : sorts, montée de niveau, boules envoyées par l'ordinateur. Seule différence : on ne perd qu'en dépassant la barre du bas, et un clic relance une partie.
- Le bouton **Accueil** ramène directement au lobby : la page de pseudo ne s'affiche plus qu'à la première visite.
- La partie se lance désormais à la **majorité simple** des joueurs prêts (2 prêts sur 3 suffisent).
- Les parties s'intensifient plus vite : envoi de boules **toutes les 5 secondes** (au lieu de 8) et pression par niveau doublée. Les parties ne s'éternisent plus.
- Nouvelle physique du jeu : la vitesse est pilotée par la commande **/fps 30–300** (défaut 140). Comme dans l'original, tout est calé sur les frames — plus de fps = tir, sorts et boules plus rapides. Les bons joueurs monteront les fps.
- **/canon X** et **/fps X** fonctionnent aussi dans le chat de l'accueil pour l'échauffement.
- La **visée se fait uniquement aux flèches ← →**. La souris ne bouge plus le canon.

### ⚔️ GAMEPLAY

- Les boules envoyées par les adversaires **arrivent en volant par le bord gauche** en file indienne, au lieu d'apparaître de nulle part. Une **secousse brève** signale leur atterrissage.
- Recevoir un sort **fait trembler l'écran** — nettement plus fort et plus longtemps si plusieurs sorts arrivent dans la foulée (jusqu'à 6,5 s).
- **Pendant le tremblement, les boules adverses sont annulées** (pas reportées) : encaisser des sorts fait gagner du temps, c'est une vraie mécanique de défense.
- Sort rouge (Plateau renversé) : angle aléatoire **plafonné à 35°**, et le tir est désormais **dévié en courbe** comme si la gravité suivait l'inclinaison du plateau.
- Sort bleu ciel (Variation de couleur) : le symbole des boules-sorts se **re-synchronise avec leur nouvelle couleur** (fini les mélanges incohérents).
- **Nuke rééquilibrée** : elle devient bimodale — parfois faible (10–35 % des boules), parfois dévastatrice (45–95 %). On ne sait jamais sur quoi on va tomber.

### 📣 ANNONCES & COMMUNICATION

- **Le chat de salle est enfin partagé** : tout le monde voit vos messages (pseudo coloré à la couleur d'équipe). `/pseudo message` envoie un **message privé** violet visible uniquement du destinataire.
- **Annonces de sorts visibles par tous** : dans le cadre Annonces, le lanceur en haut, la cible en bas, et la boule du sort qui **descend en 4 paliers glissés** pendant 2,5 s. En cas de rafale, les annonces en retard défilent en accéléré (0,3 s) — on voit toujours le sort le plus récent.
- Quand vous **recevez** un sort, un **message blanc défile de droite à gauche** au-dessus de la ligne de mort : qui vous a envoyé quoi.
- Montée de niveau annoncée par le panneau **« Difficulté Augmentée »** avec le numéro du niveau, 3 secondes, comme l'original.
- Nouvel outil 🕐 dans le lobby : **l'historique des connexions** (qui s'est connecté, à quelle heure).

### 🤖 NOUVEAU : LES BOTS

- Commande **/bot x** (0 à 8) dans le chat d'une salle : des bots de niveau intermédiaire rejoignent la partie.
- Ils visent correctement (~60 % du temps), ramassent et lancent des sorts, attaquent les équipes adverses, meurent, se remettent prêts entre les manches… et **parlent dans le chat**.
- Sous l'effet d'un canon cassé ou d'un plateau renversé, ils visent beaucoup moins bien (10 s).
- Ils partent automatiquement quand leur invocateur quitte la salle.

### 🎨 INTERFACE & FIDÉLITÉ À L'ORIGINAL

- **Canon coquillage** : lamelles grises métalliques séparées de blanc, fine aiguille noire style aiguille d'horloge, dimensionné et positionné comme l'original.
- **Cadre blanc arrondi** autour du plateau, avec le tube à gauche menant au **cercle de la couleur d'équipe** (pastille plate, pas une fausse boule). La **prochaine boule** est affichée à la base droite du coquillage, avec le compteur fps à côté.
- **Fond patchwork orange** régénéré : carrés aux teintes aléatoires en zones organiques, dégradé plus pâle vers le bas — fidèle aux captures de 2005. Identique sur l'accueil, les salles et les miniatures des adversaires.
- `[Pseudo]` et score (couleur d'équipe) en bas à gauche du plateau, comme l'original.
- Indicateur **« ✓ PRÊT » bien visible** (bandeau vert) sur les miniatures des adversaires en salle d'attente.
- Rendu des boules unifié partout : contour sombre marqué, reflet plastique dur.

### 🐛 CORRECTIONS DE BUGS

- **Le plateau ne « change plus tout seul »** : chaque joueur est désormais propriétaire de sa grille ; attaques et sorts transitent par des événements appliqués localement (fini les conflits d'écriture).
- **Lancer un sort sur un adversaire fonctionne** : un clic mangeait silencieusement un sort sans rien lancer (double bug : identifiant posé sur le mauvais élément + vieux gestionnaire résiduel).
- **Le sort Canon cassé ne gèle plus le jeu** : sa variante « auto-tir » appelait une fonction inexistante et tuait la boucle de jeu. La boucle est maintenant blindée contre ce type d'erreur.
- Les attaques n'étaient envoyées qu'une fois (chaque client envoyait les attaques de **tous** les joueurs → tout était multiplié par le nombre de joueurs).
- On ne peut plus être **éjecté de sa propre salle** comme « fantôme » (course entre le heartbeat et le seuil d'inactivité).
- Un bot ne peut plus bloquer le démarrage de la partie (l'hôte de session est toujours un humain).
- Les annonces de sorts ne sont plus écrasées par les synchronisations (elles survivent aux reconstructions de l'interface et chaque sort a son annonce).
- Fluidité à haute vitesse : les boules qui tombaient/arrivaient en groupe ne « gèlent » plus d'une frame.
- Les fichiers du jeu ne restent plus coincés dans le cache navigateur après une mise à jour.

### ⚙️ TECHNIQUE

- **Migration vers Firebase Realtime Database** (Europe) pour tout l'état de jeu : grilles synchronisées **case par case** (uniquement les changements), événements, annonces, session. Firestore est conservé pour le chat, le lobby et l'historique. Résultat : plus de quota explosé, coût ≈ 0 €.
- Nettoyage automatique à la déconnexion (`onDisconnect`) : plus de joueurs fantômes après fermeture d'onglet.
- Les compteurs de salles du lobby lisent un miroir ultraléger (un seul listener au lieu de dix).

---

## Patch 0.1 et antérieurs

Portage initial : salles multijoueur, équipes, 8 sortilèges, chat, échauffement solo.
