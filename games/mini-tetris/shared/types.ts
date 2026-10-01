export const TETROMINO_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;

export type TetrominoType = typeof TETROMINO_TYPES[number];

export type TetrisPhase =
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'finished';

export type TetrisInput =
  | { type: 'MOVE_LEFT'; seq?: number }
  | { type: 'MOVE_RIGHT'; seq?: number }
  | { type: 'ROTATE_CW'; seq?: number }
  | { type: 'SOFT_DROP_START'; seq?: number }
  | { type: 'SOFT_DROP_END'; seq?: number }
  | { type: 'HARD_DROP'; seq?: number };

export interface ActivePiece {
  type: TetrominoType;
  rotation: number;
  x: number;
  y: number;
}

export interface TetrisPlayerSnapshot {
  id: string;
  nickname: string;
  board: number[];
  current: ActivePiece;
  next: TetrominoType;
  score: number;
  lines: number;
  level: number;
  alive: boolean;
  place: number;
  garbagePending: number;
  combo: number;
  lastClearedLines: number;
  lastClearedRows: number[];
  lastStreakBonus: number;
}

export interface TetrisMatchSnapshot {
  gameId: 'mini-tetris';
  phase: TetrisPhase;
  tick: number;
  startedAt: number;
  elapsedMs: number;
  remainingMs: number;
  playerCount: number;
  aliveCount: number;
  winnerId: string | null;
  players: TetrisPlayerSnapshot[];
}

export interface TetrisConfig {
  boardWidth: number;
  boardHeight: number;
  maxPlayers: number;
  matchDurationMs: number;
  physicsTickMs: number;
  snapshotIntervalMs: number;
  countdownMs: number;
}

export const DEFAULT_TETRIS_CONFIG: TetrisConfig = {
  boardWidth: 10,
  boardHeight: 20,
  maxPlayers: 8,
  matchDurationMs: 180_000,
  physicsTickMs: 50,
  snapshotIntervalMs: 100,
  countdownMs: 3_000,
};
