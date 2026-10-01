import type {
  ActivePiece,
  TetrisConfig,
  TetrisInput,
  TetrisMatchSnapshot,
  TetrisPlayerSnapshot,
  TetrominoType,
} from '../shared/types.js';
import { DEFAULT_TETRIS_CONFIG, TETROMINO_TYPES } from '../shared/types.js';
import {
  TetrisBoard,
  spawnPiece,
  tryRotate,
} from './TetrisBoard.js';

interface PlayerRuntime {
  id: string;
  nickname: string;
  board: TetrisBoard;
  current: ActivePiece;
  next: TetrominoType;
  score: number;
  lines: number;
  level: number;
  alive: boolean;
  place: number;
  garbagePending: number;
  lastFallAt: number;
  softDrop: boolean;
  bag: TetrominoType[];
  combo: number;
  lastClearedLines: number;
  lastClearedRows: number[];
  lastStreakBonus: number;
}

export interface TetrisRoomAdapter {
  broadcast(type: string, payload: unknown): void;
  sendToPlayer(sessionId: string, type: string, payload: unknown): void;
}

export class MiniTetrisGame {
  readonly config: TetrisConfig;

  private readonly players = new Map<string, PlayerRuntime>();
  private readonly room: TetrisRoomAdapter;

  private timer?: ReturnType<typeof setInterval>;
  private startedAt = 0;
  private phase: TetrisMatchSnapshot['phase'] = 'lobby';
  private tickId = 0;
  private lastSnapshotAt = 0;
  private winnerId: string | null = null;

  constructor(
    room: TetrisRoomAdapter,
    config: Partial<TetrisConfig> = {},
  ) {
    this.room = room;
    this.config = { ...DEFAULT_TETRIS_CONFIG, ...config };
  }

  addPlayer(id: string, nickname: string): boolean {
    if (this.players.has(id)) return true;
    if (this.players.size >= this.config.maxPlayers) return false;
    if (this.phase === 'playing') return false;

    const bag = this.makeBag();
    const currentType = bag.shift()!;
    const nextType = bag.shift()!;

    this.players.set(id, {
      id,
      nickname,
      board: new TetrisBoard(),
      current: spawnPiece(currentType),
      next: nextType,
      score: 0,
      lines: 0,
      level: 1,
      alive: true,
      place: 0,
      garbagePending: 0,
      lastFallAt: Date.now(),
      softDrop: false,
      bag,
      combo: 0,
      lastClearedLines: 0,
      lastClearedRows: [],
      lastStreakBonus: 0,
    });

    return true;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.recalculatePlaces();

    if (this.phase === 'playing') {
      this.evaluateWinCondition();
    }
  }

  start(): void {
    if (this.phase !== 'lobby') return;
    if (this.players.size === 0) return;

    this.phase = 'countdown';
    this.winnerId = null;
    this.broadcastSnapshot();

    setTimeout(() => {
      if (this.phase !== 'countdown') return;

      this.phase = 'playing';
      this.startedAt = Date.now();

      for (const player of this.players.values()) {
        player.lastFallAt = this.startedAt;
      }

      this.timer = setInterval(
        () => this.update(),
        this.config.physicsTickMs,
      );

      this.broadcastSnapshot();
    }, this.config.countdownMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.phase = 'finished';
    this.broadcastSnapshot();
  }

  handleInput(id: string, input: TetrisInput): void {
    const player = this.players.get(id);
    if (!player || !player.alive || this.phase !== 'playing') return;

    switch (input.type) {
      case 'MOVE_LEFT':
        this.tryMove(player, -1);
        break;
      case 'MOVE_RIGHT':
        this.tryMove(player, 1);
        break;
      case 'ROTATE_CW': {
        const rotated = tryRotate(player.board, player.current);
        if (rotated) player.current = rotated;
        break;
      }
      case 'SOFT_DROP_START':
        player.softDrop = true;
        break;
      case 'SOFT_DROP_END':
        player.softDrop = false;
        break;
      case 'HARD_DROP':
        this.hardDrop(player);
        break;
    }

    this.broadcastSnapshot();
  }

  private update(): void {
    if (this.phase !== 'playing') return;

    const now = Date.now();
    const elapsed = now - this.startedAt;

    if (elapsed >= this.config.matchDurationMs) {
      this.finishByScore();
      return;
    }

    for (const player of this.players.values()) {
      if (!player.alive) continue;

      const interval = this.getFallInterval(player);
      if (now - player.lastFallAt < interval) continue;

      player.lastFallAt = now;

      if (!this.tryMoveDown(player)) {
        this.lockAndSpawn(player);
      }
    }

    this.recalculatePlaces();
    this.evaluateWinCondition();

    if (now - this.lastSnapshotAt >= this.config.snapshotIntervalMs) {
      this.broadcastSnapshot();
    }
  }

  private tryMove(player: PlayerRuntime, dx: number): void {
    const candidate = {
      ...player.current,
      x: player.current.x + dx,
    };

    if (!player.board.collides(candidate)) {
      player.current = candidate;
    }
  }

  private tryMoveDown(player: PlayerRuntime): boolean {
    const candidate = {
      ...player.current,
      y: player.current.y + 1,
    };

    if (player.board.collides(candidate)) return false;

    player.current = candidate;
    if (player.softDrop) player.score += 1;
    return true;
  }

  private hardDrop(player: PlayerRuntime): void {
    let distance = 0;
    while (true) {
      const candidate = {
        ...player.current,
        y: player.current.y + 1,
      };

      if (player.board.collides(candidate)) break;

      player.current = candidate;
      distance++;
    }

    player.score += distance * 2;
    this.lockAndSpawn(player);
  }

  private lockAndSpawn(player: PlayerRuntime): void {
    const cleared = player.board.lock(player.current);
    const clearedRows = [...player.board.lastClearedRows];

    player.lastClearedLines = cleared;
    player.lastClearedRows = clearedRows;
    player.lastStreakBonus = 0;

    if (cleared > 0) {
      player.lines += cleared;
      player.level = 1 + Math.floor(player.lines / 10);
      player.score += this.lineScore(cleared, player.level);

      // Consecutive line clears award streak bonus
      player.combo += 1;
      if (player.combo >= 2) {
        const bonus = (player.combo - 1) * 50 * player.level;
        player.score += bonus;
        player.lastStreakBonus = bonus;
      }

      const attack = this.garbageAttack(cleared);
      if (attack > 0) this.sendGarbage(player.id, attack);
    } else {
      player.combo = 0;
      player.lastStreakBonus = 0;
    }

    player.current = spawnPiece(player.next);
    player.next = this.takeFromBag(player);

    if (player.board.topOut(player.current)) {
      player.alive = false;
      player.place = this.aliveCount() + 1;
    }

    player.lastFallAt = Date.now();
  }

  private sendGarbage(attackerId: string, lines: number): void {
    const candidates = [...this.players.values()].filter(
      (candidate) =>
        candidate.id !== attackerId &&
        candidate.alive,
    );

    if (candidates.length === 0) return;

    // Round-robin by score keeps targeting deterministic enough for a small party game.
    candidates.sort((a, b) => b.score - a.score);
    const target = candidates[0];

    target.garbagePending += lines;
    target.board.addGarbageLines(lines, Math.random);
  }

  private evaluateWinCondition(): void {
    const alive = [...this.players.values()].filter((p) => p.alive);

    if (this.players.size === 1) {
      if (alive.length === 0) {
        this.finishByScore();
      }
      return;
    }

    if (alive.length === 1) {
      this.winnerId = alive[0].id;
      this.phase = 'finished';
      if (this.timer) clearInterval(this.timer);
      this.timer = undefined;
      this.recalculatePlaces();
      this.broadcastSnapshot();
    } else if (alive.length === 0) {
      this.finishByScore();
    }
  }

  private finishByScore(): void {
    this.recalculatePlaces();
    const ordered = [...this.players.values()].sort(
      (a, b) => b.score - a.score,
    );

    this.winnerId = ordered[0]?.id ?? null;
    this.phase = 'finished';

    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;

    this.broadcastSnapshot();
  }

  private recalculatePlaces(): void {
    const ordered = [...this.players.values()].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.score - a.score;
    });

    ordered.forEach((player, index) => {
      player.place = index + 1;
    });
  }

  private aliveCount(): number {
    return [...this.players.values()].filter((p) => p.alive).length;
  }

  private getFallInterval(player: PlayerRuntime): number {
    const base = 800;
    const acceleration = (player.level - 1) * 60;
    const softDrop = player.softDrop ? 45 : base;
    return Math.max(100, softDrop - acceleration);
  }

  private lineScore(cleared: number, level: number): number {
    const table: Record<number, number> = {
      1: 100,
      2: 300,
      3: 500,
      4: 800,
    };
    return (table[cleared] ?? 0) * level;
  }

  private garbageAttack(cleared: number): number {
    if (cleared >= 4) return 4;
    if (cleared === 3) return 2;
    if (cleared === 2) return 1;
    return 0;
  }

  private makeBag(): TetrominoType[] {
    return this.shuffle([...TETROMINO_TYPES]);
  }

  private takeFromBag(player: PlayerRuntime): TetrominoType {
    if (player.bag.length === 0) {
      player.bag = this.makeBag();
    }
    return player.bag.shift()!;
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  private getSnapshot(): TetrisMatchSnapshot {
    const now = Date.now();
    const elapsedMs =
      this.phase === 'lobby' ? 0 : Math.max(0, now - this.startedAt);

    const players: TetrisPlayerSnapshot[] = [...this.players.values()].map(
      (player) => ({
        id: player.id,
        nickname: player.nickname,
        board: player.board.toArray(),
        current: { ...player.current },
        next: player.next,
        score: player.score,
        lines: player.lines,
        level: player.level,
        alive: player.alive,
        place: player.place,
        garbagePending: player.garbagePending,
        combo: player.combo,
        lastClearedLines: player.lastClearedLines,
        lastClearedRows: [...player.lastClearedRows],
        lastStreakBonus: player.lastStreakBonus,
      }),
    );

    return {
      gameId: 'mini-tetris',
      phase: this.phase,
      tick: this.tickId,
      startedAt: this.startedAt,
      elapsedMs,
      remainingMs: Math.max(
        0,
        this.config.matchDurationMs - elapsedMs,
      ),
      playerCount: players.length,
      aliveCount: players.filter((player) => player.alive).length,
      winnerId: this.winnerId,
      players,
    };
  }

  private broadcastSnapshot(): void {
    this.tickId++;
    this.lastSnapshotAt = Date.now();
    this.room.broadcast('STATE', {
      gameId: 'mini-tetris',
      tick: this.tickId,
      state: this.getSnapshot(),
    });
  }
}
