import { useState, useEffect, useRef } from 'preact/hooks';
import type { ControllerSDK } from '@platform/sdk-controller';
import type {
  LostAndFoundSnapshot,
  PlayerInput,
  PlayerSnapshot,
} from '@games/lost-and-found';

interface LostAndFoundGamepadProps {
  sdk: ControllerSDK;
  myNickname: string;
  myPlayerId?: string;
}

export function LostAndFoundGamepad({
  sdk,
  myNickname,
  myPlayerId,
}: LostAndFoundGamepadProps) {
  const [matchState, setMatchState] = useState<LostAndFoundSnapshot | null>(null);
  const currentInput = useRef<PlayerInput>({ moveX: 0, jump: false, abilityActive: false });
  const [miloFreq, setMiloFreq] = useState(25);
  const [niaPhase, setNiaPhase] = useState(60);

  useEffect(() => {
    sdk.onLostAndFoundState = (state: LostAndFoundSnapshot) => {
      setMatchState(state);
    };

    return () => {
      // Cleanup inputs on unmount
      sdk.sendLostAndFoundInput({ moveX: 0, jump: false, abilityActive: false });
    };
  }, [sdk]);

  // Find user's player snapshot
  let myPlayer: PlayerSnapshot | undefined;
  if (matchState?.players) {
    myPlayer = matchState.players.find(
      (p) => p.id === myPlayerId || p.nickname === myNickname
    );
  }

  const role = myPlayer?.role || 'milo';
  const isMilo = role === 'milo';

  const sendInput = (partial: Partial<PlayerInput>) => {
    currentInput.current = { ...currentInput.current, ...partial };
    sdk.sendLostAndFoundInput(currentInput.current);
  };

  const handleMoveStart = (dir: number, e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(20);
    sendInput({ moveX: dir });
  };

  const handleMoveEnd = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    sendInput({ moveX: 0 });
  };

  const handleJumpPress = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(30);
    sendInput({ jump: true });
    setTimeout(() => {
      sendInput({ jump: false });
    }, 120);
  };

  const handleAbilityStart = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(40);
    sendInput({ abilityActive: true });
  };

  const handleAbilityEnd = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    sendInput({ abilityActive: false });
  };

  // Mini-Game Handler
  const handleFreqChange = (delta: number) => {
    if (navigator.vibrate) navigator.vibrate(15);
    const next = Math.max(0, Math.min(100, miloFreq + delta));
    setMiloFreq(next);
    sdk.sendLostAndFoundInput({
      moveX: 0,
      miniGameInput: { tunerValue: next },
    });
  };

  const handlePhaseChange = (delta: number) => {
    if (navigator.vibrate) navigator.vibrate(15);
    const next = (niaPhase + delta + 360) % 360;
    setNiaPhase(next);
    sdk.sendLostAndFoundInput({
      moveX: 0,
      miniGameInput: { phaseAngle: next },
    });
  };

  const themeColor = isMilo ? '#38bdf8' : '#facc15';
  const roleName = isMilo ? 'MILO' : 'NIA';
  const roleAbility = isMilo ? '🧲 MIKNATIS ELDİVENİ' : '🪝 ENERJİ KANCASI';

  // ─── 1. BÖLÜM BİTTİ (ZAFER EKRANI) ───
  if (matchState?.phase === 'completed') {
    return (
      <div
        class="container"
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
          color: 'white',
          padding: '2rem',
          textAlign: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '5rem', marginBottom: '0.8rem' }}>🎉</div>
        <h1 style={{ color: '#facc15', fontSize: '2.4rem', margin: 0 }}>
          BÖLÜM TAMAMLANDI!
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '0.6rem' }}>
          Harika bir ekip oldunuz! Atölyeden başarıyla kaçtınız.
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            padding: '1.2rem',
            borderRadius: '1rem',
            margin: '1.5rem 0',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>Ekip Skoru</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#38bdf8' }}>
            {myPlayer?.score || 350} Puan
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. KASA TERMİNALİ MİNİ-OYUN EKRANI ───
  if (matchState?.phase === 'minigame') {
    const sync = Math.round(matchState.miniGame.syncProgress || 0);

    return (
      <div
        class="container"
        style={{
          background: '#0a0d14',
          color: 'white',
          padding: '1.5rem',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              color: themeColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1rem',
            }}
          >
            {roleName} KONSOLU
          </div>
          <h2 style={{ margin: '0.3rem 0', fontSize: '1.6rem' }}>
            ⚡ KASA KİLİT SENKRONİZASYONU
          </h2>
          <div style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
            {isMilo
              ? 'Frekans dalgasını hedef seviyeye getirin!'
              : 'Kilit halkasını doğru açıya döndürün!'}
          </div>
        </div>

        {/* Sync Progress Gauge */}
        <div style={{ width: '100%', maxWidth: '340px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginBottom: '0.3rem',
            }}
          >
            <span style={{ color: '#cbd5e1' }}>Eşleşme Durumu</span>
            <span style={{ color: sync > 60 ? '#22c55e' : '#f59e0b' }}>%{sync}</span>
          </div>
          <div
            style={{
              height: '16px',
              background: '#1e293b',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #475569',
            }}
          >
            <div
              style={{
                width: `${sync}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
                transition: 'width 0.1s ease',
              }}
            />
          </div>
        </div>

        {/* Dynamic Controls per Role */}
        {isMilo ? (
          <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Mıknatıs Frekansı: <strong style={{ color: '#38bdf8', fontSize: '1.6rem' }}>{miloFreq}%</strong>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '2px solid #38bdf8',
                  color: 'white',
                  fontSize: '2rem',
                  padding: '1rem',
                  borderRadius: '1rem',
                }}
                onClick={() => handleFreqChange(-5)}
              >
                ◀ -5%
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: '#0284c7',
                  border: '2px solid #38bdf8',
                  color: 'white',
                  fontSize: '2rem',
                  padding: '1rem',
                  borderRadius: '1rem',
                }}
                onClick={() => handleFreqChange(5)}
              >
                +5% ▶
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Kilit Faz Açısı: <strong style={{ color: '#facc15', fontSize: '1.6rem' }}>{niaPhase}°</strong>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '2px solid #facc15',
                  color: 'white',
                  fontSize: '1.6rem',
                  padding: '1rem',
                  borderRadius: '1rem',
                }}
                onClick={() => handlePhaseChange(-15)}
              >
                ↺ -15°
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: '#d97706',
                  border: '2px solid #facc15',
                  color: 'white',
                  fontSize: '1.6rem',
                  padding: '1rem',
                  borderRadius: '1rem',
                }}
                onClick={() => handlePhaseChange(15)}
              >
                +15° ↻
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Partnerinizle konuşarak dalgaları aynı hizaya getirin!
        </div>
      </div>
    );
  }

  // ─── 3. NORMAL OYNANIŞ GAMEPAD EKRANI ───
  return (
    <div
      class="container"
      style={{
        padding: '0.8rem',
        background: '#0b0f19',
        justifyContent: 'space-between',
        userSelect: 'none',
        touchAction: 'none',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Top HUD */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.05)',
          padding: '0.6rem 1rem',
          borderRadius: '0.8rem',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.4rem' }}>{isMilo ? '🧲' : '🪝'}</span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: themeColor }}>
              {roleName} ({myNickname})
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {roleAbility}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>GÖREV</div>
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700 }}>
            {matchState?.vaultDoorOpen ? 'Portala Koş!' : 'Bulmacayı Çöz!'}
          </div>
        </div>
      </div>

      {/* Main Controller Action Area */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          flex: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0',
          gap: '1rem',
        }}
      >
        {/* Left Side: Directional Buttons */}
        <div style={{ display: 'flex', gap: '0.8rem', flex: 1, height: '100%', alignItems: 'center' }}>
          <button
            type="button"
            style={{
              flex: 1,
              height: '180px',
              background: '#1e293b',
              border: '2px solid #334155',
              borderRadius: '1.2rem',
              color: 'white',
              fontSize: '2.5rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPointerDown={(e) => handleMoveStart(-1, e)}
            onPointerUp={handleMoveEnd}
            onPointerCancel={handleMoveEnd}
          >
            ◀
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              height: '180px',
              background: '#1e293b',
              border: '2px solid #334155',
              borderRadius: '1.2rem',
              color: 'white',
              fontSize: '2.5rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPointerDown={(e) => handleMoveStart(1, e)}
            onPointerUp={handleMoveEnd}
            onPointerCancel={handleMoveEnd}
          >
            ▶
          </button>
        </div>

        {/* Right Side: Jump & Ability Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            flex: 1,
            height: '100%',
            justifyContent: 'center',
          }}
        >
          {/* Jump Button */}
          <button
            type="button"
            style={{
              height: '85px',
              background: '#2563eb',
              border: '2px solid #60a5fa',
              borderRadius: '1.2rem',
              color: 'white',
              fontSize: '1.3rem',
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 6px 15px rgba(37,99,235,0.4)',
            }}
            onPointerDown={handleJumpPress}
          >
            🔼 ZIPLA
          </button>

          {/* Dynamic Ability Button */}
          <button
            type="button"
            style={{
              height: '85px',
              background: isMilo ? '#0284c7' : '#d97706',
              border: `2px solid ${themeColor}`,
              borderRadius: '1.2rem',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: `0 6px 18px ${isMilo ? 'rgba(2,132,199,0.4)' : 'rgba(217,119,6,0.4)'}`,
            }}
            onPointerDown={handleAbilityStart}
            onPointerUp={handleAbilityEnd}
            onPointerCancel={handleAbilityEnd}
          >
            <div>{isMilo ? '🧲 MIKNATIS' : '🪝 KANCA'}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
              (Basılı Tut)
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Hint */}
      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        {isMilo
          ? 'Metal sandıkları ve güç çekirdeğini çekmek için mıknatısı basılı tut.'
          : 'Halkalara tutunmak ve uzak kolları çekmek için kancayı basılı tut.'}
      </div>
    </div>
  );
}
