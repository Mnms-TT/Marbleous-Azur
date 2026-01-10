export const Config = {
  // Couleurs exactes de l'image de référence Bust-A-Move
  BUBBLE_COLORS: [
    { main: "#ff3388", shadow: "#cc1166" }, // Rose/Magenta vif
    { main: "#ffee00", shadow: "#ccbb00" }, // Jaune vif
    { main: "#33dd33", shadow: "#22aa22" }, // Vert vif
    { main: "#33dddd", shadow: "#22aaaa" }, // Cyan/Turquoise
    { main: "#3366ff", shadow: "#2244cc" }, // Bleu
    { main: "#aa44dd", shadow: "#7722aa" }, // Violet/Mauve
    { main: "#ff3333", shadow: "#cc1111" }, // Rouge (pas orange)
    { main: "#333333", shadow: "#111111" }, // Noir/Gris foncé
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
      color: "#ff3388",
      type: "offensive",
      description: "Tir imprévisible - angle modifié aléatoirement"
    },
    canonCasse: {
      name: "Canon cassé",
      icon: "icons/sort_canon.png",
      color: "#ffee00",
      type: "offensive",
      description: "Comportement aléatoire du canon"
    },
    disparitionSorts: {
      name: "Disparition de sorts",
      icon: "icons/sort_cancel.png",
      color: "#33dd33",
      type: "offensive",
      description: "Supprime 1 sort + bulles sorts à l'écran"
    },
    variationCouleur: {
      name: "Variation de couleur",
      icon: "icons/sort_rainbow.png",
      color: "#33dddd",
      type: "offensive",
      description: "Couleurs changent constamment"
    },
    boulesSupplementaires: {
      name: "Boules supplémentaires",
      icon: "icons/sort_addline.png",
      color: "#3366ff",
      type: "offensive",
      description: "Ajoute ~10 bulles à l'adversaire"
    },
    // DÉFENSIFS
    nukeBomb: {
      name: "Nuke Bomb",
      icon: "icons/sort_nuke.png",
      color: "#aa44dd",
      type: "defensive",
      description: "Élimine beaucoup de bulles"
    },
    toutesMemeCouleur: {
      name: "Toutes même couleur",
      icon: "icons/sort_monocolor.png",
      color: "#ff6633",
      type: "defensive",
      description: "Certaines bulles deviennent même couleur"
    },
    nettoyage: {
      name: "Nettoyage",
      icon: "icons/sort_removeline.png",
      color: "#333333",
      type: "defensive",
      description: "Supprime 2-3 rangées de bulles"
    },
  },

  COLOR_TO_SPELL_MAP: {
    "#ff3388": "plateauRenverse",
    "#ffee00": "canonCasse",
    "#33dd33": "disparitionSorts",
    "#33dddd": "variationCouleur",
    "#3366ff": "boulesSupplementaires",
    "#aa44dd": "nukeBomb",
    "#ff6633": "toutesMemeCouleur",
    "#333333": "nettoyage",
  },

  MAX_SPELLS: 7,
  GRID_ROWS: 12,
  GRID_COLS: 8,
  GAME_OVER_ROW: 11, // 11 rangées autorisées, game over à la 12ème

  SPELL_SPAWN_CHANCE: 0.33, // 1/3 de chance
  FPS: 60,
  LAUNCHER_ROTATION_SPEED: 0.014,
};
