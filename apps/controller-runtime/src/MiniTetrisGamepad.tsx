import { useState, useEffect, useRef } from 'preact/hooks';
import type { ControllerSDK } from '@platform/sdk-controller';
import type { TetrisMatchSnapshot, TetrisInput, TetrisPlayerSnapshot } from '@games/mini-tetris';

interface MiniTetrisGamepadProps {
  sdk: ControllerSDK;
  myNickname: string;
  myPlayerId?: string;
}

export function MiniTetrisGamepad({
  sdk,
  myNickname,
  myPlayerId
}: MiniTetrisGamepadProps) {
  const [matchState, setMatchState] = useState<TetrisMatchSnapshot | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sdk.onTetrisState = (state: TetrisMatchSnapshot) => {
      setMatchState(state);
    };

    return () => {
      if (repeatTimer.current) {
        clearInterval(repeatTimer.current);
        repeatTimer.current = null;
      }
    };
  }, [sdk]);

  const sendInput = (input: TetrisInput) => {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    sdk.sendTetrisInput(input);
  };

  const startSoftDrop = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    sendInput({ type: 'SOFT_DROP_START' });
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    repeatTimer.current = setInterval(() => {
      sendInput({ type: 'SOFT_DROP_START' });
    }, 70);
  };

  const endSoftDrop = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    sendInput({ type: 'SOFT_DROP_END' });
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  // Find user's player snapshot
  let myPlayer: TetrisPlayerSnapshot | undefined;
  if (matchState?.players) {
    myPlayer = matchState.players.find(
      (p) => p.id === myPlayerId || (myNickname && p.nickname === myNickname)
    );
  }

  const isAlive = myPlayer ? myPlayer.alive : true;
  const remainingSec = matchState ? Math.max(0, Math.floor(matchState.remainingMs / 1000)) : 180;
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div
      class="container"
      style={{
        padding: '1rem',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'
      }}
    >
      {/* 1. TOP STATUS HUD */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#1e293b',
          border: '2px solid #334155',
          borderRadius: '1rem',
          padding: '0.8rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8' }}>
            🧱 TETRIS
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
            {matchState?.phase === 'countdown'
              ? 'HAZIRLANIN!'
              : matchState?.phase === 'playing'
              ? 'CANLI OYUN'
              : matchState?.phase === 'finished'
              ? 'MAÇ BİTTİ'
              : 'BEKLENİYOR'}
          </div>
        </div>

        <div
          style={{
            fontSize: '1.6rem',
            fontWeight: 900,
            color: '#facc15',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          ⏱️ {timeFormatted}
        </div>
      </div>

      {/* 2. PLAYER STATS CARD */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: isAlive ? 'rgba(30, 41, 59, 0.7)' : 'rgba(239, 68, 68, 0.15)',
          border: `2px solid ${isAlive ? '#334155' : '#ef4444'}`,
          borderRadius: '1rem',
          padding: '0.8rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            {myNickname}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {myPlayer ? `${myPlayer.lines} Satır (Lv.${myPlayer.level})` : '0 Satır'}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#facc15' }}>
            {myPlayer ? `${myPlayer.score} Puan` : '0 P'}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              color: isAlive ? '#22c55e' : '#ef4444',
              marginTop: '0.2rem'
            }}
          >
            {isAlive ? '💚 CANLI' : `💀 ELENDİ (#${myPlayer?.place || '?'})`}
          </div>
        </div>

        {myPlayer?.next && (
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: '0.6rem',
              padding: '0.3rem 0.6rem',
              fontSize: '0.9rem',
              fontWeight: 900,
              color: '#38bdf8'
            }}
          >
            Sıradaki: {myPlayer.next}
          </div>
        )}

        {myPlayer && myPlayer.combo >= 2 && (
          <div
            style={{
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              color: 'white',
              borderRadius: '0.6rem',
              padding: '0.3rem 0.6rem',
              fontSize: '0.9rem',
              fontWeight: 900,
              textAlign: 'center',
              boxShadow: '0 3px 12px rgba(239, 68, 68, 0.4)',
            }}
          >
            🔥 Combo x{myPlayer.combo}
            {myPlayer.lastStreakBonus > 0 && (
              <span style={{ marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                +{myPlayer.lastStreakBonus}P
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. CONTROLS AREA */}
      {!isAlive ? (
        <div class="foul-box" style={{ width: '100%', maxWidth: '380px', margin: 'auto 0' }}>
          💀 ELENDİN! (#{myPlayer?.place})
          <div style={{ fontSize: '1rem', marginTop: '0.5rem', color: 'white' }}>
            Skorun: {myPlayer?.score} Puan
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.4rem', opacity: 0.8 }}>
            Büyük ekrandan diğer rakipleri izleyebilirsin.
          </div>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            margin: 'auto 0'
          }}
        >
          {/* Rotate Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              sendInput({ type: 'ROTATE_CW' });
            }}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              color: 'white',
              fontSize: '1.5rem',
              fontWeight: 900,
              height: '75px',
              borderRadius: '1.2rem',
              boxShadow: '0 6px 20px rgba(14, 165, 233, 0.4)',
              width: '100%',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            🔄 DÖNDÜR (ROTATE)
          </button>

          {/* Middle Row: Left, Hard Drop, Right */}
          <div style={{ display: 'flex', gap: '0.8rem', width: '100%' }}>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                sendInput({ type: 'MOVE_LEFT' });
              }}
              style={{
                flex: 1,
                background: '#1e293b',
                border: '2px solid #38bdf8',
                color: '#38bdf8',
                fontSize: '2.2rem',
                fontWeight: 900,
                height: '80px',
                borderRadius: '1rem',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ◀
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                sendInput({ type: 'HARD_DROP' });
              }}
              style={{
                flex: 1.2,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                fontSize: '1.3rem',
                fontWeight: 900,
                height: '80px',
                borderRadius: '1rem',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
              }}
            >
              <span>⚡ DROP</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>ANINDA DÜŞÜR</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                sendInput({ type: 'MOVE_RIGHT' });
              }}
              style={{
                flex: 1,
                background: '#1e293b',
                border: '2px solid #38bdf8',
                color: '#38bdf8',
                fontSize: '2.2rem',
                fontWeight: 900,
                height: '80px',
                borderRadius: '1rem',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ▶
            </button>
          </div>

          {/* Bottom Row: Soft Drop (Continuous press) */}
          <button
            type="button"
            onPointerDown={startSoftDrop}
            onPointerUp={endSoftDrop}
            onPointerCancel={endSoftDrop}
            onPointerLeave={endSoftDrop}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: 'white',
              fontSize: '1.3rem',
              fontWeight: 900,
              height: '70px',
              borderRadius: '1.2rem',
              boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)',
              width: '100%',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            ▼ HIZLI İNDİR (SOFT DROP)
          </button>
        </div>
      )}
    </div>
  );
}
