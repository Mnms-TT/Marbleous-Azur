export const Config = {
  // Couleurs basées sur l'image fournie et vos descriptions
  BUBBLE_COLORS: [
    { main: "#c62b39", shadow: "#69050d" }, // Rouge
    { main: "#ffd304", shadow: "#957e18" }, // Jaune
    { main: "#3bda0e", shadow: "#108209" }, // Vert
    { main: "#3ee2ee", shadow: "#2babb4" }, // Bleu clair (Cyan)
    { main: "#5c68de", shadow: "#18169b" }, // Bleu foncé
    { main: "#af00c1", shadow: "#860094" }, // Violet
    { main: "#d8d6db", shadow: "#636b60" }, // Gris
    { main: "#1a202c", shadow: "#000000" }, // Noir (Ajouté)
  ],
  TEAM_COLORS: ["#3B82F6", "#22C55E", "#F97316", "#EC4899", "#8B5CF6"],

  // Mapping précis des sorts selon votre description
  SPELLS: {
    plateauIncline: {
      name: "Plateau Incliné",
      icon: "icons/sort_tilt.png",
      color: "#c62b39",
    }, // Rouge
    canonEndommage: {
      name: "Canon endommagé",
      icon: "icons/sort_canon.png",
      color: "#ffd304",
    }, // Jaune
    annulationSorts: {
      name: "Annulation de Sorts",
      icon: "icons/sort_cancel.png",
      color: "#3bda0e",
    }, // Vert (Nom corrigé)
    variationCouleurs: {
      name: "Variation de couleurs",
      icon: "icons/sort_rainbow.png",
      color: "#3ee2ee",
    }, // Bleu clair (Nom corrigé)
    apparitionLigne: {
      name: "Apparition de boules",
      icon: "icons/sort_addline.png",
      color: "#5c68de",
    }, // Bleu foncé
    nukeBomb: {
      name: "NukeBomb",
      icon: "icons/sort_nuke.png",
      color: "#af00c1",
    }, // Violet
    couleursIdentiques: {
      name: "Couleurs identiques",
      icon: "icons/sort_monocolor.png",
      color: "#d8d6db",
    }, // Gris
    disparitionLignes: {
      name: "Disparition de Lignes",
      icon: "icons/sort_removeline.png",
      color: "#1a202c",
    }, // Noir
  },

  COLOR_TO_SPELL_MAP: {
    "#c62b39": "plateauIncline",
    "#ffd304": "canonEndommage",
    "#3bda0e": "annulationSorts",
    "#3ee2ee": "variationCouleurs",
    "#5c68de": "apparitionLigne",
    "#af00c1": "nukeBomb",
    "#d8d6db": "couleursIdentiques",
    "#1a202c": "disparitionLignes",
  },

  MAX_SPELLS: 7,

  // --- DIMENSIONS STRICTES ---
  GRID_ROWS: 12, // Nombre exact de lignes jouables
  GRID_COLS: 8, // Standard Bust-A-Move
  GAME_OVER_ROW: 11, // Si une boule se fixe ici ou en dessous, c'est perdu

  // Paramètres visuels
  SPELL_SPAWN_CHANCE: 0.5, // Sera ajusté plus tard avec la logique de hauteur
  FPS: 60,
  LAUNCHER_ROTATION_SPEED: 0.04, // Un peu plus rapide pour la fluidité
};
