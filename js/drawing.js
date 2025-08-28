import { Game } from './game.js';
import { GameLogic } from './gameLogic.js';
import { Config } from './config.js';

export const Drawing = {
    drawAll() {
        if (!Game.localPlayer) return;
        const mainCanvas = document.getElementById('gameCanvas');
        if (!mainCanvas) return;
        this.drawPlayer(Game.localPlayer, mainCanvas.getContext('2d'), true);
        Game.players.forEach(p => { if (p.id !== Game.localPlayer.id && p.canvas) this.drawPlayer(p, p.ctx, false); });
    },

    drawPlayer(player, ctx, isMain) {
        const canvas = ctx.canvas;
        if (!canvas || canvas.width === 0) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rad = canvas.width / (Config.GRID_COLS * 2 + 1) * 0.95;
        const gameOverLineY = GameLogic.getBubbleCoords(Config.GAME_OVER_ROW, 0, rad).y - rad;

        if (isMain && Game.state === 'waiting') {
            this.drawLobbyAnimation(ctx, canvas);
        } else if (Game.state === 'playing') {
            for (let r = 0; r < Config.GRID_ROWS; r++) for (let c = 0; c < Config.GRID_COLS; c++) if (player.grid[r][c]) {
                const { x, y } = GameLogic.getBubbleCoords(r, c, rad); 
                this.drawBubble(ctx, player.grid[r][c], rad, x, y);
            }
            player.fallingBubbles.forEach(b => this.drawBubble(ctx, b, rad, b.x, b.y)); 
            player.effects.forEach(e => this.drawEffect(ctx, e));
            
            if (isMain && player.isAlive) {
                const baseX = canvas.width / 2;
                const baseY = canvas.height - rad; // Position de la base du canon
                this.drawCannonBase(ctx, baseX, baseY, rad);
                this.drawCannonNeedle(ctx, player, { x: baseX, y: baseY }, gameOverLineY);

                if (player.launcherBubble) this.drawBubble(ctx, player.launcherBubble, rad, baseX, baseY, true);
                if (player.nextBubble) this.drawBubble(ctx, player.nextBubble, rad * 0.7, baseX + rad * 3, baseY);
                if (player.shotBubble) this.drawBubble(ctx, player.shotBubble, rad, player.shotBubble.x, player.shotBubble.y);
            }

            if (!player.isAlive) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white'; ctx.font = `bold ${canvas.width / 8}px Inter`; ctx.textAlign = 'center'; ctx.fillText('PERDU', canvas.width / 2, canvas.height / 2);
            }
        }
        
        if (isMain && (Game.state === 'playing' || Game.state === 'countdown')) {
            this.drawGameOverLine(ctx, canvas.width, gameOverLineY);
        }
    },

    drawLobbyAnimation(ctx, canvas) {
        // ... (Code inchangé)
    },

    drawBubble(ctx, b, rad, x, y, isLauncher = false) {
        // ... (Code inchangé)
    },
    drawEffect(ctx, e) {
        // ... (Code inchangé)
    },

    drawGameOverLine(ctx, w, y) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    },
    
    drawCannonBase(ctx, x, y, rad) {
        ctx.fillStyle = '#E5E7EB';
        ctx.beginPath();
        ctx.arc(x, y, rad * 1.5, Math.PI, 0);
        ctx.fill();
    },

    drawCannonNeedle(ctx, player, basePos, lineY) {
        ctx.save();
        ctx.translate(basePos.x, basePos.y);
        ctx.rotate(player.launcher.angle + Math.PI / 2);
        
        // Calcule la longueur de l'aiguille pour qu'elle atteigne la ligne
        const length = basePos.y - lineY;

        ctx.fillStyle = '#374151'; // Couleur gris foncé pour l'aiguille
        ctx.fillRect(-2, 0, 4, -length); // Dessine une aiguille de 4px de large

        ctx.restore();
    }
};