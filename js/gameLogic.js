import { Config } from "./config.js";
import { Game } from "./game.js";
import { FirebaseController } from "./firebaseController.js";
import { UI } from "./ui.js";

export const GameLogic = {
  createEmptyGrid: () =>
    Array.from({ length: Config.GRID_ROWS }, () =>
      Array(Config.GRID_COLS).fill(null)
    ),
  createInitialGrid: () => {
    const grid = GameLogic.createEmptyGrid();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (Math.random() > 0.5) {
          grid[r][c] = GameLogic.createBubble(r, c);
        }
      }
    }
    return grid;
  },
  createBubble: (r, c, color = null, spell = null) => ({
    r,
    c,
    color:
      color ||
      Config.BUBBLE_COLORS[
        Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
      ],
    spell,
    isSpellBubble: !!spell,
    isStatic: true,
  }),
  updateLobbyAnimation() {
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;
    Game.lobbyMarbles.forEach((marble) => {
      marble.y += marble.vy;
      if (marble.y - marble.r > mainCanvas.height) {
        marble.y = -marble.r;
        marble.x = Math.random() * mainCanvas.width;
      }
    });
  },
  loadBubbles: (player) => {
    if (!player?.isAlive) return;
    player.launcherBubble = player.nextBubble || GameLogic.createBubble(-1, -1);
    player.launcherBubble.isStatic = true;
    player.nextBubble = GameLogic.createBubble(-1, -1);
  },
  async snapBubble(player, shotBubble) {
    if (!player || !shotBubble) return;
    player.shotBubble = null;
    let bestSpot = this.findBestSnapSpot(player, shotBubble);
    if (bestSpot) {
      const { r, c } = bestSpot;
      player.grid[r][c] = this.createBubble(r, c, shotBubble.color);
      const matches = this.findMatches(player.grid, r, c);
      if (matches.length >= 3) {
        let cleared = matches.length;
        matches.forEach((b) => {
          const { x, y } = this.getBubbleCoords(b.r, b.c, Game.bubbleRadius);
          player.effects.push({
            x,
            y,
            type: "pop",
            radius: Game.bubbleRadius,
            life: 10,
          });
          player.grid[b.r][b.c] = null;
        });
        const avalanche = this.handleAvalanche(player, player.grid, true);
        cleared += avalanche;
        if (Math.random() < Config.SPELL_SPAWN_CHANCE)
          this.spawnSpellBubble(player);
        await FirebaseController.updatePlayerDoc(player.id, {
          score: player.score + cleared * 10 + Math.pow(avalanche, 2) * 10,
          attackBubbleCounter: player.attackBubbleCounter + cleared,
          grid: JSON.stringify(player.grid),
          spells: player.spells,
        });
      } else
        await FirebaseController.updatePlayerDoc(player.id, {
          grid: JSON.stringify(player.grid),
        });
    }
    await this.checkGameOver(player);
  },
  async triggerGlobalAttack() {
    if (Game.state !== "playing") return;
    for (const player of Game.players.values()) {
      if (player.isAlive && player.attackBubbleCounter >= 10) {
        const attackUnits = Math.floor(player.attackBubbleCounter / 10);
        const attackSize = attackUnits * Math.floor(player.level);
        if (attackSize > 0) {
          const targets = Array.from(Game.players.values()).filter(
            (p) => p.id !== player.id && p.isAlive && p.team !== player.team
          );
          for (const target of targets) this.addJunkBubbles(target, attackSize);
        }
        await FirebaseController.updatePlayerDoc(player.id, {
          attackBubbleCounter: player.attackBubbleCounter % 10,
        });
      }
    }
  },
  addJunkBubbles(target, junkCount) {
    const validSlots = [];
    for (let r = 0; r < Config.GRID_ROWS; r++)
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (
          !target.grid[r][c] &&
          (r === 0 ||
            this.getNeighborCoords(r, c).some((n) => target.grid[n.r]?.[n.c]))
        )
          validSlots.push({ r, c });
    validSlots.sort(() => Math.random() - 0.5);
    const toAdd = Math.min(validSlots.length, junkCount);
    for (let i = 0; i < toAdd; i++) {
      const s = validSlots[i];
      target.grid[s.r][s.c] = this.createBubble(s.r, s.c);
    }
    FirebaseController.updatePlayerDoc(target.id, {
      grid: JSON.stringify(target.grid),
    });
  },
  levelUp: () => {
    if (Game.state === "playing" && Game.localPlayer)
      FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
        level: Game.localPlayer.level + 1,
      });
  },
  updateLocalAnimations() {
    if (!Game.localPlayer) return;
    const mainCanvas = document.getElementById("gameCanvas");
    if (!mainCanvas) return;
    this.processStatusEffects(Game.localPlayer);
    Game.players.forEach((p) =>
      p.effects.forEach((e, i) => {
        e.life--;
        if (e.type === "pop") e.radius += 0.5;
        if (e.life <= 0) p.effects.splice(i, 1);
      })
    );

    let rotSpeed = Game.currentRotationSpeed;

    if (Game.localPlayer.statusEffects.canonEndommage) {
      rotSpeed *= 0.4;
      Game.localPlayer.launcher.angle += (Math.random() - 0.5) * 0.08;
    }
    if (Game.keys.left) Game.localPlayer.launcher.angle -= rotSpeed;
    if (Game.keys.right) Game.localPlayer.launcher.angle += rotSpeed;
    Game.localPlayer.launcher.angle = Math.max(
      -Math.PI + 0.1,
      Math.min(-0.1, Game.localPlayer.launcher.angle)
    );
    if (Game.localPlayer.shotBubble) {
      let b = Game.localPlayer.shotBubble;
      b.vx = b.vx || 0;
      b.vy = b.vy || 0;
      if (Game.localPlayer.statusEffects.plateauIncline)
        b.vx += 0.15 * Game.localPlayer.statusEffects.plateauIncline.direction;
      b.x += b.vx;
      b.y += b.vy;
      let collided = b.y - Game.bubbleRadius < Config.GRID_VERTICAL_OFFSET;
      if (!collided)
        for (let r = 0; r < Config.GRID_ROWS; r++) {
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (Game.localPlayer.grid[r][c]) {
              const coords = this.getBubbleCoords(r, c, Game.bubbleRadius);
              if (
                Math.hypot(b.x - coords.x, b.y - coords.y) <
                Game.bubbleRadius * 1.8
              ) {
                collided = true;
                break;
              }
            }
          if (collided) break;
        }
      if (collided) {
        this.snapBubble(Game.localPlayer, b);
        return;
      }
      if (
        b.x - Game.bubbleRadius < 0 ||
        b.x + Game.bubbleRadius > mainCanvas.width
      )
        b.vx *= -1;
    }
    Game.players.forEach((p) =>
      p.fallingBubbles.forEach((b, i) => {
        b.vy += 0.2;
        b.y += b.vy;
        b.x += b.vx;
        const c = p.id === Game.localPlayer.id ? mainCanvas : p.canvas;
        if (c && b.y > c.height + Game.bubbleRadius)
          p.fallingBubbles.splice(i, 1);
      })
    );
  },
  processStatusEffects(player) {
    let changed = false;
    const now = Date.now();
    for (const key in player.statusEffects)
      if (now > player.statusEffects[key].endTime) {
        delete player.statusEffects[key];
        changed = true;
      }
    if (changed && player.id === Game.localPlayer.id)
      FirebaseController.updatePlayerDoc(player.id, {
        statusEffects: player.statusEffects,
      });
    if (player.statusEffects.canonArcEnCiel) {
      player.variationColorTimer = (player.variationColorTimer || 0) + 1;
      if (
        player.variationColorTimer % (Config.FPS / 2) === 0 &&
        player.launcherBubble
      )
        player.launcherBubble.color =
          Config.BUBBLE_COLORS[
            Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
          ];
    }
  },
  async castSpecificSpell(targetPlayer, spellIndex) {
    if (
      !Game.localPlayer ||
      spellIndex === null ||
      spellIndex < 0 ||
      spellIndex >= Game.localPlayer.spells.length ||
      !targetPlayer
    )
      return;
    const spellName = Game.localPlayer.spells[spellIndex];
    Game.localPlayer.spells.splice(spellIndex, 1);
    await FirebaseController.updatePlayerDoc(Game.localPlayer.id, {
      spells: Game.localPlayer.spells,
    });
    UI.updateSpellAnnouncement(
      Game.localPlayer.name,
      Config.SPELLS[spellName],
      targetPlayer.name
    );
    await this.applySpellEffect(targetPlayer, spellName);
  },
  async applySpellEffect(target, spell) {
    if (!target?.isAlive || !spell) return;
    if (target.id === Game.localPlayer.id) UI.triggerScreenShake("high");
    const DURATION = 10000;
    let effects = { ...target.statusEffects };
    let gridChanged = false,
      spellsChanged = false;
    let grid = target.grid.map((r) => [...r]);
    switch (spell) {
      case "canonEndommage":
      case "canonArcEnCiel":
        effects[spell] = { endTime: Date.now() + DURATION };
        break;
      case "plateauIncline":
        effects[spell] = {
          endTime: Date.now() + DURATION,
          direction: Math.random() < 0.5 ? -1 : 1,
        };
        break;
      case "sabotageSorts":
        if (target.spells.length > 0) {
          target.spells.shift();
          spellsChanged = true;
        }
        for (let r = 0; r < Config.GRID_ROWS; r++)
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (grid[r][c]?.isSpellBubble) {
              grid[r][c].isSpellBubble = false;
              grid[r][c].spell = null;
              gridChanged = true;
            }
        break;
      case "monteeLignes":
        for (let i = 0; i < 2; i++) {
          for (let r = Config.GRID_ROWS - 1; r > 0; r--)
            for (let c = 0; c < Config.GRID_COLS; c++) {
              grid[r][c] = grid[r - 1][c];
              if (grid[r][c]) grid[r][c].r = r;
            }
          for (let c = 0; c < Config.GRID_COLS; c++)
            grid[0][c] = Math.random() > 0.5 ? this.createBubble(0, c) : null;
        }
        this.handleAvalanche({ grid }, grid, false);
        gridChanged = true;
        break;
      case "colonneMonochrome": {
        const cols = [
          ...new Set(
            grid
              .flat()
              .filter((b) => b)
              .map((b) => b.c)
          ),
        ];
        if (cols.length > 0) {
          const colsToChange = cols
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.random() < 0.7 ? 1 : 2);
          const newColor =
            Config.BUBBLE_COLORS[
              Math.floor(Math.random() * Config.BUBBLE_COLORS.length)
            ];
          for (const c of colsToChange)
            for (let r = 0; r < Config.GRID_ROWS; r++)
              if (grid[r][c]) grid[r][c].color = newColor;
          gridChanged = true;
        }
        break;
      }
      case "nukeBomb": {
        const bubbles = [];
        for (let r = 0; r < Config.GRID_ROWS; r++)
          for (let c = 0; c < Config.GRID_COLS; c++)
            if (grid[r][c]) bubbles.push({ r, c });
        const toDestroy = Math.floor(bubbles.length * 0.3);
        bubbles.sort(() => 0.5 - Math.random());
        for (let i = 0; i < toDestroy; i++) {
          const b = bubbles[i];
          const { x, y } = this.getBubbleCoords(b.r, b.c, Game.bubbleRadius);
          (target.effects = target.effects || []).push({
            x,
            y,
            type: "pop",
            radius: Game.bubbleRadius,
            life: 15,
            color: "#af00c1",
          });
          grid[b.r][b.c] = null;
        }
        this.handleAvalanche({ grid }, grid, false);
        gridChanged = true;
        break;
      }
    }
    const updateData = { statusEffects: effects };
    if (gridChanged) updateData.grid = JSON.stringify(grid);
    if (spellsChanged) updateData.spells = target.spells;
    await FirebaseController.updatePlayerDoc(target.id, updateData);
    if (target.id === Game.localPlayer.id && gridChanged) {
      Game.localPlayer.grid = grid;
      await this.checkGameOver(Game.localPlayer);
    }
  },
  getBubbleCoords: (r, c, rad) => ({
    x: rad + c * rad * 2 + (r % 2) * rad,
    y: rad + r * rad * 2 * 0.866 + Config.GRID_VERTICAL_OFFSET,
  }),
  getNeighborCoords(r, c) {
    const odd = r % 2 !== 0,
      n = [];
    const dirs = [
      { dr: -1, dc: odd ? 0 : -1 },
      { dr: -1, dc: odd ? 1 : 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: odd ? 0 : -1 },
      { dr: 1, dc: odd ? 1 : 0 },
    ];
    for (const d of dirs) {
      const nr = r + d.dr,
        nc = c + d.dc;
      if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS)
        n.push({ r: nr, c: nc });
    }
    return n;
  },
  findBestSnapSpot(player, bubble) {
    let best = null,
      minD = Infinity;
    const rad =
      player.id === Game.localPlayer.id
        ? Game.bubbleRadius
        : (player.canvas.width / (Config.GRID_COLS * 2 + 1)) * 0.95;
    for (let r = 0; r < Config.GRID_ROWS; r++)
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (!player.grid[r][c]) {
          if (
            r === 0 ||
            this.getNeighborCoords(r, c).some((n) => player.grid[n.r]?.[n.c])
          ) {
            const { x, y } = this.getBubbleCoords(r, c, rad);
            const d = Math.hypot(bubble.x - x, bubble.y - y);
            if (d < minD) {
              minD = d;
              best = { r, c };
            }
          }
        }
    if (!best) {
      let cCol = -1,
        cDist = Infinity;
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (!player.grid[0][c]) {
          const { x } = this.getBubbleCoords(0, c, rad);
          const d = Math.abs(bubble.x - x);
          if (d < cDist) {
            cDist = d;
            cCol = c;
          }
        }
      if (cCol !== -1) best = { r: 0, c: cCol };
    }
    return best;
  },
  findMatches(grid, r, c) {
    const start = grid[r]?.[c];
    if (!start) return [];
    const q = [start],
      visited = new Set([`${r},${c}`]),
      matches = [start];
    while (q.length > 0) {
      const curr = q.pop();
      for (const n of this.getNeighborCoords(curr.r, curr.c)) {
        const neighbor = grid[n.r]?.[n.c];
        if (
          neighbor &&
          !visited.has(`${n.r},${n.c}`) &&
          neighbor.color.main === start.color.main
        ) {
          visited.add(`${n.r},${n.c}`);
          q.push(neighbor);
          matches.push(neighbor);
        }
      }
    }
    return matches;
  },
  findFloatingBubbles(grid) {
    const connected = new Set(),
      q = [];
    for (let c = 0; c < Config.GRID_COLS; c++)
      if (grid[0][c]) {
        q.push(grid[0][c]);
        connected.add(`0,${c}`);
      }
    let head = 0;
    while (head < q.length) {
      const curr = q[head++];
      for (const n of this.getNeighborCoords(curr.r, curr.c)) {
        const neighbor = grid[n.r]?.[n.c];
        if (neighbor && !connected.has(`${n.r},${n.c}`)) {
          connected.add(`${n.r},${n.c}`);
          q.push(neighbor);
        }
      }
    }
    const floating = [];
    for (let r = 0; r < Config.GRID_ROWS; r++)
      for (let c = 0; c < Config.GRID_COLS; c++)
        if (grid[r][c] && !connected.has(`${r},${c}`))
          floating.push(grid[r][c]);
    return floating;
  },
  handleAvalanche(player, grid, animate) {
    const floating = this.findFloatingBubbles(grid);
    floating.forEach((b) => {
      if (b.isSpellBubble && b.spell) {
        (player.spells = player.spells || []).unshift(b.spell);
        if (player.spells.length > Config.MAX_SPELLS) player.spells.pop();
      }
      if (animate) {
        const rad =
          player.id === Game.localPlayer.id
            ? Game.bubbleRadius
            : (player.canvas.width / (Config.GRID_COLS * 2 + 1)) * 0.95;
        const { x, y } = this.getBubbleCoords(b.r, b.c, rad);
        (player.fallingBubbles = player.fallingBubbles || []).push({
          ...b,
          x,
          y,
          vy: 0,
          vx: (Math.random() - 0.5) * 2,
        });
      }
      grid[b.r][b.c] = null;
    });
    return floating.length;
  },
  async spawnSpellBubble(player) {
    const bubbles = player.grid
      .flat()
      .filter((b) => b && !b.isSpellBubble && b.r > 5);
    if (bubbles.length > 0) {
      const target = bubbles[Math.floor(Math.random() * bubbles.length)];
      const spell = Config.COLOR_TO_SPELL_MAP[target.color.main];
      if (spell) {
        target.spell = spell;
        target.isSpellBubble = true;
        await FirebaseController.updatePlayerDoc(player.id, {
          grid: JSON.stringify(player.grid),
        });
      }
    }
  },
  async checkGameOver(player) {
    if (player.isAlive) {
      for (let c = 0; c < Config.GRID_COLS; c++) {
        if (player.grid[Config.GAME_OVER_ROW][c]) {
          return await this.forceGameOver(player);
        }
      }
    }
  },
  async forceGameOver(player) {
    if (player.isAlive) {
      await FirebaseController.updatePlayerDoc(player.id, { isAlive: false });
    }
  },
};
