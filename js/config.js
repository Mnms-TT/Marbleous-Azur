export const Config = {
  // Couleurs classiques Bust-A-Move (reference image)
  BUBBLE_COLORS: [
    { main: "#ff4466", shadow: "#cc2244" }, // Rouge/Rose
    { main: "#ffdd00", shadow: "#ccaa00" }, // Jaune
    { main: "#44dd44", shadow: "#22aa22" }, // Vert
    { main: "#44ddff", shadow: "#22aacc" }, // Cyan
    { main: "#4488ff", shadow: "#2266cc" }, // Bleu
    { main: "#dd44ff", shadow: "#aa22cc" }, // Violet/Magenta
    { main: "#ff8844", shadow: "#cc6622" }, // Orange
    { main: "#8866ff", shadow: "#6644cc" }, // Violet foncé
  ],

  // Palette Patchwork orange (carrés variés comme référence)
  PATCHWORK_ORANGES: [
    "#f97316", // Orange vif
    "#fb923c", // Orange clair
    "#ea580c", // Orange foncé
    "#fdba74", // Pêche
    "#fed7aa", // Très clair
    "#c2410c", // Rouille
  ],

  TEAM_COLORS: ["#3B82F6", "#22C55E", "#F97316", "#EC4899", "#8B5CF6"],

  // Sorts offensifs (à lancer sur adversaires)
  // Sorts défensifs (à lancer sur soi/équipe) - symbole vert
  SPELLS: {
    // OFFENSIFS
    plateauRenverse: {
      name: "Plateau renversé",
      icon: "icons/sort_tilt.png",
      color: "#ff4466",
      type: "offensive",
      description: "Tir imprévisible - angle modifié aléatoirement"
    },
    canonCasse: {
      name: "Canon cassé",
      icon: "icons/sort_canon.png",
      color: "#ffdd00",
      type: "offensive",
      description: "Comportement aléatoire du canon"
    },
    disparitionSorts: {
      name: "Disparition de sorts",
      icon: "icons/sort_cancel.png",
      color: "#44dd44",
      type: "offensive",
      description: "Supprime 1 sort + bulles sorts à l'écran"
    },
    variationCouleur: {
      name: "Variation de couleur",
      icon: "icons/sort_rainbow.png",
      color: "#44ddff",
      type: "offensive",
      description: "Couleurs changent constamment"
    },
    boulesSupplementaires: {
      name: "Boules supplémentaires",
      icon: "icons/sort_addline.png",
      color: "#4488ff",
      type: "offensive",
      description: "Ajoute ~10 bulles à l'adversaire"
    },
    // DÉFENSIFS
    nukeBomb: {
      name: "Nuke Bomb",
      icon: "icons/sort_nuke.png",
      color: "#dd44ff",
      type: "defensive",
      description: "Élimine beaucoup de bulles"
    },
    toutesMemeCouleur: {
      name: "Toutes même couleur",
      icon: "icons/sort_monocolor.png",
      color: "#ff8844",
      type: "defensive",
      description: "Certaines bulles deviennent même couleur"
    },
    nettoyage: {
      name: "Nettoyage",
      icon: "icons/sort_removeline.png",
      color: "#8866ff",
      type: "defensive",
      description: "Supprime 2-3 rangées de bulles"
    },
  },

  COLOR_TO_SPELL_MAP: {
    "#ff4466": "plateauRenverse",
    "#ffdd00": "canonCasse",
    "#44dd44": "disparitionSorts",
    "#44ddff": "variationCouleur",
    "#4488ff": "boulesSupplementaires",
    "#dd44ff": "nukeBomb",
    "#ff8844": "toutesMemeCouleur",
    "#8866ff": "nettoyage",
  },

  MAX_SPELLS: 7,
  GRID_ROWS: 12,
  GRID_COLS: 8,
  GAME_OVER_ROW: 11, // Ligne noire position originale

  SPELL_SPAWN_CHANCE: 0.5,
  FPS: 60,
  LAUNCHER_ROTATION_SPEED: 0.014,
};
