import type { TetrisMatchSnapshot, TetrisPlayerSnapshot, ActivePiece } from '@games/mini-tetris';

const WIDTH = 10;
const HEIGHT = 20;
const BLOCK_SIZE = 18;

const PIECE_COLORS: Record<number, string> = {
  0: '#0f172a',
  1: '#06b6d4', // I
  2: '#facc15', // O
  3: '#a855f7', // T
  4: '#22c55e', // S
  5: '#ef4444', // Z
  6: '#3b82f6', // J
  7: '#f97316', // L
  8: '#64748b', // Garbage
  9: '#ffffff', // Active generic
};

const TYPE_VALUE: Record<string, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

const SHAPES: Record<string, [number, number][][]> = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [[[1,0],[2,0],[1,1],[2,1]]],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};

function getActiveCells(piece: ActivePiece): [number, number][] {
  const variants = SHAPES[piece.type];
  if (!variants) return [];
  return variants[piece.rotation % variants.length];
}

/* ─────────── Particle System ─────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/* ─────────── Floating Text (Combo Popup) ─────────── */

interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  fontSize: number;
}

interface PlayerBoardCard {
  cardEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  overlayCanvas: HTMLCanvasElement;
  overlayCtx: CanvasRenderingContext2D;
  statusBadge: HTMLElement;
  scoreEl: HTMLElement;
  linesEl: HTMLElement;
  nextEl: HTMLElement;
  garbageWarningEl: HTMLElement;
  rankBadge: HTMLElement;
  comboBadge: HTMLElement;
  particles: Particle[];
  floatingTexts: FloatingText[];
  prevLines: number;
  animFrame: number;
}

export class TetrisRenderer {
  private container: HTMLElement;
  private timerEl: HTMLElement;
  private phaseEl: HTMLElement;
  private boardCards = new Map<string, PlayerBoardCard>();
  private podiumBar: HTMLElement | null = null;

  constructor(container: HTMLElement, timerEl: HTMLElement, phaseEl: HTMLElement) {
    this.container = container;
    this.timerEl = timerEl;
    this.phaseEl = phaseEl;
  }

  public update(state: TetrisMatchSnapshot) {
    // 1. Phase Status
    if (state.phase === 'countdown') {
      this.phaseEl.innerText = 'HAZIRLANIN! 🚀';
      this.phaseEl.style.color = '#38bdf8';
    } else if (state.phase === 'playing') {
      this.phaseEl.innerText = `CANLI BATTLE ROYALE (${state.aliveCount}/${state.playerCount} Hayatta) ⚔️`;
      this.phaseEl.style.color = '#22c55e';
    } else if (state.phase === 'finished') {
      this.phaseEl.innerText = 'MAÇ BİTTİ! 🏁';
      this.phaseEl.style.color = '#facc15';
    } else {
      this.phaseEl.innerText = 'LOBİ';
      this.phaseEl.style.color = '#94a3b8';
    }

    // 2. Timer
    const remainingSec = Math.max(0, Math.floor(state.remainingMs / 1000));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    this.timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    // 3. Determine rankings (sorted by score desc)
    const ranked = [...state.players].sort((a, b) => b.score - a.score);
    const rankMap = new Map<string, number>();
    ranked.forEach((p, i) => rankMap.set(p.id, i + 1));

    // 4. Render Players
    const activeIds = new Set<string>();

    state.players.forEach((player: TetrisPlayerSnapshot) => {
      activeIds.add(player.id);
      let card = this.boardCards.get(player.id);

      if (!card) {
        card = this.createPlayerCard(player);
        this.boardCards.set(player.id, card);
        this.container.appendChild(card.cardEl);
        this.startOverlayAnimation(card);
      }

      const rank = rankMap.get(player.id) ?? 99;
      this.renderPlayer(card, player, rank);
    });

    // Remove old players
    for (const [id, card] of this.boardCards.entries()) {
      if (!activeIds.has(id)) {
        if (card.animFrame) cancelAnimationFrame(card.animFrame);
        card.cardEl.remove();
        this.boardCards.delete(id);
      }
    }

    // 5. Live Top-3 Podium Bar
    this.renderPodiumBar(ranked);
  }

  /* ─────────── Podium Bar ─────────── */

  private renderPodiumBar(ranked: TetrisPlayerSnapshot[]) {
    if (!this.podiumBar) {
      this.podiumBar = document.createElement('div');
      this.podiumBar.style.cssText = `
        position: fixed;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 1.5rem;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255,255,255,0.12);
        border-radius: 1.2rem;
        padding: 0.7rem 2rem;
        z-index: 100;
        box-shadow: 0 10px 35px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(this.podiumBar);
    }

    const medals = ['🥇', '🥈', '🥉'];
    const colors = ['#facc15', '#94a3b8', '#cd7f32'];

    this.podiumBar.innerHTML = ranked.slice(0, 3).map((p, i) => `
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span style="font-size:1.6rem;">${medals[i]}</span>
        <div>
          <div style="font-size:1rem; font-weight:800; color:${colors[i]}; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.nickname}</div>
          <div style="font-size:0.8rem; color:#94a3b8; font-weight:700;">${p.score} P</div>
        </div>
      </div>
    `).join('');
  }

  /* ─────────── Create Card ─────────── */

  private createPlayerCard(player: TetrisPlayerSnapshot): PlayerBoardCard {
    const cardEl = document.createElement('div');
    cardEl.style.cssText = `
      background: #1e293b;
      border: 2px solid #334155;
      border-radius: 1rem;
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 8px 25px rgba(0,0,0,0.4);
      transition: all 0.3s ease;
      min-width: 200px;
      position: relative;
    `;

    // Rank Badge (top-left corner)
    const rankBadge = document.createElement('div');
    rankBadge.style.cssText = `
      position: absolute;
      top: -10px;
      left: -10px;
      font-size: 1.6rem;
      z-index: 5;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      display: none;
    `;
    cardEl.appendChild(rankBadge);

    // Combo Badge (top-right corner)
    const comboBadge = document.createElement('div');
    comboBadge.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      background: linear-gradient(135deg, #f97316, #ef4444);
      color: white;
      font-size: 0.75rem;
      font-weight: 900;
      padding: 0.25rem 0.6rem;
      border-radius: 1rem;
      z-index: 5;
      display: none;
      box-shadow: 0 3px 10px rgba(239, 68, 68, 0.5);
      animation: comboPulse 0.6s ease infinite alternate;
    `;
    // Inject animation if not yet
    if (!document.getElementById('tetris-combo-style')) {
      const style = document.createElement('style');
      style.id = 'tetris-combo-style';
      style.textContent = `
        @keyframes comboPulse {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
        @keyframes comboFloat {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-30px); }
        }
      `;
      document.head.appendChild(style);
    }
    cardEl.appendChild(comboBadge);

    // Header: Nickname & Status
    const topBar = document.createElement('div');
    topBar.style.cssText = 'width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size: 1.15rem; font-weight: 800; color: #f8fafc; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    nameEl.innerText = player.nickname;

    const statusBadge = document.createElement('div');
    statusBadge.style.cssText = 'font-size: 0.8rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 1rem; background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid #22c55e;';
    statusBadge.innerText = 'CANLI';

    topBar.appendChild(nameEl);
    topBar.appendChild(statusBadge);

    // Canvas wrapper (for layering)
    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.cssText = 'position: relative; display: inline-block;';

    // Canvas Board
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH * BLOCK_SIZE;
    canvas.height = HEIGHT * BLOCK_SIZE;
    canvas.style.cssText = 'border-radius: 0.5rem; border: 2px solid #334155; background: #0f172a; display: block;';
    const ctx = canvas.getContext('2d')!;

    // Overlay Canvas (particles & floating text)
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = WIDTH * BLOCK_SIZE;
    overlayCanvas.height = HEIGHT * BLOCK_SIZE;
    overlayCanvas.style.cssText = 'position: absolute; top: 0; left: 0; border-radius: 0.5rem; pointer-events: none;';
    const overlayCtx = overlayCanvas.getContext('2d')!;

    canvasWrapper.appendChild(canvas);
    canvasWrapper.appendChild(overlayCanvas);

    // Info Stats Bar (Score, Lines, Next Piece)
    const statsBar = document.createElement('div');
    statsBar.style.cssText = 'width: 100%; display: flex; justify-content: space-between; align-items: center; margin-top: 0.6rem; font-size: 0.9rem; font-weight: 700; color: #94a3b8;';

    const scoreEl = document.createElement('div');
    scoreEl.style.color = '#facc15';
    scoreEl.innerText = '0 P';

    const linesEl = document.createElement('div');
    linesEl.innerText = '0 Satır';

    const nextEl = document.createElement('div');
    nextEl.style.cssText = 'background: #0f172a; border: 1px solid #334155; border-radius: 0.4rem; padding: 0.1rem 0.5rem; font-weight: 800; color: #38bdf8;';
    nextEl.innerText = `Sıradaki: ${player.next}`;

    statsBar.appendChild(scoreEl);
    statsBar.appendChild(linesEl);
    statsBar.appendChild(nextEl);

    // Garbage Warning Bar
    const garbageWarningEl = document.createElement('div');
    garbageWarningEl.style.cssText = 'width: 100%; display: none; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; border-radius: 0.4rem; padding: 0.2rem 0.4rem; font-size: 0.75rem; font-weight: 800; text-align: center; margin-top: 0.4rem;';
    garbageWarningEl.innerText = '⚠️ +1 Garbage Geliyor!';

    cardEl.appendChild(topBar);
    cardEl.appendChild(canvasWrapper);
    cardEl.appendChild(statsBar);
    cardEl.appendChild(garbageWarningEl);

    return {
      cardEl,
      canvas,
      ctx,
      overlayCanvas,
      overlayCtx,
      statusBadge,
      scoreEl,
      linesEl,
      nextEl,
      garbageWarningEl,
      rankBadge,
      comboBadge,
      particles: [],
      floatingTexts: [],
      prevLines: player.lines,
      animFrame: 0,
    };
  }

  /* ─────────── Overlay Animation Loop ─────────── */

  private startOverlayAnimation(card: PlayerBoardCard) {
    const loop = () => {
      card.animFrame = requestAnimationFrame(loop);
      const { overlayCtx: ctx, overlayCanvas: cvs } = card;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Update & draw particles
      for (let i = card.particles.length - 1; i >= 0; i--) {
        const p = card.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life--;

        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);

        if (p.life <= 0) card.particles.splice(i, 1);
      }

      // Update & draw floating texts
      for (let i = card.floatingTexts.length - 1; i >= 0; i--) {
        const ft = card.floatingTexts[i];
        ft.y += ft.vy;
        ft.life--;

        const alpha = Math.max(0, ft.life / ft.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `${ft.fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);

        if (ft.life <= 0) card.floatingTexts.splice(i, 1);
      }

      ctx.globalAlpha = 1;
    };
    card.animFrame = requestAnimationFrame(loop);
  }

  /* ─────────── Spawn Explosion Particles ─────────── */

  private spawnLineExplosion(card: PlayerBoardCard, rows: number[]) {
    const sparkColors = ['#facc15', '#f97316', '#ef4444', '#22c55e', '#38bdf8', '#a855f7', '#ffffff'];
    for (const row of rows) {
      const cy = row * BLOCK_SIZE + BLOCK_SIZE / 2;

      // Row flash: wide line of particles
      for (let x = 0; x < WIDTH; x++) {
        const cx = x * BLOCK_SIZE + BLOCK_SIZE / 2;
        const count = 3;
        for (let i = 0; i < count; i++) {
          card.particles.push({
            x: cx,
            y: cy,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 5 - 1.5,
            life: 25 + Math.floor(Math.random() * 20),
            maxLife: 45,
            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
            size: 2 + Math.random() * 3,
          });
        }
      }
    }
  }

  /* ─────────── Spawn Combo Floating Text ─────────── */

  private spawnComboText(card: PlayerBoardCard, combo: number, bonus: number) {
    card.floatingTexts.push({
      text: `🔥 COMBO x${combo}! +${bonus}P`,
      x: (WIDTH * BLOCK_SIZE) / 2,
      y: (HEIGHT * BLOCK_SIZE) / 2,
      vy: -1.2,
      life: 60,
      maxLife: 60,
      color: '#f97316',
      fontSize: 14,
    });
  }

  /* ─────────── Render Player ─────────── */

  private renderPlayer(card: PlayerBoardCard, player: TetrisPlayerSnapshot, rank: number) {
    const { ctx, canvas } = card;

    // 0. Leader Frame & Rank Badge
    if (rank === 1) {
      card.cardEl.style.border = '3px solid #f59e0b';
      card.cardEl.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.5), 0 8px 25px rgba(0,0,0,0.4)';
      card.rankBadge.style.display = 'block';
      card.rankBadge.innerText = '👑';
    } else if (rank === 2) {
      card.cardEl.style.border = '2px solid #94a3b8';
      card.cardEl.style.boxShadow = '0 0 15px rgba(148, 163, 184, 0.3), 0 8px 25px rgba(0,0,0,0.4)';
      card.rankBadge.style.display = 'block';
      card.rankBadge.innerText = '🥈';
    } else if (rank === 3) {
      card.cardEl.style.border = '2px solid #cd7f32';
      card.cardEl.style.boxShadow = '0 0 15px rgba(205, 127, 50, 0.3), 0 8px 25px rgba(0,0,0,0.4)';
      card.rankBadge.style.display = 'block';
      card.rankBadge.innerText = '🥉';
    } else {
      card.cardEl.style.border = '2px solid #334155';
      card.cardEl.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
      card.rankBadge.style.display = 'none';
    }

    // 1. Alive / Eliminated state
    if (player.alive) {
      card.cardEl.style.opacity = '1';
      card.statusBadge.innerText = rank <= 3 ? `#${rank} CANLI` : 'CANLI';
      card.statusBadge.style.background = 'rgba(34, 197, 94, 0.2)';
      card.statusBadge.style.color = '#22c55e';
      card.statusBadge.style.borderColor = '#22c55e';
    } else {
      card.cardEl.style.opacity = '0.5';
      card.statusBadge.innerText = `💀 ELENDİ (#${player.place})`;
      card.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      card.statusBadge.style.color = '#ef4444';
      card.statusBadge.style.borderColor = '#ef4444';
      // Reset leader frame on elimination
      card.cardEl.style.border = '2px solid #ef4444';
      card.cardEl.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
    }

    // 2. Stats
    card.scoreEl.innerText = `${player.score} P`;
    card.linesEl.innerText = `${player.lines} Satır (Lv.${player.level})`;
    card.nextEl.innerText = `Sonraki: ${player.next}`;

    // 3. Garbage warning
    if (player.garbagePending > 0) {
      card.garbageWarningEl.style.display = 'block';
      card.garbageWarningEl.innerText = `⚠️ +${player.garbagePending} Garbage Geliyor!`;
    } else {
      card.garbageWarningEl.style.display = 'none';
    }

    // 4. Combo badge
    if (player.combo >= 2) {
      card.comboBadge.style.display = 'block';
      card.comboBadge.innerText = `🔥 x${player.combo}`;
    } else {
      card.comboBadge.style.display = 'none';
    }

    // 5. Detect new line clears → spawn explosion + combo text
    if (player.lines > card.prevLines) {
      const clearedRows = player.lastClearedRows ?? [];
      if (clearedRows.length > 0) {
        this.spawnLineExplosion(card, clearedRows);
      }
      if (player.combo >= 2 && player.lastStreakBonus > 0) {
        this.spawnComboText(card, player.combo, player.lastStreakBonus);
      }
    }
    card.prevLines = player.lines;

    // 6. Draw Board
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK_SIZE, 0);
      ctx.lineTo(x * BLOCK_SIZE, HEIGHT * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK_SIZE);
      ctx.lineTo(WIDTH * BLOCK_SIZE, y * BLOCK_SIZE);
      ctx.stroke();
    }

    // Draw Locked Cells
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const val = player.board[y * WIDTH + x] ?? 0;
        if (val > 0) {
          const color = PIECE_COLORS[val] || '#38bdf8';
          this.drawBlock(ctx, x, y, color);
        }
      }
    }

    // Draw Active Falling Piece
    if (player.alive && player.current) {
      const activeColor = PIECE_COLORS[TYPE_VALUE[player.current.type]] || '#38bdf8';
      const cells = getActiveCells(player.current);

      for (const [dx, dy] of cells) {
        const px = player.current.x + dx;
        const py = player.current.y + dy;
        if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
          this.drawBlock(ctx, px, py, activeColor, true);
        }
      }
    }
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    isActive: boolean = false
  ) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    // Fill body
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    // Inner bevel highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, 2);
    ctx.fillRect(px + 1, py + 1, 2, BLOCK_SIZE - 2);

    // Inner bevel shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(px + 1, py + BLOCK_SIZE - 3, BLOCK_SIZE - 2, 2);
    ctx.fillRect(px + BLOCK_SIZE - 3, py + 1, 2, BLOCK_SIZE - 2);

    if (isActive) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, BLOCK_SIZE - 3, BLOCK_SIZE - 3);
    }
  }

  public dispose() {
    for (const [, card] of this.boardCards.entries()) {
      if (card.animFrame) cancelAnimationFrame(card.animFrame);
    }
    this.container.innerHTML = '';
    this.boardCards.clear();
    if (this.podiumBar) {
      this.podiumBar.remove();
      this.podiumBar = null;
    }
  }
}
