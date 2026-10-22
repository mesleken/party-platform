import test from 'node:test';
import assert from 'node:assert/strict';

import { LostAndFoundGame, type RoomAdapter } from '../dist/server/LostAndFoundGame.js';
import type { LostAndFoundSnapshot } from '../dist/shared/types.js';

class MockRoomAdapter implements RoomAdapter {
  public lastBroadcastType: string = '';
  public lastBroadcastPayload: any = null;
  public broadcasts: { type: string; payload: any }[] = [];
  public directMessages: { sessionId: string; type: string; payload: any }[] = [];

  broadcast(type: string, payload: any): void {
    this.lastBroadcastType = type;
    this.lastBroadcastPayload = payload;
    this.broadcasts.push({ type, payload });
  }

  sendToPlayer(sessionId: string, type: string, payload: any): void {
    this.directMessages.push({ sessionId, type, payload });
  }

  get latestState(): LostAndFoundSnapshot {
    return this.lastBroadcastPayload?.state;
  }
}

test('LostAndFoundGame initializes with 5 collectibles and level 1', () => {
  const room = new MockRoomAdapter();
  const game = new LostAndFoundGame(room);

  try {
    game.addPlayer('session-1', 'Player 1', 'milo');
    game.addPlayer('session-2', 'Player 2', 'nia');
    game.start();

    const state = room.latestState;
    assert.ok(state, 'Snapshot should be broadcasted');
    assert.equal(state.currentLevelIndex, 1);
    assert.equal(state.totalCollectibles, 5);
    assert.equal(state.collectedCount, 0);
    assert.equal(state.collectibles.length, 5);
    assert.equal(state.players.length, 2);
  } finally {
    game.stop();
  }
});

test('Level switching updates levelIndex, levelName and resets collectibles', () => {
  const room = new MockRoomAdapter();
  const game = new LostAndFoundGame(room);

  try {
    game.addPlayer('p1', 'Milo', 'milo');
    game.addPlayer('p2', 'Nia', 'nia');
    game.start();

    game.setLevel(2);
    let state = room.latestState;
    assert.equal(state.currentLevelIndex, 2);
    assert.ok(state.levelName.includes('BÖLÜM 2'));
    assert.equal(state.collectedCount, 0);

    game.setLevel(3);
    state = room.latestState;
    assert.equal(state.currentLevelIndex, 3);
    assert.ok(state.levelName.includes('BÖLÜM 3'));
  } finally {
    game.stop();
  }
});

test('Player collects item on proximity, increments score and collectedCount', () => {
  const room = new MockRoomAdapter();
  const game = new LostAndFoundGame(room);

  try {
    game.addPlayer('p1', 'Milo', 'milo');
    game.start();

    let state = room.latestState;
    const firstItem = state.collectibles[0];
    assert.ok(firstItem);
    assert.equal(firstItem.collected, false);

    // Teleport player near first item (player center y is y+1)
    const player = (game as any).players.get('p1');
    player.x = firstItem.x;
    player.y = firstItem.y - 1;

    (game as any).updatePhysics();

    state = room.latestState;
    assert.equal(state.collectedCount, 1);
    const updatedItem = state.collectibles.find((c) => c.id === firstItem.id);
    assert.equal(updatedItem?.collected, true);
    assert.equal(state.players[0].score, 175); // 100 base + 75
  } finally {
    game.stop();
  }
});

test('Co-op ping emote broadcast and auto-expiration', () => {
  const room = new MockRoomAdapter();
  const game = new LostAndFoundGame(room);

  try {
    game.addPlayer('p1', 'Milo', 'milo');
    game.start();

    game.handleInput('p1', {
      moveX: 0,
      pingEmote: '📢 GEL',
    });

    let state = room.latestState;
    // broadcastSnapshot after input
    (game as any).broadcastSnapshot();
    state = room.latestState;
    assert.equal(state.activePings?.length, 1);
    assert.equal(state.activePings?.[0].text, '📢 GEL');
    assert.equal(state.activePings?.[0].role, 'milo');

    // Fast-forward created time past 3.5s (3500ms)
    (game as any).activePings[0].timestamp = Date.now() - 4000;
    (game as any).updatePhysics();

    state = room.latestState;
    assert.equal(state.activePings?.length, 0);
  } finally {
    game.stop();
  }
});

test('Emergency recovery resets player safely to ground', () => {
  const room = new MockRoomAdapter();
  const game = new LostAndFoundGame(room);

  try {
    game.addPlayer('p1', 'Milo', 'milo');
    game.start();

    const p1 = (game as any).players.get('p1');
    p1.x = 999;
    p1.y = -50;
    p1.vx = 25;
    p1.vy = -30;

    game.handleInput('p1', {
      moveX: 0,
      recover: true,
    });

    (game as any).broadcastSnapshot();
    const state = room.latestState;
    const snapP1 = state.players.find((p) => p.id === 'p1');
    assert.ok(snapP1);
    assert.equal(snapP1.x, 4);
    assert.equal(snapP1.y, 2.5);
    assert.equal(snapP1.vx, 0);
    assert.equal(snapP1.vy, 0);
  } finally {
    game.stop();
  }
});
