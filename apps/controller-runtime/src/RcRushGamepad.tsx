import { useState, useEffect, useRef } from 'preact/hooks';
import type { ControllerSDK } from '@platform/sdk-controller';
import type { RcRushSnapshot, CarSnapshot, RcRushInput } from '@games/rc-rush';

interface Props {
  sdk: ControllerSDK;
  myNickname: string;
  myPlayerId?: string;
}

export function RcRushGamepad({ sdk, myNickname, myPlayerId }: Props) {
  const [carState, setCarState] = useState<CarSnapshot | null>(null);
  const [totalLaps, setTotalLaps] = useState(3);
  const [phase, setPhase] = useState<'countdown' | 'racing' | 'completed'>('countdown');
  const [countdown, setCountdown] = useState(3);

  const [steerLeftPressed, setSteerLeftPressed] = useState(false);
  const [steerRightPressed, setSteerRightPressed] = useState(false);
  const [gasPressed, setGasPressed] = useState(false);
  const [brakePressed, setBrakePressed] = useState(false);
  const [boostPressed, setBoostPressed] = useState(false);

  const inputRef = useRef<RcRushInput>({
    steer: 0,
    throttle: 0,
    brake: 0,
    boost: false,
    useItem: false,
  });

  const triggerHaptic = (pattern: number | number[] = 25) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  };

  const sendInput = () => {
    sdk.sendRcRushInput(inputRef.current);
  };

  useEffect(() => {
    sdk.onRcRushState = (snapshot: RcRushSnapshot) => {
      setPhase(snapshot.phase);
      setCountdown(snapshot.countdown);
      setTotalLaps(snapshot.totalLaps);

      // Oyuncunun kendi aracını bul
      const myCar = snapshot.cars.find(
        (c) => c.id === myPlayerId || c.nickname === myNickname
      ) || snapshot.cars[0];

      if (myCar) {
        setCarState(myCar);
      }
    };

    sdk.onRcRushEvent = (raceEvent: any) => {
      const isMe =
        raceEvent.playerId === myPlayerId ||
        raceEvent.playerName === myNickname ||
        raceEvent.targetId === myPlayerId ||
        raceEvent.targetName === myNickname;
      if (!isMe) return;

      if (raceEvent.type === 'CRASH') {
        triggerHaptic(65);
      } else if (raceEvent.type === 'ROCKET_HIT') {
        triggerHaptic([40, 40, 75]);
      } else if (raceEvent.type === 'ITEM_PICKED') {
        triggerHaptic(20);
      } else if (raceEvent.type === 'BOOST') {
        triggerHaptic(30);
      } else if (raceEvent.type === 'OIL_SLIP') {
        triggerHaptic(45);
      }
    };

    // 30Hz girdi akışı
    const inputInterval = setInterval(() => {
      sendInput();
    }, 1000 / 30);

    return () => {
      clearInterval(inputInterval);
    };
  }, [myPlayerId, myNickname]);

  // Direksiyon Dokunmatik Olayları
  const handleSteerLeftStart = () => {
    inputRef.current.steer = -1.0;
    setSteerLeftPressed(true);
    setSteerRightPressed(false);
    sendInput();
  };

  const handleSteerRightStart = () => {
    inputRef.current.steer = 1.0;
    setSteerRightPressed(true);
    setSteerLeftPressed(false);
    sendInput();
  };

  const handleSteerLeftEnd = () => {
    setSteerLeftPressed(false);
    if (inputRef.current.steer === -1.0) {
      inputRef.current.steer = 0;
    }
    sendInput();
  };

  const handleSteerRightEnd = () => {
    setSteerRightPressed(false);
    if (inputRef.current.steer === 1.0) {
      inputRef.current.steer = 0;
    }
    sendInput();
  };

  // Gaz / Fren Dokunmatik Olayları
  const handleGasStart = () => {
    inputRef.current.throttle = 1.0;
    inputRef.current.brake = 0;
    setGasPressed(true);
    setBrakePressed(false);
    sendInput();
  };

  const handleGasEnd = () => {
    inputRef.current.throttle = 0;
    setGasPressed(false);
    sendInput();
  };

  const handleBrakeStart = () => {
    inputRef.current.brake = 1.0;
    inputRef.current.throttle = 0;
    setBrakePressed(true);
    setGasPressed(false);
    sendInput();
  };

  const handleBrakeEnd = () => {
    inputRef.current.brake = 0;
    setBrakePressed(false);
    sendInput();
  };

  // Turbo / Boost
  const handleBoostStart = () => {
    triggerHaptic(25);
    inputRef.current.boost = true;
    setBoostPressed(true);
    sendInput();
  };

  const handleBoostEnd = () => {
    inputRef.current.boost = false;
    setBoostPressed(false);
    sendInput();
  };

  // Item Kullanımı
  const handleUseItem = () => {
    triggerHaptic(35);
    inputRef.current.useItem = true;
    sendInput();
    setTimeout(() => {
      inputRef.current.useItem = false;
      sendInput();
    }, 150);
  };

  // Klavye Desteği (Masaüstü / Test Kolaylığı: Ok Tuşları / WASD / Space / Shift)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        inputRef.current.steer = -1.0;
        setSteerLeftPressed(true);
        sendInput();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputRef.current.steer = 1.0;
        setSteerRightPressed(true);
        sendInput();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputRef.current.throttle = 1.0;
        inputRef.current.brake = 0;
        setGasPressed(true);
        sendInput();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        inputRef.current.brake = 1.0;
        inputRef.current.throttle = 0;
        setBrakePressed(true);
        sendInput();
      } else if (e.key === 'Shift') {
        inputRef.current.boost = true;
        setBoostPressed(true);
        sendInput();
      } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        handleUseItem();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setSteerLeftPressed(false);
        if (inputRef.current.steer === -1.0) {
          inputRef.current.steer = 0;
        }
        sendInput();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setSteerRightPressed(false);
        if (inputRef.current.steer === 1.0) {
          inputRef.current.steer = 0;
        }
        sendInput();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setGasPressed(false);
        inputRef.current.throttle = 0;
        sendInput();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setBrakePressed(false);
        inputRef.current.brake = 0;
        sendInput();
      } else if (e.key === 'Shift') {
        setBoostPressed(false);
        inputRef.current.boost = false;
        sendInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const itemIcons: Record<string, string> = {
    rocket: '🚀 ROKET',
    turbo: '⚡ NİTRO',
    oil: '🛢️ YAĞ',
    shield: '🛡️ KALKAN',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100dvw',
        background: '#090d16',
        color: 'white',
        userSelect: 'none',
        touchAction: 'none',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ─── ÜST DURUM ÇUBUĞU (TELEMETRİ) ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.7rem 1.2rem',
          background: 'rgba(15,23,42,0.85)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              color: '#38bdf8',
              lineHeight: 1,
            }}
          >
            #{carState?.position || 1}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>
            LAP {carState?.lap || 1}/{totalLaps}
          </span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              fontFamily: 'monospace',
              color: '#f8fafc',
            }}
          >
            {carState?.speed || 0}
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.2rem' }}>
              KM/H
            </span>
          </div>
        </div>

        {/* Taşınan Güçlendirme */}
        <div>
          {carState?.item ? (
            <div
              style={{
                background: '#facc15',
                color: '#0f172a',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              {itemIcons[carState.item] || 'GÜÇ HAZIR'}
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>BOŞ</span>
          )}
        </div>
      </div>

      {/* Ters Yön Uyarısı */}
      {carState?.isWrongWay && (
        <div
          style={{
            background: '#dc2626',
            color: 'white',
            textAlign: 'center',
            padding: '0.4rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
          }}
        >
          ⚠️ TERS YÖNDESİNİZ! GERİ DÖNÜN!
        </div>
      )}

      {/* Geri Sayım Bilgilendirmesi */}
      {phase === 'countdown' && (
        <div
          style={{
            background: 'rgba(250,204,21,0.2)',
            borderBottom: '2px solid #facc15',
            color: '#facc15',
            textAlign: 'center',
            padding: '0.4rem',
            fontSize: '0.9rem',
            fontWeight: 800,
          }}
        >
          YARIŞ BAŞLIYOR: {countdown > 0 ? countdown : 'GO!'}
        </div>
      )}

      {/* ─── ANA KONTROL ALANI (İKİYE BÖLÜNMÜŞ) ─── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          padding: '1rem',
        }}
      >
        {/* SOL TARAF: DİREKSİYON (SOL - SAĞ DÜĞMELERİ) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.8rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            DİREKSİYON
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            {/* Sol Butonu */}
            <button
              type="button"
              onTouchStart={handleSteerLeftStart}
              onTouchEnd={handleSteerLeftEnd}
              onTouchCancel={handleSteerLeftEnd}
              onMouseDown={handleSteerLeftStart}
              onMouseUp={handleSteerLeftEnd}
              onMouseLeave={handleSteerLeftEnd}
              style={{
                background: steerLeftPressed
                  ? 'linear-gradient(180deg, #0284c7, #0369a1)'
                  : 'linear-gradient(180deg, #1e293b, #0f172a)',
                border: steerLeftPressed ? '3px solid #38bdf8' : '2px solid rgba(56,189,248,0.5)',
                borderRadius: '1.2rem',
                color: steerLeftPressed ? '#ffffff' : '#38bdf8',
                fontSize: '2.5rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: steerLeftPressed
                  ? '0 0 30px rgba(56,189,248,0.8), inset 0 0 15px rgba(56,189,248,0.5)'
                  : '0 8px 20px rgba(0,0,0,0.4)',
                transform: steerLeftPressed ? 'scale(0.96)' : 'scale(1)',
                transition: 'transform 0.08s, box-shadow 0.08s, background 0.08s',
                cursor: 'pointer',
              }}
            >
              ◀
            </button>

            {/* Sağ Butonu */}
            <button
              type="button"
              onTouchStart={handleSteerRightStart}
              onTouchEnd={handleSteerRightEnd}
              onTouchCancel={handleSteerRightEnd}
              onMouseDown={handleSteerRightStart}
              onMouseUp={handleSteerRightEnd}
              onMouseLeave={handleSteerRightEnd}
              style={{
                background: steerRightPressed
                  ? 'linear-gradient(180deg, #0284c7, #0369a1)'
                  : 'linear-gradient(180deg, #1e293b, #0f172a)',
                border: steerRightPressed ? '3px solid #38bdf8' : '2px solid rgba(56,189,248,0.5)',
                borderRadius: '1.2rem',
                color: steerRightPressed ? '#ffffff' : '#38bdf8',
                fontSize: '2.5rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: steerRightPressed
                  ? '0 0 30px rgba(56,189,248,0.8), inset 0 0 15px rgba(56,189,248,0.5)'
                  : '0 8px 20px rgba(0,0,0,0.4)',
                transform: steerRightPressed ? 'scale(0.96)' : 'scale(1)',
                transition: 'transform 0.08s, box-shadow 0.08s, background 0.08s',
                cursor: 'pointer',
              }}
            >
              ▶
            </button>
          </div>

          {/* GÜÇ KULLAN BUTONU (SOL ALT) */}
          <button
            type="button"
            onClick={handleUseItem}
            disabled={!carState?.item}
            style={{
              height: '65px',
              background: carState?.item
                ? 'linear-gradient(135deg, #facc15, #f59e0b)'
                : 'rgba(255,255,255,0.06)',
              border: carState?.item ? '2px solid #fef08a' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1rem',
              color: carState?.item ? '#0f172a' : '#475569',
              fontSize: '1rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: carState?.item ? '0 0 25px rgba(250,204,21,0.5)' : 'none',
              cursor: carState?.item ? 'pointer' : 'default',
            }}
          >
            <span>🎯</span> GÜÇ KULLAN
          </button>
        </div>

        {/* SAĞ TARAF: GAZ, FREN VE NİTRO */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.8rem',
          }}
        >
          {/* NITRO / TURBO BUTONU (ÜST) */}
          <button
            type="button"
            onTouchStart={handleBoostStart}
            onTouchEnd={handleBoostEnd}
            onTouchCancel={handleBoostEnd}
            onMouseDown={handleBoostStart}
            onMouseUp={handleBoostEnd}
            onMouseLeave={handleBoostEnd}
            style={{
              height: '60px',
              background: boostPressed
                ? 'linear-gradient(135deg, #ea580c, #c2410c)'
                : 'linear-gradient(135deg, #f97316, #ea580c)',
              border: boostPressed ? '3px solid #ffedd5' : '2px solid #fdba74',
              borderRadius: '1rem',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 900,
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 1.2rem',
              boxShadow: boostPressed
                ? '0 0 30px rgba(249,115,22,0.9), inset 0 0 15px rgba(255,255,255,0.4)'
                : '0 6px 20px rgba(249,115,22,0.4)',
              transform: boostPressed ? 'scale(0.97)' : 'scale(1)',
              transition: 'transform 0.08s, box-shadow 0.08s',
              cursor: 'pointer',
            }}
          >
            <span>🚀 NİTRO</span>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {Math.round(carState?.boostMeter || 0)}%
            </span>
          </button>

          {/* GAZ VE FREN PEDALLARI */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* GAZ PEDALI */}
            <button
              type="button"
              onTouchStart={handleGasStart}
              onTouchEnd={handleGasEnd}
              onTouchCancel={handleGasEnd}
              onMouseDown={handleGasStart}
              onMouseUp={handleGasEnd}
              onMouseLeave={handleGasEnd}
              style={{
                flex: 1.5,
                background: gasPressed
                  ? 'linear-gradient(180deg, #22c55e, #16a34a)'
                  : 'linear-gradient(180deg, #16a34a, #15803d)',
                border: gasPressed ? '3px solid #86efac' : '2px solid #4ade80',
                borderRadius: '1.2rem',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 900,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: gasPressed
                  ? '0 0 35px rgba(34,197,94,0.9), inset 0 0 20px rgba(255,255,255,0.4)'
                  : '0 8px 25px rgba(22,163,74,0.4)',
                transform: gasPressed ? 'scale(0.97)' : 'scale(1)',
                transition: 'transform 0.08s, box-shadow 0.08s',
                cursor: 'pointer',
              }}
            >
              <span>▲</span>
              <span style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>GAZ</span>
            </button>

            {/* FREN / GERİ PEDALI */}
            <button
              type="button"
              onTouchStart={handleBrakeStart}
              onTouchEnd={handleBrakeEnd}
              onTouchCancel={handleBrakeEnd}
              onMouseDown={handleBrakeStart}
              onMouseUp={handleBrakeEnd}
              onMouseLeave={handleBrakeEnd}
              style={{
                flex: 1,
                background: brakePressed
                  ? 'linear-gradient(180deg, #ef4444, #dc2626)'
                  : 'linear-gradient(180deg, #dc2626, #b91c1c)',
                border: brakePressed ? '3px solid #fca5a5' : '2px solid #f87171',
                borderRadius: '1rem',
                color: 'white',
                fontSize: '1.2rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: brakePressed
                  ? '0 0 30px rgba(239,68,68,0.9), inset 0 0 15px rgba(255,255,255,0.4)'
                  : '0 6px 20px rgba(220,38,38,0.4)',
                transform: brakePressed ? 'scale(0.97)' : 'scale(1)',
                transition: 'transform 0.08s, box-shadow 0.08s',
                cursor: 'pointer',
              }}
            >
              <span>▼</span>
              <span style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>FREN / GERİ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
