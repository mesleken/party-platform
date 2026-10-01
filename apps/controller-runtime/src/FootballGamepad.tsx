import { useState, useEffect, useRef } from 'preact/hooks';
import type { ControllerSDK } from '@platform/sdk-controller';
import type { FootballMatchStateType, FootballPlayerEntityType } from '@platform/sdk-core';

interface FootballGamepadProps {
  sdk: ControllerSDK;
  myNickname: string;
  myTeam: string;
  controlledPlayerId: string;
  matchState?: FootballMatchStateType;
  tick?: number;
}

export function FootballGamepad({
  sdk,
  myNickname,
  myTeam,
  controlledPlayerId,
  matchState,
  tick
}: FootballGamepadProps) {
  // Joystick state
  const joystickRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 });
  const activeTouchId = useRef<number | null>(null);
  const moveVector = useRef({ x: 0, y: 0 });

  // Shot charging
  const [shotPower, setShotPower] = useState(0);
  const isCharging = useRef(false);
  const chargeStart = useRef(0);

  // Active player info safe lookup
  let activePlayer: FootballPlayerEntityType | undefined;
  if (matchState?.footballPlayers && controlledPlayerId) {
    activePlayer = matchState.footballPlayers.get(controlledPlayerId);
  }

  const roleName = activePlayer?.role
    ? activePlayer.role === 'forward'
      ? 'Forvet'
      : activePlayer.role === 'midfielder'
      ? 'Orta Saha'
      : activePlayer.role === 'defender'
      ? 'Defans'
      : 'Kaleci'
    : 'Saha Oyuncusu';

  // Continuous input transmission (30Hz)
  useEffect(() => {
    const interval = setInterval(() => {
      if (moveVector.current.x !== 0 || moveVector.current.y !== 0) {
        sdk.sendFootballInput({
          moveX: moveVector.current.x,
          moveY: moveVector.current.y,
          pass: false,
          shoot: false,
          tackle: false,
          switchPlayer: false,
          special: false
        });
      }
    }, 1000 / 30);

    return () => clearInterval(interval);
  }, [sdk]);

  // Shot power charging loop
  useEffect(() => {
    let animId: number;

    const chargeStep = () => {
      if (isCharging.current) {
        const elapsed = (Date.now() - chargeStart.current) / 1000;
        const power = Math.min(1.0, elapsed / 0.85); // 0.85s to max charge
        setShotPower(power);
        animId = requestAnimationFrame(chargeStep);
      }
    };

    if (isCharging.current) {
      animId = requestAnimationFrame(chargeStep);
    }

    return () => cancelAnimationFrame(animId);
  }, [shotPower]);

  // ─── JOYSTICK TOUCH HANDLERS ───
  const handleJoystickStart = (e: PointerEvent) => {
    if (activeTouchId.current !== null) return;
    activeTouchId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateJoystickPos(e);
  };

  const handleJoystickMove = (e: PointerEvent) => {
    if (activeTouchId.current !== e.pointerId) return;
    updateJoystickPos(e);
  };

  const handleJoystickEnd = (e: PointerEvent) => {
    if (activeTouchId.current !== e.pointerId) return;
    activeTouchId.current = null;
    setThumbPos({ x: 0, y: 0 });
    moveVector.current = { x: 0, y: 0 };

    sdk.sendFootballInput({
      moveX: 0,
      moveY: 0,
      pass: false,
      shoot: false,
      tackle: false,
      switchPlayer: false,
      special: false
    });
  };

  const updateJoystickPos = (e: PointerEvent) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const maxRadius = 55; // max thumb movement radius

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    setThumbPos({ x: thumbX, y: thumbY });

    // Normalizing -1 to +1
    // On the pitch: +Z is up (negative screen Y), -Z is down (positive screen Y)
    const normX = thumbX / maxRadius;
    const normZ = -thumbY / maxRadius; // invert Y so pushing up on screen moves forward (+Z on pitch)

    moveVector.current = { x: normX, y: normZ };

    sdk.sendFootballInput({
      moveX: normX,
      moveY: normZ,
      pass: false,
      shoot: false,
      tackle: false,
      switchPlayer: false,
      special: false
    });
  };

  // ─── ACTION BUTTON HANDLERS ───
  const handlePass = (e: PointerEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(35);

    sdk.sendFootballInput({
      moveX: moveVector.current.x,
      moveY: moveVector.current.y,
      pass: true,
      shoot: false,
      tackle: false,
      switchPlayer: false,
      special: false
    });
  };

  const handleShootDown = (e: PointerEvent) => {
    e.preventDefault();
    isCharging.current = true;
    chargeStart.current = Date.now();
    setShotPower(0.1);
  };

  const handleShootUp = (e: PointerEvent) => {
    e.preventDefault();
    if (!isCharging.current) return;
    isCharging.current = false;

    const currentPower = Math.max(0.15, shotPower);
    if (navigator.vibrate) navigator.vibrate(50);

    sdk.sendFootballInput({
      moveX: moveVector.current.x,
      moveY: moveVector.current.y,
      pass: false,
      shoot: true,
      shootPower: currentPower,
      tackle: false,
      switchPlayer: false,
      special: false
    });

    setShotPower(0);
  };

  const handleTackle = (e: PointerEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(45);

    sdk.sendFootballInput({
      moveX: moveVector.current.x,
      moveY: moveVector.current.y,
      pass: false,
      shoot: false,
      tackle: true,
      switchPlayer: false,
      special: false
    });
  };

  const handleSwitch = (e: PointerEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(25);
    sdk.switchFootballPlayer();
  };

  const handleSpecial = (e: PointerEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(40);

    sdk.sendFootballInput({
      moveX: moveVector.current.x,
      moveY: moveVector.current.y,
      pass: false,
      shoot: false,
      tackle: false,
      switchPlayer: false,
      special: true
    });
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isGoal = matchState?.phase === 'goal';
  const isCountdown = matchState?.phase === 'countdown';
  const countdownTimer = matchState?.phaseTimer ?? 0;

  return (
    <div class="football-gamepad" data-tick={tick}>
      {/* 1. TOP STATUS BAR */}
      <div class="gamepad-top-bar">
        <div class="gamepad-scoreboard">
          <span style={{ color: '#60a5fa' }}>🔵 {matchState?.blueScore ?? 0}</span>
          <span style={{ color: '#94a3b8' }}>-</span>
          <span style={{ color: '#f87171' }}>{matchState?.redScore ?? 0} 🔴</span>
          <span style={{ fontSize: '0.9rem', color: '#facc15', marginLeft: '0.4rem' }}>
            ⏱️ {formatTime(matchState?.timeRemaining ?? 180)}
          </span>
        </div>

        <div class={`gamepad-player-badge ${myTeam === 'red' ? 'red' : 'blue'}`}>
          <span>
            {activePlayer
              ? `★ ${myNickname || 'Oyuncu'} (#${activePlayer.number} ${roleName})`
              : `★ ${myNickname || 'Oyuncu'} (Saha Oyuncusu)`}
          </span>
          {activePlayer?.hasBall && <span class="gamepad-has-ball">⚽ TOP SENDE!</span>}
        </div>
      </div>

      {/* 2. MAIN GAMEPAD CONTROLS */}
      <div class="gamepad-main-controls">
        {/* LEFT: JOYSTICK */}
        <div
          ref={joystickRef}
          class="joystick-container"
          onPointerDown={handleJoystickStart}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickEnd}
          onPointerCancel={handleJoystickEnd}
        >
          <div
            class="joystick-thumb"
            style={{
              transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)`
            }}
          />
        </div>

        {/* RIGHT: FIFA ACTION BUTTONS */}
        <div class="buttons-cluster">
          {/* TACKLE (TOP-LEFT) */}
          <button
            type="button"
            class="action-btn btn-tackle"
            onPointerDown={handleTackle}
          >
            KAY
          </button>

          {/* SWITCH (TOP-RIGHT) */}
          <button
            type="button"
            class="action-btn btn-switch"
            onPointerDown={handleSwitch}
          >
            DEĞİŞ
          </button>

          {/* SPECIAL (CENTER) */}
          <button
            type="button"
            class="action-btn btn-special"
            onPointerDown={handleSpecial}
          >
            ÇALIM
          </button>

          {/* PASS (BOTTOM-LEFT) */}
          <button
            type="button"
            class="action-btn btn-pass"
            onPointerDown={handlePass}
          >
            PAS
          </button>

          {/* SHOOT (BOTTOM-RIGHT) with Charge Meter */}
          <button
            type="button"
            class="action-btn btn-shoot"
            onPointerDown={handleShootDown}
            onPointerUp={handleShootUp}
            onPointerCancel={handleShootUp}
          >
            ŞUT
          </button>

          {/* Shot power indicator */}
          {shotPower > 0 && (
            <div class="shot-charge-meter">
              <div
                class="shot-charge-fill"
                style={{ width: `${Math.round(shotPower * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. GOAL FLASH OVERLAY (non-blocking) */}
      {isGoal && (
        <div class="goal-flash-overlay" style={{ pointerEvents: 'none' }}>
          <h1 class="goal-flash-text">⚽ GOOOOL! ⚽</h1>
          <div class="goal-scorer-text">
            {matchState?.lastScorerName || 'Gol Atıldı!'}
          </div>
        </div>
      )}

      {/* 4. COUNTDOWN OVERLAY (non-blocking, disappears when countdown ends) */}
      {isCountdown && (
        <div
          class="goal-flash-overlay"
          style={{
            pointerEvents: 'none',
            background: 'rgba(15, 23, 42, 0.75)',
            transition: 'opacity 0.2s ease'
          }}
        >
          <h1 style={{ fontSize: '5rem', color: '#38bdf8', margin: 0, fontWeight: 900 }}>
            {countdownTimer > 0 ? Math.ceil(countdownTimer) : 'BAŞLA!'}
          </h1>
          <div style={{ fontSize: '1.4rem', color: '#94a3b8', marginTop: '0.5rem', fontWeight: 700 }}>
            MAÇ BAŞLIYOR!
          </div>
        </div>
      )}
    </div>
  );
}
