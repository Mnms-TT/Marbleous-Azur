/**
 * patchwork.js - Fond patchwork orange façon jeu original
 * Carrés aux teintes orange aléatoires (zones organiques) + dégradé vertical
 * (plus clair vers le bas, comme sur les captures de référence).
 * Seed fixe => le même fond partout (accueil, salle, mini-plateaux).
 */

// Palette échantillonnée sur les captures du jeu original (du plus soutenu au plus pâle)
const PALETTE = [
  "#ED7D1F",
  "#F5983A",
  "#FFA54F",
  "#FFB05A",
  "#FFB864",
  "#FFC080",
  "#FFCD96",
  "#FFD4A8",
  "#FFE0BD",
];

// PRNG déterministe (mulberry32) pour un patchwork stable d'une page à l'autre
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatePatchworkDataURI(cols = 8, rows = 14, seed = 1337) {
  const rnd = mulberry32(seed);
  const grid = [];

  for (let y = 0; y < rows; y++) {
    grid.push([]);
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      let idx;
      if (x > 0 && r < 0.40) {
        idx = grid[y][x - 1]; // étend la zone de gauche (blocs organiques)
      } else if (y > 0 && r < 0.65) {
        idx = grid[y - 1][x]; // étend la zone du dessus
      } else {
        // Biais vertical : indices clairs (fin de palette) favorisés vers le bas
        const t = y / (rows - 1);
        const center = 1.5 + t * (PALETTE.length - 3.5);
        idx = Math.round(center + (rnd() * 2 - 1) * 2.2);
        idx = Math.max(0, Math.min(PALETTE.length - 1, idx));
      }
      grid[y].push(idx);
    }
  }

  let rects = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      rects += `<rect x='${x}' y='${y}' width='1' height='1' fill='${PALETTE[grid[y][x]]}'/>`;
    }
  }

  // Dégradé global par-dessus le patchwork : léger voile chaud en haut, éclairci en bas
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${cols}' height='${rows}' shape-rendering='crispEdges'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='#E96D10' stop-opacity='0.12'/>` +
    `<stop offset='0.55' stop-color='#FFFFFF' stop-opacity='0'/>` +
    `<stop offset='1' stop-color='#FFFFFF' stop-opacity='0.22'/>` +
    `</linearGradient></defs>` +
    rects +
    `<rect x='0' y='0' width='${cols}' height='${rows}' fill='url(#g)'/>` +
    `</svg>`;

  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// Pose la variable CSS --patchwork-bg sur :root ; les zones de jeu l'utilisent
export function applyPatchworkBackground(seed = 1337) {
  const uri = generatePatchworkDataURI(8, 14, seed);
  document.documentElement.style.setProperty("--patchwork-bg", `url("${uri}")`);
}
