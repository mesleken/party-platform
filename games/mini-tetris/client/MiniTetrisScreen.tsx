import React from 'react';
import type { TetrisMatchSnapshot, TetrisPlayerSnapshot } from '../shared/types.js';

const WIDTH = 10;
const HEIGHT = 20;

function cellOccupied(
  player: TetrisPlayerSnapshot,
  x: number,
  y: number,
): number {
  const value = player.board[y * WIDTH + x] ?? 0;

  // Overlay active piece locally.
  for (const [dx, dy] of activeCells(player.current)) {
    if (player.current.x + dx === x && player.current.y + dy === y) {
      return value || 9;
    }
  }

  return value;
}

function activeCells(piece: TetrisPlayerSnapshot['current']): [number, number][] {
  // Client-side copy only for rendering. Server remains authoritative.
  const shapes: Record<string, [number, number][][]> = {
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

  const variants = shapes[piece.type];
  return variants[piece.rotation % variants.length];
}

export function MiniTetrisScreen({
  state,
}: {
  state: TetrisMatchSnapshot | null;
}) {
  if (!state) {
    return <div>Mini Tetris yükleniyor…</div>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#0b1020',
        color: '#fff',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>MINI TETRIS</h1>
          <div style={{ opacity: 0.7 }}>
            {state.phase === 'countdown'
              ? 'Hazırlan…'
              : state.phase === 'playing'
                ? 'OYUNDA'
                : state.phase === 'finished'
                  ? 'MAÇ BİTTİ'
                  : 'LOBBY'}
          </div>
        </div>

        <div style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(state.remainingMs)}
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, state.players.length))}, minmax(150px, 1fr))`,
          gap: 16,
          alignItems: 'start',
        }}
      >
        {state.players.map((player) => (
          <PlayerBoard key={player.id} player={player} />
        ))}
      </section>

      {state.phase === 'finished' && state.winnerId && (
        <div style={{ marginTop: 20, fontSize: 24 }}>
          Kazanan:{' '}
          {state.players.find((player) => player.id === state.winnerId)?.nickname ??
            '—'}
        </div>
      )}
    </main>
  );
}

function PlayerBoard({ player }: { player: TetrisPlayerSnapshot }) {
  return (
    <article
      style={{
        opacity: player.alive ? 1 : 0.5,
        background: '#131a2d',
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
          fontWeight: 700,
        }}
      >
        <span>
          #{player.place} {player.nickname}
        </span>
        <span>{player.score}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${WIDTH}, 1fr)`,
          aspectRatio: `${WIDTH}/${HEIGHT}`,
          background: '#080c18',
          border: '2px solid #2a3352',
        }}
      >
        {Array.from({ length: WIDTH * HEIGHT }).map((_, index) => {
          const x = index % WIDTH;
          const y = Math.floor(index / WIDTH);
          const value = cellOccupied(player, x, y);

          return (
            <div
              key={index}
              style={{
                borderRight: '1px solid rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: value ? cellColor(value) : 'transparent',
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 12,
          opacity: 0.75,
        }}
      >
        <span>LV {player.level}</span>
        <span>LINES {player.lines}</span>
        <span>NEXT {player.next}</span>
      </div>

      {!player.alive && (
        <div style={{ marginTop: 6, fontWeight: 700 }}>ELENDİN</div>
      )}
    </article>
  );
}

function cellColor(value: number): string {
  const colors = [
    '',
    '#45b7ff',
    '#ffd34d',
    '#ad7cff',
    '#57d38c',
    '#ff6d7a',
    '#6a86ff',
    '#ff9b4a',
    '#737a91',
    '#ffffff',
  ];
  return colors[value] ?? '#ffffff';
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
