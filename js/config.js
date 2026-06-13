export const Config = {
  // Couleurs exactes données par l'utilisateur
  BUBBLE_COLORS: [
    { main: "#fad402", shadow: "#c9a801" }, // Jaune
    { main: "#1fc23f", shadow: "#189a32" }, // Vert
    { main: "#26c9f9", shadow: "#1ea0c7" }, // Cyan/Bleu clair
    { main: "#365edf", shadow: "#2b4bb2" }, // Bleu foncé
    { main: "#bd36d9", shadow: "#972bad" }, // Violet (Nuke)
    { main: "#b6b4b9", shadow: "#919094" }, // Gris
    { main: "#2d2d2d", shadow: "#1a1a1a" }, // Noir
    { main: "#fc3e4e", shadow: "#ca3240" }, // Rouge
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

  // 5 équipes: Jaune, Rouge, Vert, Bleu, Rose
  TEAM_COLORS: ["#FBBF24", "#EF4444", "#22C55E", "#3B82F6", "#EC4899"],

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
    "#fad402": "canonCasse",            // Jaune -> Canon cassé
    "#1fc23f": "disparitionSorts",      // Vert -> Disparition de sorts
    "#26c9f9": "variationCouleur",      // Cyan -> Variation de couleur
    "#365edf": "boulesSupplementaires", // Bleu foncé -> Boules supplémentaires
    "#bd36d9": "nukeBomb",              // Violet -> Nuke Bomb
    "#b6b4b9": "toutesMemeCouleur",     // Gris -> Toutes même couleur
    "#2d2d2d": "nettoyage",             // Noir -> Nettoyage
    "#fc3e4e": "plateauRenverse",       // Rouge -> Plateau renversé
  },

  GRID_ROWS: 12,
  GRID_COLS: 8,
  GAME_OVER_ROW: 11, // 11 rangées autorisées, game over à la 12ème

  SPELL_SPAWN_CHANCE: 0.43, // +30% (was 0.33)
  FPS: 60,

  // Nuke "bimodale" mais jamais extrême : faible (25-45%) ou forte (50-75%).
  // Ne détruit jamais ~100%, et l'écart faible/forte est resserré.
  nukeDestroyPercent() {
    return Math.random() < 0.45
      ? 0.25 + Math.random() * 0.20   // faible
      : 0.50 + Math.random() * 0.25;  // forte
  },

  DEFAULT_GAME_FPS: 140, // Vitesse de simulation par défaut (réglable via /fps 30-300)
  LAUNCHER_ROTATION_SPEED: 0.0056,

  // Divers
  MAX_SPELLS: 7, // Limite d'inventaire de sorts
  GAME_OVER_ROW: 11, // Ligne limite avant Game Over

  // Coefficient de redistribution des bulles - augmente avec le niveau.
  // Départ très doux (niveaux 1-2 peuvent renvoyer peu, voire 0 boule),
  // puis la rampe reste raide pour que les parties ne s'éternisent pas.
  BASE_REDISTRIBUTION_COEF: 0.04, // Coefficient initial
  REDISTRIBUTION_COEF_PER_LEVEL: 0.08, // +0.08 par niveau

  // Taille d'une attaque selon le niveau et le nombre d'unités (10 boules
  // éclatées = 1 unité). Aux niveaux 1-2 le minimum n'est PAS forcé à 1 :
  // un joueur peu agressif n'envoie rien au début (montée en douceur).
  attackSize(level, units = 1) {
    const coef = this.BASE_REDISTRIBUTION_COEF + (level - 1) * this.REDISTRIBUTION_COEF_PER_LEVEL;
    const raw = Math.floor(units * coef * 10);
    return level <= 2 ? raw : Math.max(1, raw);
  },
};
