import type {
  ActivePiece,
  TetrominoType,
} from '../shared/types.js';

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

type Cell = number;

/**
 * Standard tetromino rotation data.
 * Each rotation uses a 4x4 local coordinate system.
 */
const SHAPES: Record<TetrominoType, [number, number][][]> = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
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

const TYPE_VALUE: Record<TetrominoType, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

export class TetrisBoard {
  readonly width = BOARD_WIDTH;
  readonly height = BOARD_HEIGHT;
  private readonly cells: Cell[];
  lastClearedRows: number[] = [];

  constructor() {
    this.cells = new Array(this.width * this.height).fill(0);
  }

  clone(): TetrisBoard {
    const next = new TetrisBoard();
    next.cells.splice(0, next.cells.length, ...this.cells);
    return next;
  }

  get(x: number, y: number): Cell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return 0;
    }
    return this.cells[y * this.width + x];
  }

  private set(x: number, y: number, value: Cell): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.cells[y * this.width + x] = value;
    }
  }

  getCells(piece: ActivePiece): [number, number][] {
    return SHAPES[piece.type][piece.rotation % 4].map(([dx, dy]) => [
      piece.x + dx,
      piece.y + dy,
    ]);
  }

  collides(piece: ActivePiece): boolean {
    for (const [x, y] of this.getCells(piece)) {
      if (x < 0 || x >= this.width || y >= this.height) return true;
      if (y >= 0 && this.get(x, y) !== 0) return true;
    }
    return false;
  }

  lock(piece: ActivePiece): number {
    const value = TYPE_VALUE[piece.type];
    for (const [x, y] of this.getCells(piece)) {
      if (y >= 0) this.set(x, y, value);
    }
    return this.clearLines();
  }

  clearLines(): number {
    const fullRows: number[] = [];
    for (let y = 0; y < this.height; y++) {
      let full = true;
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) === 0) {
          full = false;
          break;
        }
      }
      if (full) fullRows.push(y);
    }

    if (fullRows.length === 0) {
      this.lastClearedRows = [];
      return 0;
    }

    this.lastClearedRows = fullRows;

    const remainingRows: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      if (!fullRows.includes(y)) {
        const row: Cell[] = [];
        for (let x = 0; x < this.width; x++) {
          row.push(this.get(x, y));
        }
        remainingRows.push(row);
      }
    }

    const emptyRowsToAdd = this.height - remainingRows.length;
    for (let i = 0; i < emptyRowsToAdd; i++) {
      remainingRows.unshift(new Array(this.width).fill(0));
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.set(x, y, remainingRows[y][x]);
      }
    }

    return fullRows.length;
  }

  addGarbageLines(count: number, random: () => number): void {
    const amount = Math.max(0, Math.floor(count));
    for (let i = 0; i < amount; i++) {
      for (let y = 0; y < this.height - 1; y++) {
        for (let x = 0; x < this.width; x++) {
          this.set(x, y, this.get(x, y + 1));
        }
      }

      const hole = Math.floor(random() * this.width);
      for (let x = 0; x < this.width; x++) {
        this.set(x, this.height - 1, x === hole ? 0 : 8);
      }
    }
  }

  topOut(piece: ActivePiece): boolean {
    return this.collides(piece);
  }

  toArray(): number[] {
    return this.cells.slice();
  }
}

export function spawnPiece(type: TetrominoType): ActivePiece {
  return {
    type,
    rotation: 0,
    x: 3,
    y: 0,
  };
}

export function tryRotate(
  board: TetrisBoard,
  piece: ActivePiece,
): ActivePiece | null {
  const rotated: ActivePiece = {
    ...piece,
    rotation: (piece.rotation + 1) % 4,
  };

  // Small, deterministic wall-kick set.
  for (const offset of [0, -1, 1, -2, 2]) {
    const candidate = {
      ...rotated,
      x: rotated.x + offset,
    };
    if (!board.collides(candidate)) return candidate;
  }

  return null;
}
