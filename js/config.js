export const Config = {
  BUBBLE_COLORS: [
    { main: "#ef4444", shadow: "#991b1b" }, // Rouge
    { main: "#eab308", shadow: "#a16207" }, // Jaune
    { main: "#22c55e", shadow: "#15803d" }, // Vert
    { main: "#06b6d4", shadow: "#0e7490" }, // Cyan
    { main: "#3b82f6", shadow: "#1d4ed8" }, // Bleu
    { main: "#a855f7", shadow: "#7e22ce" }, // Violet
    { main: "#f3f4f6", shadow: "#9ca3af" }, // Blanc
    { main: "#111827", shadow: "#000000" }, // Noir
  ],

  // Palette pour le fond patchwork (Style rétro)
  PATCHWORK_ORANGES: [
    "#fb923c", // Orange clair
    "#f97316", // Orange standard
    "#ea580c", // Orange foncé
    "#c2410c", // Orange brulé / Rouille
  ],

  TEAM_COLORS: ["#3B82F6", "#22C55E", "#F97316", "#EC4899", "#8B5CF6"],

  SPELLS: {
    plateauIncline: {
      name: "Plateau Incliné",
      icon: "icons/sort_tilt.png",
      color: "#ef4444",
    },
    canonEndommage: {
      name: "Canon endommagé",
      icon: "icons/sort_canon.png",
      color: "#eab308",
    },
    annulationSorts: {
      name: "Annulation de Sorts",
      icon: "icons/sort_cancel.png",
      color: "#22c55e",
    },
    variationCouleurs: {
      name: "Variation de couleurs",
      icon: "icons/sort_rainbow.png",
      color: "#06b6d4",
    },
    apparitionLigne: {
      name: "Apparition de boules",
      icon: "icons/sort_addline.png",
      color: "#3b82f6",
    },
    nukeBomb: {
      name: "NukeBomb",
      icon: "icons/sort_nuke.png",
      color: "#a855f7",
    },
    couleursIdentiques: {
      name: "Couleurs identiques",
      icon: "icons/sort_monocolor.png",
      color: "#d1d5db",
    },
    disparitionLignes: {
      name: "Disparition de Lignes",
      icon: "icons/sort_removeline.png",
      color: "#111827",
    },
  },

  COLOR_TO_SPELL_MAP: {
    "#ef4444": "plateauIncline",
    "#eab308": "canonEndommage",
    "#22c55e": "annulationSorts",
    "#06b6d4": "variationCouleurs",
    "#3b82f6": "apparitionLigne",
    "#a855f7": "nukeBomb",
    "#f3f4f6": "couleursIdentiques",
    "#111827": "disparitionLignes",
  },

  MAX_SPELLS: 7,
  GRID_ROWS: 12,
  GRID_COLS: 8,
  GAME_OVER_ROW: 11,

  SPELL_SPAWN_CHANCE: 0.5,
  FPS: 60,
  LAUNCHER_ROTATION_SPEED: 0.05,
};
