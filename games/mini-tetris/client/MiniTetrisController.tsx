import React, { useEffect, useRef } from 'react';
import type { TetrisInput } from '../shared/types.js';

export function MiniTetrisController({
  send,
}: {
  send: (input: TetrisInput) => void;
}) {
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (repeatTimer.current) clearInterval(repeatTimer.current);
    };
  }, []);

  const startSoftDrop = () => {
    send({ type: 'SOFT_DROP_START' });
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    repeatTimer.current = setInterval(
      () => send({ type: 'SOFT_DROP_START' }),
      80,
    );
  };

  const endSoftDrop = () => {
    send({ type: 'SOFT_DROP_END' });
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  const buttonStyle: React.CSSProperties = {
    minWidth: 72,
    minHeight: 58,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,.15)',
    background: '#151c32',
    color: '#fff',
    fontSize: 18,
    touchAction: 'none',
    userSelect: 'none',
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 18,
        background: '#0b1020',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ margin: 0 }}>MINI TETRIS</h1>

      <button
        type="button"
        style={{ ...buttonStyle, minWidth: 130 }}
        onClick={() => send({ type: 'ROTATE_CW' })}
      >
        ROTATE
      </button>

      <div style={{ display: 'flex', gap: 18 }}>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => send({ type: 'MOVE_LEFT' })}
        >
          ◀
        </button>

        <button
          type="button"
          style={{ ...buttonStyle, minWidth: 110 }}
          onClick={() => send({ type: 'HARD_DROP' })}
        >
          DROP
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => send({ type: 'MOVE_RIGHT' })}
        >
          ▶
        </button>
      </div>

      <button
        type="button"
        style={{ ...buttonStyle, minWidth: 180 }}
        onPointerDown={startSoftDrop}
        onPointerUp={endSoftDrop}
        onPointerCancel={endSoftDrop}
        onPointerLeave={endSoftDrop}
      >
        ▼ SOFT DROP
      </button>
    </main>
  );
}
