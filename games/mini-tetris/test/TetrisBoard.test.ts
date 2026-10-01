import test from 'node:test';
import assert from 'node:assert/strict';

import { TetrisBoard, spawnPiece } from '../server/TetrisBoard.ts';

test('new board is empty', () => {
  const board = new TetrisBoard();
  assert.equal(board.toArray().every((cell) => cell === 0), true);
});

test('spawned piece is not initially colliding', () => {
  const board = new TetrisBoard();
  const piece = spawnPiece('T');
  assert.equal(board.collides(piece), false);
});
