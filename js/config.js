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

  SPELLS: {
    plateauIncline: {
      name: "Plateau Incliné",
      icon: "icons/sort_tilt.png",
      color: "#ff4466",
    },
    canonEndommage: {
      name: "Canon endommagé",
      icon: "icons/sort_canon.png",
      color: "#ffdd00",
    },
    annulationSorts: {
      name: "Annulation de Sorts",
      icon: "icons/sort_cancel.png",
      color: "#44dd44",
    },
    variationCouleurs: {
      name: "Variation de couleurs",
      icon: "icons/sort_rainbow.png",
      color: "#44ddff",
    },
    apparitionLigne: {
      name: "Apparition de boules",
      icon: "icons/sort_addline.png",
      color: "#4488ff",
    },
    nukeBomb: {
      name: "NukeBomb",
      icon: "icons/sort_nuke.png",
      color: "#dd44ff",
    },
    couleursIdentiques: {
      name: "Couleurs identiques",
      icon: "icons/sort_monocolor.png",
      color: "#ff8844",
    },
    disparitionLignes: {
      name: "Disparition de Lignes",
      icon: "icons/sort_removeline.png",
      color: "#8866ff",
    },
  },

  COLOR_TO_SPELL_MAP: {
    "#ff4466": "plateauIncline",
    "#ffdd00": "canonEndommage",
    "#44dd44": "annulationSorts",
    "#44ddff": "variationCouleurs",
    "#4488ff": "apparitionLigne",
    "#dd44ff": "nukeBomb",
    "#ff8844": "couleursIdentiques",
    "#8866ff": "disparitionLignes",
  },

  MAX_SPELLS: 7,
  GRID_ROWS: 13,
  GRID_COLS: 8,
  GAME_OVER_ROW: 12, // Augmenté de 11 à 12 pour permettre une ligne de plus

  SPELL_SPAWN_CHANCE: 0.5,
  FPS: 60,
  LAUNCHER_ROTATION_SPEED: 0.014,
};
